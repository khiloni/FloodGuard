"""Deterministic three-phase report: phase summaries and a causal chain built from the
event log by fixed rules. No LLM is involved; the same log always gives the same report."""
from typing import Any, Dict, List, Optional

from ..engine.models import State, ScoreBreakdown

PHASE_LABELS = {"before": "Before the flood", "flood": "During the flood", "recovery": "After the flood"}

PHASE_COMPONENTS = {
    "before": ["response_time_score"],
    "flood": ["residents_safe_score", "vulnerable_protected_score",
              "resource_efficiency_score", "infrastructure_preserved_score"],
    "recovery": ["public_health_score", "essential_services_score",
                 "safe_return_score", "community_trust_score"],
}

KEY_EVENTS = {
    "warning_issued", "evacuation_ordered", "shelter_opened", "transport_assigned",
    "vulnerable_prioritized", "embankment_reinforced", "zone_flooded", "road_inundated",
    "embankment_overflow", "embankment_breached", "casualty_occurred", "phase_changed",
    "search_and_rescue_completed", "supplies_distributed", "shelter_supplies_low",
    "shelter_supplies_exhausted", "clean_water_provided", "medical_camp_opened",
    "disease_risk_high", "power_restored", "health_centre_reopened", "road_cleared",
    "damage_surveyed", "residents_returned", "water_receded",
}


def _phase_of(ev: Dict[str, Any]) -> str:
    return (ev.get("details") or {}).get("phase") or "flood"


