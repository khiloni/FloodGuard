from typing import Dict, Any
from .models import State, ScoreBreakdown


def calculate_score(state: State) -> ScoreBreakdown:
    """Calculate the final simulation evaluation score based on objective outcomes.
    
    Weights (Sum to 100):
    - Residents safe: 40 points
    - Vulnerable protected: 25 points
    - Response time: 15 points
    - Resource efficiency: 10 points
    - Infrastructure preserved: 10 points
    """
    total_safe = sum(z.safe_evacuated for z in state.zones.values())
    total_lost = sum(z.lost for z in state.zones.values())
    vuln_saved = sum(z.vulnerable_saved for z in state.zones.values())

    peak_forecast = max(state.forecast_cm) if state.forecast_cm else 500
    threatened_zones = [z for z in state.zones.values() if z.elevation_cm < peak_forecast]
    threatened_pop = sum(z.initial_population for z in threatened_zones)
    threatened_vuln = sum(z.initial_vulnerable for z in threatened_zones)

    # 1. Residents safe score (0-40)
    # Scaled by proportion of threatened residents evacuated to safety minus casualty penalty
    safe_ratio = min(1.0, total_safe / max(1, threatened_pop))
    residents_safe_score = int(round(safe_ratio * 40))
    if total_lost > 0:
        lost_penalty = int(round((total_lost / max(1, threatened_pop)) * 40))
        residents_safe_score = max(0, residents_safe_score - lost_penalty)

    # 2. Vulnerable protected score (0-25)
    vuln_ratio = min(1.0, vuln_saved / max(1, threatened_vuln))
    vulnerable_protected_score = int(round(vuln_ratio * 25))

    # 3. Response time score (0-15)
    response_time_score = 0
    if state.first_warning_tick is not None:
        if state.first_warning_tick <= 3:
            response_time_score += 8
        elif state.first_warning_tick <= 6:
            response_time_score += 5
        elif state.first_warning_tick <= 10:
            response_time_score += 2
            
    if state.first_evacuation_tick is not None:
        if state.first_evacuation_tick <= 5:
            response_time_score += 7
        elif state.first_evacuation_tick <= 8:
            response_time_score += 4
        elif state.first_evacuation_tick <= 12:
            response_time_score += 2
    response_time_score = min(15, response_time_score)

    # 4. Resource efficiency score (0-10)
    efficiency_score = 0
    shelter_open = any(s.is_open for s in state.shelters.values())
    if shelter_open:
        efficiency_score += 4
    if state.resources.total_boats > state.resources.available_boats or total_safe > 0:
        efficiency_score += 3
    if state.embankment.reinforced_count > 0:
        efficiency_score += 3
    resource_efficiency_score = min(10, efficiency_score)

    # 5. Infrastructure preserved score (0-10)
    if not state.embankment.breached and state.embankment.integrity >= 80:
        infrastructure_preserved_score = 10
    elif not state.embankment.breached and state.embankment.integrity >= 50:
        infrastructure_preserved_score = 7
    elif not state.embankment.breached:
        infrastructure_preserved_score = 4
    else:
        infrastructure_preserved_score = 0

    total_score = (
        residents_safe_score
        + vulnerable_protected_score
        + response_time_score
        + resource_efficiency_score
        + infrastructure_preserved_score
    )
    total_score = max(0, min(100, total_score))

    total_pop = sum(z.initial_population for z in state.zones.values())
    total_vuln = sum(z.initial_vulnerable for z in state.zones.values())

    details: Dict[str, Any] = {
        "total_population": total_pop,
        "threatened_population": threatened_pop,
        "total_safe": total_safe,
        "total_lost": total_lost,
        "total_vulnerable": total_vuln,
        "threatened_vulnerable": threatened_vuln,
        "vulnerable_saved": vuln_saved,
        "first_warning_tick": state.first_warning_tick,
        "first_evacuation_tick": state.first_evacuation_tick,
        "embankment_integrity": state.embankment.integrity,
        "embankment_breached": state.embankment.breached,
    }

    return ScoreBreakdown(
        total_score=total_score,
        residents_safe_score=residents_safe_score,
        vulnerable_protected_score=vulnerable_protected_score,
        response_time_score=response_time_score,
        resource_efficiency_score=resource_efficiency_score,
        infrastructure_preserved_score=infrastructure_preserved_score,
        details=details,
    )
