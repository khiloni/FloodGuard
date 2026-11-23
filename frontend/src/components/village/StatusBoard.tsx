import React from 'react';
import type { EngineState, Layout, Summary } from '../../api/types';
import {
  School, Ship, Truck, Package, Droplets, Thermometer, Zap, HeartPulse, Construction, Users, Shield, Megaphone, Anchor, Grid2x2, Timer,
} from '../icons';

const Tag: React.FC<{ tone?: 'ok' | 'warn' | 'danger' | ''; children: React.ReactNode }> = ({ tone = '', children }) => (
  <span className={`tag ${tone}`}>{children}</span>
);

function zoneStatus(z: Summary['zones'][string], phase: string): { text: string; tone: 'ok' | 'warn' | 'danger' | '' } {
  if (phase === 'recovery') {
    if (z.population_remaining > 0 && z.max_depth_cm > 0) return { text: 'Stranded residents', tone: 'danger' };
    if (z.water_depth_cm > 0) return { text: 'Still under water', tone: 'warn' };
    if (z.in_shelter > 0) return { text: z.surveyed || !z.max_depth_cm ? 'Ready to return' : 'Needs survey', tone: '' };
    return { text: 'Home', tone: 'ok' };
  }
  if (z.water_depth_cm >= 150) return { text: 'Deep flooding', tone: 'danger' };
  if (z.water_depth_cm > 0) return { text: 'Flooding', tone: 'warn' };
  if (z.evacuation_ordered) return { text: 'Evacuating', tone: '' };
  return { text: 'Dry', tone: 'ok' };
}

/** Page 2 status: zones, resources, shelters, infrastructure, trust, warnings. Numbers from the API only. */
export const StatusBoard: React.FC<{ s: Summary; state: EngineState | null; layout: Layout }> = ({ s, layout }) => {
  const rec = s.recovery;
  const mech = s.mechanic;
  const sup = s.support;
  const t = s.transport;
  return (
    <div className="status-board" data-testid="status-board">
      <h3>Areas</h3>
      <table className="zones-table">
        <thead><tr><th scope="col">Area</th><th scope="col">At home</th><th scope="col" title="Vulnerable residents still at home">Vuln.</th><th scope="col">Water</th><th scope="col">Status</th></tr></thead>
        <tbody>
          {layout.zones.map((lz) => {
            const z = s.zones[lz.id];
            if (!z) return null;
            const st = zoneStatus(z, s.phase);
            return (
              <tr key={lz.id} data-testid={`zone-row-${lz.id}`}>
                <th scope="row">{lz.name}{z.warning_level > 0 && <Megaphone className="inline-icon" aria-label="warned" />}</th>
                <td>{z.population_remaining}</td>
                <td>{z.vulnerable_remaining}</td>
                <td>{z.water_depth_cm ? `${z.water_depth_cm} cm` : '-'}</td>
                <td><Tag tone={st.tone}>{st.text}</Tag>{z.drain_blocked && <Tag tone="warn">drains blocked</Tag>}{z.road_blocked && <Tag tone="warn">debris</Tag>}
                  {z.surveyed && (z.damaged_houses ?? 0) > 0 && <Tag>{z.damaged_houses} houses damaged</Tag>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3>Resources and shelters</h3>
      <div className="kv-grid">
        <div className={t.boats_available ? '' : 'depleted'}><Ship aria-hidden="true" /> Boats free <strong>{t.boats_available}/{t.boats_total}</strong></div>
        <div className={t.vehicles_available ? '' : 'depleted'}><Truck aria-hidden="true" /> Trucks free <strong>{t.vehicles_available}/{t.vehicles_total}</strong></div>
        <div className={(s.sandbags ?? 0) ? '' : 'depleted'}><Shield aria-hidden="true" /> Sandbags <strong>{s.sandbags ?? 0}</strong></div>
        <div><School aria-hidden="true" /> In shelters <strong>{s.shelter.occupancy}/{s.shelter.capacity}</strong> {s.shelter.is_open ? <Tag tone="ok">open</Tag> : <Tag tone="warn">closed</Tag>}</div>
        {rec && <div className={rec.shelter_supplies ? '' : 'depleted'}><Package aria-hidden="true" /> Supplies <strong>{rec.shelter_supplies}</strong> <span className="muted small">({rec.supply_deliveries_left} deliveries left)</span></div>}
        <div><Shield aria-hidden="true" /> Embankment <strong>{s.embankment_breached ? 'breached' : `${s.embankment_height_cm} cm, ${s.embankment_integrity}%`}</strong></div>
        <div><Megaphone aria-hidden="true" /> Warnings delivered <strong>{s.warnings_delivered ?? 0}/{layout.zones.length}</strong></div>
        {sup && <div><Truck aria-hidden="true" /> Outside support <strong>{sup.eta_tick !== null ? `arriving tick ${sup.eta_tick}` : sup.available ? 'available' : 'used'}</strong></div>}
      </div>

      {mech && mech.type !== 'none' && (
        <>
          <h3>Scenario</h3>
          <div className="kv-grid">
            {mech.type === 'cyclone' && <div><Anchor aria-hidden="true" /> Boats at sea <strong>{mech.boats_at_sea}</strong> <span className="muted small">landfall tick {mech.landfall_tick}</span></div>}
            {mech.type === 'cyclone' && mech.fishers_stranded > 0 && <div className="depleted"><Users aria-hidden="true" /> Fishers missing <strong>{mech.fishers_stranded}</strong></div>}
            {mech.type === 'dam_release' && <div><Timer aria-hidden="true" /> Dam release <strong>tick {mech.release_tick}</strong> {mech.staggered ? <Tag tone="ok">staggered</Tag> : <Tag tone="warn">full</Tag>}</div>}
            {mech.type === 'drains' && <div><Grid2x2 aria-hidden="true" /> Drain crews left <strong>{mech.drain_crews}</strong></div>}
          </div>
        </>
      )}

      <h3>Infrastructure and health</h3>
      <div className="kv-grid">
        <div><Zap aria-hidden="true" /> Power <strong>{rec && s.phase === 'recovery' ? (rec.power_on ? 'on' : 'off') : (mech?.power_down ? 'off' : 'on')}</strong></div>
        <div><Construction aria-hidden="true" /> Blocked roads <strong>{Object.values(s.zones).filter((z) => z.road_blocked || z.road_flooded).length}</strong></div>
        {rec && s.phase === 'recovery' && (
          <>
            <div><Thermometer aria-hidden="true" /> Disease risk <strong>{rec.disease_risk}/100</strong></div>
            <div><Droplets aria-hidden="true" /> Clean water <strong>{rec.clean_water_active ? 'running' : 'not yet'}</strong> <span className="muted small">contamination {rec.water_contamination ?? 0}</span></div>
            <div><HeartPulse aria-hidden="true" /> Medical camp <strong>{rec.medical_camp_active ? 'open' : 'not yet'}</strong> <span className="muted small">{rec.illness_untreated} untreated</span></div>
          </>
        )}
        {rec && <div><Users aria-hidden="true" /> Community trust <strong>{rec.community_trust}/100</strong></div>}
        <div className={(s.lost_total ?? 0) ? 'depleted' : ''}><Users aria-hidden="true" /> People lost <strong>{s.lost_total ?? 0}</strong></div>
      </div>
    </div>
  );
};
