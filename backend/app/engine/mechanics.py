"""Scenario-specific mechanics and external support (pure, integer-only).

Every number comes from the scenario pack (`mechanic.params`, `external_support`). The core
step() calls these helpers; scenarios without a mechanic (`type: none`) are unaffected.

Mechanics
- drains (urban flash flood): zones with blocked drains get extra street water while it rains;
  underpass zones lose road access at a lower depth; `clear_drains` unblocks one zone.
- dam_release (downstream of a dam): a scheduled release adds water from `release_tick` for
  `release_ticks` ticks; a notice event comes `notice_ticks` earlier. `request_staggered_release`
  (before the release starts) spreads it over twice as many ticks at roughly half the height.
- cyclone (storm surge): fishing boats are at sea; `recall_fishing_boats` brings them home after
  `return_ticks`. At `landfall_tick` wind cuts power and any crews still at sea are stranded.
"""
from typing import Any, Dict, List, Optional

from .models import ActionName, Event, EventType, State


def _p(state: State, key: str, default: int = 0) -> int:
    return int(state.mechanic.params.get(key, default))


def _ev(etype: EventType, tick: int, description: str, caused_by: str,
        zone: Optional[str] = None, target: Optional[str] = None, **details: Any) -> Event:
    tgt = target if target is not None else (zone or "system")
    return Event(type=etype, tick=tick, description=description, caused_by=caused_by,
                 zone=zone, target=tgt, details={"zone": zone, "target": tgt, **details})


# --------------------------------------------------------------------------- water level

def release_profile(state: State, tick: int, mstate: Optional[Dict[str, int]] = None) -> int:
    """Extra river water (cm) from a dam release at `tick`."""
    if state.mechanic.type != "dam_release":
        return 0
    ms = state.mechanic_state if mstate is None else mstate
    start = _p(state, "release_tick")
    ticks = _p(state, "release_ticks", 4)
    peak = _p(state, "release_cm")
    if ms.get("staggered", 0):
        ticks = ticks * 2
        peak = (peak * _p(state, "staggered_pct", 55)) // 100
    if start <= 0 or not (start <= tick < start + ticks):
        return 0
    # triangular-ish: full height in the middle ticks, half on the first and last tick
    if tick == start or tick == start + ticks - 1:
        return peak // 2
    return peak


def water_level_at(state: State, tick: int, mstate: Optional[Dict[str, int]] = None) -> int:
    """River/sea/street water level for a tick (forecast plus any mechanic)."""
    idx = min(max(tick, 1) - 1, len(state.forecast_cm) - 1)
    return state.forecast_cm[idx] + release_profile(state, tick, mstate)


# --------------------------------------------------------------------------- zone effects

def extra_depth(state: State, zone, raining: bool) -> int:
    """Additional street water in a zone from blocked drains (urban mechanic)."""
    if state.mechanic.type != "drains" or not zone.drain_blocked or not raining:
        return 0
    return _p(state, "blocked_drain_extra_cm", 25)


def road_cutoff_cm(state: State, zone) -> int:
    if state.mechanic.type == "drains" and zone.underpass:
        return _p(state, "underpass_cutoff_cm", 15)
    return 30


# --------------------------------------------------------------------------- preconditions

def validate_mechanic_action(state: State, action) -> Optional[str]:
    """Return a rejection reason, or None if the action is allowed."""
    name = action.name
    ms = state.mechanic_state
    if name == ActionName.CLEAR_DRAINS:
        zone_id = action.params.get("zone")
        if not zone_id or zone_id not in state.zones:
            return f"Valid target zone is required. Known zones: {list(state.zones.keys())}."
        if not state.zones[zone_id].drain_blocked:
            return f"The drains in {state.zones[zone_id].name} are already clear."
        if ms.get("drain_crews", 0) <= 0:
            return "No drain-clearing crews are left."
        return None
    if name == ActionName.REQUEST_STAGGERED_RELEASE:
        if ms.get("staggered", 0):
            return "The dam authority has already agreed to a staggered release."
        if state.tick + 1 >= _p(state, "release_tick"):
            return "The release has already started; it can no longer be rescheduled."
        return None
    if name == ActionName.RECALL_FISHING_BOATS:
        if ms.get("recalled", 0):
            return "The fishing boats have already been recalled."
        if ms.get("boats_at_sea", 0) <= 0:
            return "No fishing boats are at sea."
        if state.tick + 1 >= _p(state, "landfall_tick"):
            return "The cyclone has made landfall; boats can no longer be recalled safely."
        return None
    return "Unsupported mechanic action."


