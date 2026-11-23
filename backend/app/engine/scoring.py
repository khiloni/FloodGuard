from typing import Dict, Any
from .models import State, ScoreBreakdown
from . import mechanics

# Weights sum to 100 (see docs/POST_FLOOD_DESIGN.md section 8).
WEIGHTS = {
    "residents_safe": 30,
    "vulnerable_protected": 20,
    "response_time": 10,
    "resource_efficiency": 7,
    "infrastructure_preserved": 8,
    "public_health": 8,
    "essential_services": 6,
    "safe_return": 6,
    "community_trust": 5,
}
assert sum(WEIGHTS.values()) == 100


def _ratio_points(num: int, den: int, weight: int) -> int:
    """weight * num / den, rounded half up, using integers only. Capped at weight."""
    if den <= 0:
        return 0
    num = max(0, min(num, den))
    return (2 * num * weight + den) // (2 * den)


def calculate_score(state: State) -> ScoreBreakdown:
    """Score the session from objective engine state. Integer-only arithmetic."""
    zones = list(state.zones.values())
    total_safe = sum(z.safe_evacuated for z in zones)
    # Fishers stranded at sea (cyclone mechanic) count as lost too.
    total_lost = sum(z.lost for z in zones) + state.mechanic_state.get("fishers_stranded", 0)
    vuln_saved = sum(z.vulnerable_saved for z in zones)

    # Worst-case water level the scenario can bring (forecast plus an unstaggered dam release).
    if state.forecast_cm:
        peak_forecast = max(mechanics.water_level_at(state, t, {}) for t in range(1, len(state.forecast_cm) + 1))
    else:
        peak_forecast = 500
    threatened = [z for z in zones if z.elevation_cm < peak_forecast]
    threatened_pop = sum(z.initial_population for z in threatened)
    threatened_vuln = sum(z.initial_vulnerable for z in threatened)

    # --- Before / during the flood (75) ---
    w = WEIGHTS["residents_safe"]
    residents_safe = _ratio_points(total_safe, max(1, threatened_pop), w)
    if total_lost > 0:
        residents_safe = max(0, residents_safe - _ratio_points(total_lost, max(1, threatened_pop), w))

    vulnerable_protected = _ratio_points(vuln_saved, max(1, threatened_vuln), WEIGHTS["vulnerable_protected"])

    response_time = 0
    fw, fe = state.first_warning_tick, state.first_evacuation_tick
    if fw is not None:
        response_time += 5 if fw <= 3 else 3 if fw <= 6 else 1 if fw <= 10 else 0
    if fe is not None:
        response_time += 5 if fe <= 5 else 3 if fe <= 8 else 1 if fe <= 12 else 0
    response_time = min(WEIGHTS["response_time"], response_time)

    efficiency = 0
    if any(s.is_open for s in state.shelters.values()):
        efficiency += 3
    if state.resources.total_boats > state.resources.available_boats or total_safe > 0:
        efficiency += 2
    if state.embankment.reinforced_count > 0:
        efficiency += 2
    efficiency = min(WEIGHTS["resource_efficiency"], efficiency)

    emb = state.embankment
    if emb.breached:
        infrastructure = 0
    elif emb.integrity >= 80:
        infrastructure = 8
    elif emb.integrity >= 50:
        infrastructure = 6
    else:
        infrastructure = 3

    # --- After the flood (25) ---
    rec = state.recovery
    public_health = essential_services = safe_return = community_trust = 0
    untreated = rec.illness_cases - rec.illness_treated
    roads_blocked_ever = [z for z in zones if z.max_depth_cm >= state.recovery_config.road_debris_depth_cm]
    roads_cleared = [z for z in roads_blocked_ever if not z.road_blocked]
    total_returned = sum(z.returned for z in zones)
    if state.recovery_config.enabled and state.recovery_start_tick is not None:
        public_health = max(0, _ratio_points(100 - rec.peak_disease_risk, 100, WEIGHTS["public_health"]) - untreated // 5)
        essential_services = (2 if rec.clean_water_active else 0) + (2 if rec.power_on else 0)
        essential_services += _ratio_points(len(roads_cleared), len(roads_blocked_ever), 2) if roads_blocked_ever else 2
        safe_return = _ratio_points(total_returned, total_safe, WEIGHTS["safe_return"]) if total_safe else 0
        community_trust = _ratio_points(rec.community_trust, 100, WEIGHTS["community_trust"])

    total = (residents_safe + vulnerable_protected + response_time + efficiency + infrastructure
             + public_health + essential_services + safe_return + community_trust)
    total = max(0, min(100, total))

    details: Dict[str, Any] = {
        "weights": dict(WEIGHTS),
        "total_population": sum(z.initial_population for z in zones),
        "threatened_population": threatened_pop,
        "total_safe": total_safe,
        "total_lost": total_lost,
        "total_vulnerable": sum(z.initial_vulnerable for z in zones),
        "threatened_vulnerable": threatened_vuln,
        "vulnerable_saved": vuln_saved,
        "first_warning_tick": fw,
        "first_evacuation_tick": fe,
        "embankment_integrity": emb.integrity,
        "embankment_breached": emb.breached,
        "phase_reached": state.phase,
        "peak_disease_risk": rec.peak_disease_risk,
        "illness_cases": rec.illness_cases,
        "illness_untreated": untreated,
        "clean_water": rec.clean_water_active,
        "power_on": rec.power_on,
        "roads_blocked": len(roads_blocked_ever),
        "roads_cleared": len(roads_cleared),
        "residents_returned": total_returned,
        "community_trust": rec.community_trust,
        "supply_shortfall_ticks": rec.supply_shortfall_ticks,
    }

    return ScoreBreakdown(
        total_score=total,
        residents_safe_score=residents_safe,
        vulnerable_protected_score=vulnerable_protected,
        response_time_score=response_time,
        resource_efficiency_score=efficiency,
        infrastructure_preserved_score=infrastructure,
        public_health_score=public_health,
        essential_services_score=essential_services,
        safe_return_score=safe_return,
        community_trust_score=community_trust,
        details=details,
    )