def _brief(ev: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if ev is None:
        return None
    return {"tick": ev.get("tick"), "type": ev.get("type"), "zone": ev.get("zone"),
            "description": ev.get("description")}


def _outcome(tick: Optional[int], text: str) -> Dict[str, Any]:
    return {"tick": tick, "type": "outcome", "zone": None, "description": text}


def _first(events, etype, zone=None, after=None) -> Optional[Dict[str, Any]]:
    for ev in events:
        if ev.get("type") != etype:
            continue
        if zone is not None and ev.get("zone") != zone:
            continue
        if after is not None and ev.get("tick", 0) < after:
            continue
        return ev
    return None


def build_phases(state: State, events: List[Dict[str, Any]], score: ScoreBreakdown) -> List[Dict[str, Any]]:
    starts = {"before": 0, "flood": state.flood_start_tick, "recovery": state.recovery_start_tick}
    ends = {
        "before": (state.flood_start_tick - 1) if state.flood_start_tick else state.tick,
        "flood": (state.recovery_start_tick - 1) if state.recovery_start_tick else state.tick,
        "recovery": state.tick,
    }
    out = []
    for phase in ("before", "flood", "recovery"):
        reached = phase == "before" or starts[phase] is not None
        phase_events = [e for e in events if _phase_of(e) == phase and e.get("type") in KEY_EVENTS]
        comps = {c: getattr(score, c) for c in PHASE_COMPONENTS[phase]}
        weights = (score.details or {}).get("weights", {})
        out.append({
            "phase": phase,
            "label": PHASE_LABELS[phase],
            "reached": reached,
            "start_tick": starts[phase] if reached else None,
            "end_tick": ends[phase] if reached else None,
            "key_events": [_brief(e) for e in phase_events[:12]],
            "score_components": comps,
            "score_points": sum(comps.values()),
            "score_max": sum(weights.get(c.replace("_score", ""), 0) for c in comps),
        })
    return out


def build_causal_chain(state: State, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    links: List[Dict[str, Any]] = []

    def link(cause, effect, explanation):
        if cause is None or effect is None:
            return
        cause_phase = _phase_of(cause) if cause.get("type") != "outcome" else _phase_of(effect)
        links.append({"phase": cause_phase, "cause": _brief(cause) if "details" in cause else cause,
                      "effect": _brief(effect) if "details" in effect else effect,
                      "explanation": explanation})

    # --- Before / during the flood ---
    warn = _first(events, "warning_issued")
    if warn:
        link(warn, _first(events, "residents_evacuated", after=warn["tick"]),
             "The early warning made residents more willing to leave when transport arrived.")
    shelter = _first(events, "shelter_opened")
    if shelter:
        link(shelter, _first(events, "residents_evacuated", after=shelter["tick"]),
             "With the shelter open, evacuees had a safe place to go.")
    seen_zone = set()
    for ta in [e for e in events if e.get("type") == "transport_assigned"]:
        z = ta.get("zone")
        if z in seen_zone:
            continue
        seen_zone.add(z)
        link(ta, _first(events, "residents_evacuated", zone=z, after=ta["tick"]),
             "Assigned boats and trucks moved people out of this ward.")
    for ri in [e for e in events if e.get("type") == "road_inundated"]:
        link(ri, _outcome(ri["tick"], f"Wheeled vehicles could no longer reach {ri.get('zone')}; only boats could."),
             "Flood depth above the road cut-off blocks trucks.")
    reinf = _first(events, "embankment_reinforced")
    breach = _first(events, "embankment_breached")
    if reinf and not breach:
        link(reinf, _outcome(None, f"The embankment held (integrity {state.embankment.integrity}%)."),
             "Sandbags laid before the peak raised the bund and kept it from collapsing.")
    seen_cas = set()
    for cas in [e for e in events if e.get("type") == "casualty_occurred"]:
        z = cas.get("zone")
        if z in seen_cas:
            continue
        seen_cas.add(z)
        link(_outcome(cas["tick"], f"No boats were assigned to {z} while water there was 150 cm or deeper."),
             cas, "Residents left in deep water without boats were at risk.")

    # --- Into recovery ---
    rec_start = next((e for e in events if e.get("type") == "phase_changed"
                      and (e.get("details") or {}).get("to_phase") == "recovery"), None)
    if rec_start:
        d = rec_start.get("details") or {}
        if breach:
            link(breach, rec_start, "The breach flooded more homes and left the village without power when recovery began.")
        flooded = d.get("flooded_zones", 0)
        if flooded:
            link(_outcome(rec_start["tick"], f"{flooded} ward(s) had been flooded."), rec_start,
                 f"Standing floodwater set the starting disease risk to {d.get('disease_risk')} out of 100.")
        ran_out = _first(events, "shelter_supplies_exhausted")
        if ran_out and ran_out["tick"] <= rec_start["tick"]:
            link(ran_out, rec_start, "Running out of supplies during the flood lowered community trust going into recovery.")

    # --- After the flood ---
    high = _first(events, "disease_risk_high")
    water = _first(events, "clean_water_provided")
    if high and (water is None or water["tick"] > high["tick"]):
        link(rec_start or _outcome(None, "Recovery began without clean water."), high,
             "Without clean water, waterborne disease risk kept rising.")
    if water:
        if high and water["tick"] > high["tick"]:
            link(water, _outcome(water["tick"], "Disease risk started to fall."),
                 "Clean water removed the main source of illness.")
        elif not high:
            link(water, _outcome(None, f"Disease risk stayed below the high mark (peak {state.recovery.peak_disease_risk})."),
                 "Providing clean water early kept illness from spreading.")
    camp = _first(events, "medical_camp_opened")
    if camp:
        treated = _first(events, "illness_treated", after=camp["tick"])
        if treated:
            link(camp, treated, "The medical camp treated cases before they spread.")
        else:
            link(camp, _outcome(None, "No new illness was reported while the camp was running."),
                 "Health checks at the camp stopped illness from taking hold.")
    illness = _first(events, "illness_reported")
    if illness and (camp is None or camp["tick"] > illness["tick"]):
        link(high or illness, illness, "High disease risk with no medical camp led to reported illness.")
    road = _first(events, "road_cleared")
    power = _first(events, "power_restored")
    if road and power and road["tick"] <= power["tick"]:
        link(road, power, "A cleared road let repair crews reach the substation.")
    if power:
        link(power, _first(events, "health_centre_reopened", after=power["tick"]),
             "Electricity let the health centre reopen.")
    for sv in [e for e in events if e.get("type") == "damage_surveyed"]:
        z = sv.get("zone")
        link(sv, _first(events, "residents_returned", zone=z, after=sv["tick"]),
             "Houses were checked before families moved back.")
    for sr in [e for e in events if e.get("type") == "search_and_rescue_completed"]:
        n = (sr.get("details") or {}).get("rescued", 0)
        link(sr, _outcome(sr["tick"], f"{n} stranded residents reached the shelter."),
             "Search teams reached people the evacuation had missed.")
    low = _first(events, "shelter_supplies_low")
    deliv = _first(events, "supplies_distributed", after=low["tick"]) if low else None
    if low and deliv:
        link(low, deliv, "A delivery after the low-stock warning kept the shelter supplied.")
    for ex in [e for e in events if e.get("type") == "shelter_supplies_exhausted"]:
        if rec_start and ex["tick"] <= rec_start["tick"]:
            continue
        link(ex, _outcome(ex["tick"], "Community trust fell and disease risk rose while the shelter had no supplies."),
             "Empty shelter stocks harm health and trust.")

    links.sort(key=lambda l: ((l["cause"] or {}).get("tick") if (l["cause"] or {}).get("tick") is not None
                              else (l["effect"] or {}).get("tick") or 0))
    return links


def build_report_sections(state: State, events: List[Dict[str, Any]], score: ScoreBreakdown) -> Dict[str, Any]:
    return {
        "phases": build_phases(state, events, score),
        "causal_chain": build_causal_chain(state, events),
    }
