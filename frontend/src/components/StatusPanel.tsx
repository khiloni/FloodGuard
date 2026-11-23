import React from 'react';
import type { EngineState, Summary } from '../api/types';
import { waterStatus } from './scene/VillageScene';
import {
  WavesHorizontal, Shield, School, Ship, Truck, Users, Package, Droplets, Thermometer, Zap, HeartHandshake, HeartPulse, Construction,
} from './icons';

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; tone?: 'ok' | 'warn' | 'danger' | ''; word?: string; testid?: string }> = ({ icon, label, value, tone = '', word, testid }) => (
  <div className={`stat ${tone}`} data-testid={testid}>
    <span className="stat-icon" aria-hidden="true">{icon}</span>
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}{word && <span className={`stat-word ${tone}`}> {word}</span>}</span>
  </div>
);

export const StatusPanel: React.FC<{ s: Summary; state: EngineState | null }> = ({ s, state }) => {
  const ws = waterStatus(s);
  const safe = Object.values(s.zones).reduce((a, z) => a + z.safe_evacuated, 0);
  const atRisk = Object.values(s.zones).reduce((a, z) => a + (z.water_depth_cm > 0 || z.max_depth_cm > 0 ? z.population_remaining : 0), 0);
  const lost = Object.values(state?.zones || {}).reduce((a, z) => a + (z.lost || 0), 0);
  const vuln = Object.values(s.zones).reduce((a, z) => a + z.vulnerable_saved, 0);
  const rec = s.recovery;
  const risk = rec?.disease_risk ?? 0;
  const riskWord = risk >= 60 ? 'high' : risk >= 35 ? 'moderate' : 'low';
  const blocked = Object.values(s.zones).filter((z) => z.road_blocked).length;
  return (
    <section className="status" aria-label="Village status">
      <h2 className="panel-title">Village status</h2>
      <div className="stat-grid">
        <Stat testid="stat-river" icon={<WavesHorizontal />} label="River" value={`${s.water_level_cm} cm`}
          tone={ws === 'danger' ? 'danger' : ws === 'warning' ? 'warn' : 'ok'} word={ws === 'normal' ? 'normal' : ws === 'warning' ? 'warning' : 'DANGER'} />
        <Stat testid="stat-embankment" icon={<Shield />} label="Embankment" value={s.embankment_breached ? 'Breached' : `${s.embankment_height_cm} cm, ${s.embankment_integrity}%`}
          tone={s.embankment_breached ? 'danger' : s.embankment_integrity < 60 ? 'warn' : 'ok'} />
        <Stat testid="stat-shelter" icon={<School />} label="Shelter" value={s.shelter.is_open ? `${s.shelter.occupancy} / ${s.shelter.capacity}` : 'Closed'} tone={s.shelter.is_open ? 'ok' : 'warn'} />
        <Stat icon={<Ship />} label="Boats free" value={`${s.transport.boats_available} of ${s.transport.boats_total}`} />
        <Stat icon={<Truck />} label="Trucks free" value={`${s.transport.vehicles_available} of ${s.transport.vehicles_total}`} />
        <Stat testid="stat-people" icon={<Users />} label="Safe in shelter" value={`${s.displaced}`} word={`(${safe} moved so far)`} />
        <Stat icon={<HeartHandshake />} label="Vulnerable moved" value={`${vuln}`} />
        <Stat icon={<Users />} label="Still in flooded homes" value={`${atRisk}`} tone={atRisk > 0 ? 'warn' : 'ok'} />
        {lost > 0 && <Stat icon={<Users />} label="People lost" value={`${lost}`} tone="danger" />}
        {rec && (s.phase === 'recovery' || s.shelter.occupancy > 0) && (
          <Stat testid="stat-supplies" icon={<Package />} label="Shelter supplies" value={`${rec.shelter_supplies} units`}
            word={`${rec.supply_deliveries_left} deliveries left`} tone={rec.shelter_supplies === 0 ? 'danger' : rec.shelter_supplies <= 10 ? 'warn' : 'ok'} />
        )}
        {rec && s.phase === 'recovery' && (
          <>
            <Stat testid="stat-disease" icon={<Thermometer />} label="Disease risk" value={`${risk}/100`} word={riskWord}
              tone={risk >= 60 ? 'danger' : risk >= 35 ? 'warn' : 'ok'} />
            <Stat icon={<Droplets />} label="Clean water" value={rec.clean_water_active ? 'Running' : 'Not yet'} tone={rec.clean_water_active ? 'ok' : 'warn'} />
            <Stat icon={<HeartPulse />} label="Medical camp" value={rec.medical_camp_active ? 'Open' : 'Not yet'} word={rec.illness_untreated ? `${rec.illness_untreated} untreated` : undefined}
              tone={rec.medical_camp_active ? 'ok' : rec.illness_untreated ? 'warn' : ''} />
            <Stat icon={<Zap />} label="Power" value={rec.power_on ? 'On' : 'Off'} tone={rec.power_on ? 'ok' : 'warn'} />
            <Stat icon={<Construction />} label="Blocked roads" value={`${blocked}`} tone={blocked ? 'warn' : 'ok'} />
            <Stat testid="stat-trust" icon={<Users />} label="Community trust" value={`${rec.community_trust}/100`} tone={rec.community_trust < 40 ? 'warn' : 'ok'} />
          </>
        )}
      </div>
      <div className="legend" aria-label="Map legend">
        <span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="#1f2937" /></svg> 10 residents at home</span>
        <span><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="#fff" stroke="#CC79A7" strokeWidth="2.5" /><circle cx="7" cy="7" r="2.2" fill="#CC79A7" /></svg> 10 vulnerable residents</span>
        <span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="#009E73" /></svg> 10 people in the shelter</span>
      </div>
    </section>
  );
};