def validate_support_request(state: State) -> Optional[str]:
    if state.support.uses <= 0:
        return "This scenario has no outside support to request."
    if state.support_eta_tick is not None:
        return f"Support is already on its way and should arrive at tick {state.support_eta_tick}."
    if state.support_requests_left <= 0:
        return "The district has no more support to send."
    return None


# --------------------------------------------------------------------------- actions

def apply_mechanic_action(state: State, action, zones: Dict[str, Any], ms: Dict[str, int],
                          events: List[Event], tick: int) -> None:
    by = f"Action {action.name.value}"
    if action.name == ActionName.CLEAR_DRAINS:
        zid = action.params["zone"]
        zones[zid] = zones[zid].model_copy(update={"drain_blocked": False})
        ms["drain_crews"] = ms.get("drain_crews", 0) - 1
        events.append(_ev(EventType.DRAINS_CLEARED, tick,
                          f"Municipal crews cleared blocked drains in {zones[zid].name}.", by, zone=zid,
                          crews_left=ms["drain_crews"]))
    elif action.name == ActionName.REQUEST_STAGGERED_RELEASE:
        ms["staggered"] = 1
        events.append(_ev(EventType.RELEASE_STAGGERED, tick,
                          "The dam authority agreed to release water more slowly over a longer period.", by,
                          target="dam", release_tick=_p(state, "release_tick")))
    elif action.name == ActionName.RECALL_FISHING_BOATS:
        ms["recalled"] = 1
        ms["boats_return_tick"] = tick + _p(state, "return_ticks", 3)
        events.append(_ev(EventType.FISHING_BOATS_RECALLED, tick,
                          f"A recall message reached {ms.get('boats_at_sea', 0)} fishing boats at sea.", by,
                          target="sea", boats_at_sea=ms.get("boats_at_sea", 0),
                          return_tick=ms["boats_return_tick"]))


def request_support(state: State, events: List[Event], tick: int) -> int:
    eta = tick + state.support.delay_ticks
    events.append(_ev(EventType.SUPPORT_REQUESTED, tick,
                      f"The district promised outside help; it should arrive in {state.support.delay_ticks} ticks.",
                      "Action request_external_support", target="district",
                      eta_tick=eta, delay_ticks=state.support.delay_ticks))
    return eta


# --------------------------------------------------------------------------- per-tick rules

def tick_mechanics(state: State, ms: Dict[str, int], events: List[Event], tick: int,
                   water_level: int) -> None:
    """Scheduled scenario events for this tick (after water advance)."""
    mt = state.mechanic.type
    if mt == "dam_release":
        start = _p(state, "release_tick")
        notice = start - _p(state, "notice_ticks", 3)
        if tick == notice:
            events.append(_ev(EventType.DAM_RELEASE_NOTICE, tick,
                              f"The dam authority announced a water release starting at tick {start}.",
                              "Scheduled dam operation", target="dam", release_tick=start))
        if tick == start:
            extra = release_profile(state, tick, ms)
            events.append(_ev(EventType.DAM_RELEASE_STARTED, tick,
                              f"The dam release began, adding {extra} cm to the river.",
                              "Scheduled dam operation" + (" (staggered)" if ms.get("staggered") else ""),
                              target="dam", added_cm=extra, water_level_cm=water_level))
    elif mt == "cyclone":
        if ms.get("recalled") and ms.get("boats_at_sea", 0) > 0 and tick >= ms.get("boats_return_tick", 10 ** 6):
            n = ms["boats_at_sea"]
            ms["boats_at_sea"] = 0
            events.append(_ev(EventType.FISHING_BOATS_RETURNED, tick,
                              f"{n} fishing boats reached the harbour safely.", "Recall message sent earlier",
                              target="harbour", boats=n))
        if tick == _p(state, "landfall_tick"):
            ms["power_down"] = 1
            events.append(_ev(EventType.CYCLONE_LANDFALL, tick,
                              "The cyclone made landfall. Strong winds cut power across the village.",
                              "Cyclone track", target="coast"))
            if ms.get("boats_at_sea", 0) > 0:
                crews = ms["boats_at_sea"] * _p(state, "crew_per_boat", 4)
                ms["fishers_stranded"] = crews
                ms["boats_at_sea"] = 0
                events.append(_ev(EventType.FISHERS_STRANDED, tick,
                                  f"{crews} fishers were still at sea when the cyclone hit and are missing.",
                                  "Fishing boats were not recalled before landfall", target="sea",
                                  fishers=crews))


def support_arrives(state: State, tick: int) -> bool:
    return state.support_eta_tick is not None and tick >= state.support_eta_tick


def is_raining(state: State, tick: int) -> bool:
    """Rain lasts until the forecast peak (used by the drains mechanic)."""
    if not state.forecast_cm:
        return False
    peak = state.forecast_cm.index(max(state.forecast_cm)) + 1
    return tick <= peak
