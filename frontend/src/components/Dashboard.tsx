import React, { useState } from 'react';
import { State, TurnResponse, TurnEvent, Action, ActionName } from '../types/api';

interface Props {
  state: State;
  events: TurnEvent[];
  narration: string;
  npcDialogue: Array<{ npc_id: string; text: string; source: string }>;
  clarify: { question: string; options: Action[] } | null;
  rejectReason: string | null;
  realEmergency: boolean;
  isLoading: boolean;
  onTakeAction: (input: any) => void;
  onEndSession: () => void;
}

export const Dashboard: React.FC<Props> = ({
  state,
  events,
  narration,
  npcDialogue,
  clarify,
  rejectReason,
  realEmergency,
  isLoading,
  onTakeAction,
  onEndSession,
}) => {
  const [freeText, setFreeText] = useState('');
  const [selectedNpc, setSelectedNpc] = useState<string | null>(null);

  // Quick Action Modal state
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [targetZone, setTargetZone] = useState('ward-1');
  const [transportType, setTransportType] = useState('boat');
  const [transportCount, setTransportCount] = useState(1);
  const [sandbagsCount, setSandbagsCount] = useState(100);

  const handleFreeTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeText.trim() || isLoading) return;
    onTakeAction({ type: 'text', text: freeText.trim() });
    setFreeText('');
  };

  const executeButtonAction = (name: ActionName, params: Record<string, any> = {}) => {
    setActiveModal(null);
    onTakeAction({
      type: 'button',
      action: { name, params },
    });
  };

  const waterPercent = Math.min(100, Math.round((state.water_level_cm / 500) * 100));
  const embPercent = Math.min(100, Math.round((state.embankment.height_cm / 500) * 100));
  const isBreached = state.embankment.breached;

  return (
    <div className="dashboard-layout">
      {/* Real Emergency Banner */}
      {realEmergency && (
        <div className="real-emergency-banner" role="alert">
          <h2>🚨 REAL-LIFE EMERGENCY DETECTED</h2>
          <p>
            If you are in actual danger from flooding, stop playing now and call{' '}
            <strong>112</strong> immediately. Seek high ground and contact official local emergency
            responders.
          </p>
        </div>
      )}

      {/* Top Header Metrics */}
      <header className="dashboard-header">
        <div className="header-metric">
          <span className="metric-label">TIMELINE</span>
          <span className="metric-value">
            Tick {state.tick} / {state.max_ticks}{' '}
            <small className="time-sub">({state.tick * 30} mins elapsed)</small>
          </span>
        </div>

        <div className="header-metric">
          <span className="metric-label">RIVER LEVEL</span>
          <span className={`metric-value ${state.water_level_cm >= state.embankment.height_cm ? 'danger' : ''}`}>
            {state.water_level_cm} cm
          </span>
        </div>

        <div className="header-metric">
          <span className="metric-label">EMBANKMENT BUND</span>
          <span className={`metric-value ${isBreached ? 'danger' : ''}`}>
            {isBreached ? 'BREACHED (0%)' : `${state.embankment.height_cm} cm (${state.embankment.integrity}%)`}
          </span>
        </div>

        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={onEndSession} disabled={isLoading}>
            Conclude Incident
          </button>
        </div>
      </header>

      {/* Flood & Embankment Visual Meter */}
      <section className="water-meter-panel">
        <div className="meter-label-row">
          <span>River Flood Level: <strong>{state.water_level_cm} cm</strong></span>
          <span>Embankment Crest: <strong>{state.embankment.height_cm} cm</strong></span>
        </div>
        <div className="meter-track">
          <div
            className={`meter-bar water-bar ${state.water_level_cm > state.embankment.height_cm ? 'overtop' : ''}`}
            style={{ width: `${waterPercent}%` }}
          />
          <div
            className="embankment-line"
            style={{ left: `${embPercent}%` }}
            title={`Embankment Crest: ${state.embankment.height_cm} cm`}
          />
        </div>
      </section>

      {/* Resource Inventory Ribbon */}
      <section className="resources-ribbon">
        <div className="resource-pill">
          <span className="res-icon">🚤</span>
          <span className="res-info">
            Boats: <strong>{state.resources.available_boats}</strong> / {state.resources.total_boats}
          </span>
        </div>
        <div className="resource-pill">
          <span className="res-icon">🚚</span>
          <span className="res-info">
            Trucks: <strong>{state.resources.available_vehicles}</strong> / {state.resources.total_vehicles}
          </span>
        </div>
        <div className="resource-pill">
          <span className="res-icon">🧱</span>
          <span className="res-info">
            Sandbags: <strong>{state.resources.sandbags}</strong>
          </span>
        </div>
        <div className="resource-pill">
          <span className="res-icon">🏫</span>
          <span className="res-info">
            High School Shelter:{' '}
            <strong>
              {state.shelters.school.is_open
                ? `OPEN (${state.shelters.school.current_occupancy}/${state.shelters.school.capacity})`
                : 'LOCKED'}
            </strong>
          </span>
        </div>
      </section>

      {/* Main Grid: Zones, Story Feed, NPC Panel */}
      <div className="dashboard-grid">
        {/* Left Column: Zone Status Cards */}
        <section className="zones-column">
          <h2>Community Wards</h2>
          <div className="zones-list">
            {Object.values(state.zones).map((zone) => {
              const isFlooded = zone.water_depth_cm > 0;
              return (
                <div
                  key={zone.id}
                  className={`zone-card ${isFlooded ? 'zone-flooded' : ''} ${
                    zone.evacuation_ordered ? 'zone-evacuating' : ''
                  }`}
                >
                  <div className="zone-card-header">
                    <h3>{zone.name}</h3>
                    <span className="zone-elevation">Elev: {zone.elevation_cm} cm</span>
                  </div>

                  <div className="zone-stats-grid">
                    <div>
                      <small>Remaining</small>
                      <p className="stat-bold">{zone.population_remaining}</p>
                    </div>
                    <div>
                      <small>Safe</small>
                      <p className="stat-bold stat-safe">{zone.safe_evacuated}</p>
                    </div>
                    <div>
                      <small>Vulnerable</small>
                      <p className={`stat-bold ${zone.vulnerable_remaining > 0 && isFlooded ? 'danger' : ''}`}>
                        {zone.vulnerable_remaining}
                      </p>
                    </div>
                    <div>
                      <small>Water Depth</small>
                      <p className={`stat-bold ${isFlooded ? 'danger' : ''}`}>{zone.water_depth_cm} cm</p>
                    </div>
                  </div>

                  <div className="zone-badges">
                    {zone.road_flooded && <span className="badge badge-hazard">Road Submerged</span>}
                    {zone.evacuation_ordered && <span className="badge badge-active">Evac Order Active</span>}
                    {zone.prioritize_vulnerable && <span className="badge badge-info">Vulnerable Priority</span>}
                    {zone.boats_assigned > 0 && (
                      <span className="badge badge-transport">🚤 {zone.boats_assigned} Boats</span>
                    )}
                    {zone.vehicles_assigned > 0 && (
                      <span className="badge badge-transport">🚚 {zone.vehicles_assigned} Trucks</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Center Column: Narration Log & Turn Events */}
        <section className="feed-column">
          <h2>Incident Log & Narration</h2>

          {/* Current Turn Narration Card */}
          <div className="narration-card" aria-live="polite">
            <div className="narration-badge">SITUATION REPORT</div>
            <p className="narration-text">{narration}</p>
          </div>

          {/* Rejection / Warning Notice */}
          {rejectReason && (
            <div className="rejection-box" role="alert">
              <strong>Order Rejected:</strong> {rejectReason}
            </div>
          )}

          {/* Clarification Request Options (F2) */}
          {clarify && (
            <div className="clarify-card" role="region" aria-label="Action clarification">
              <h3>❓ {clarify.question}</h3>
              <div className="clarify-options">
                {clarify.options.map((opt, idx) => (
                  <button
                    key={idx}
                    className="btn btn-secondary btn-sm"
                    onClick={() => executeButtonAction(opt.name, opt.params)}
                  >
                    {opt.name.replace('_', ' ').toUpperCase()} {JSON.stringify(opt.params)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Events Timeline */}
          <div className="events-timeline" role="log" aria-label="Turn events log">
            <h3>Recent Field Events</h3>
            {events.length === 0 ? (
              <p className="empty-events">Awaiting operations for tick {state.tick + 1}...</p>
            ) : (
              <ul className="events-list">
                {events.map((ev, i) => (
                  <li key={i} className={`event-item event-${ev.type}`}>
                    <span className="event-bullet">•</span>
                    <span className="event-desc">{ev.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Right Column: NPC Consultation Panel */}
        <section className="npc-column">
          <h2>Advisory Council</h2>
          <div className="npc-cards-list">
            <div
              className={`npc-card ${selectedNpc === 'village_head' ? 'npc-active' : ''}`}
              onClick={() => setSelectedNpc('village_head')}
            >
              <div className="npc-avatar">👨‍🦳</div>
              <div className="npc-info">
                <strong>Sarpanch Ramesh</strong>
                <small>Village Representative</small>
              </div>
              <button
                className="btn btn-secondary btn-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  executeButtonAction(ActionName.CONSULT_NPC, { npc_id: 'village_head' });
                }}
              >
                Consult
              </button>
            </div>

            <div
              className={`npc-card ${selectedNpc === 'rescue_worker' ? 'npc-active' : ''}`}
              onClick={() => setSelectedNpc('rescue_worker')}
            >
              <div className="npc-avatar">👷‍♀️</div>
              <div className="npc-info">
                <strong>Officer Sunita</strong>
                <small>Civil Defence Coordinator</small>
              </div>
              <button
                className="btn btn-secondary btn-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  executeButtonAction(ActionName.CONSULT_NPC, { npc_id: 'rescue_worker' });
                }}
              >
                Consult
              </button>
            </div>

            <div
              className={`npc-card ${selectedNpc === 'family_member' ? 'npc-active' : ''}`}
              onClick={() => setSelectedNpc('family_member')}
            >
              <div className="npc-avatar">👨‍👩‍👧</div>
              <div className="npc-info">
                <strong>Mohan</strong>
                <small>Ward 1 Resident</small>
              </div>
              <button
                className="btn btn-secondary btn-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  executeButtonAction(ActionName.CONSULT_NPC, { npc_id: 'family_member' });
                }}
              >
                Consult
              </button>
            </div>
          </div>

          {/* Character Dialogue Box */}
          {npcDialogue.length > 0 && (
            <div className="npc-dialogue-feed">
              {npcDialogue.map((d, idx) => (
                <div key={idx} className="npc-speech-bubble">
                  <strong>{d.npc_id.replace('_', ' ').toUpperCase()}:</strong>
                  <p>"{d.text}"</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Control Strip: Action Buttons + Free Text Input */}
      <section className="control-strip">
        {/* Quick Action Button Palette */}
        <div className="action-buttons-palette">
          <button
            className="btn btn-action"
            onClick={() => setActiveModal('warn')}
            disabled={isLoading}
          >
            📢 Broadcast Warning
          </button>

          <button
            className="btn btn-action"
            onClick={() => setActiveModal('evacuate')}
            disabled={isLoading}
          >
            🏃 Order Evacuation
          </button>

          <button
            className="btn btn-action"
            onClick={() => setActiveModal('transport')}
            disabled={isLoading}
          >
            🚤 Dispatch Transport
          </button>

          <button
            className="btn btn-action"
            onClick={() => setActiveModal('vulnerable')}
            disabled={isLoading}
          >
            🛡️ Prioritize Vulnerable
          </button>

          <button
            className="btn btn-action"
            onClick={() => executeButtonAction(ActionName.OPEN_SHELTER, { shelter_id: 'school' })}
            disabled={isLoading || state.shelters.school.is_open}
          >
            🏫 {state.shelters.school.is_open ? 'Shelter Opened' : 'Open Shelter'}
          </button>

          <button
            className="btn btn-action"
            onClick={() => setActiveModal('reinforce')}
            disabled={isLoading || state.resources.sandbags < 100}
          >
            🧱 Reinforce Bund
          </button>

          <button
            className="btn btn-action btn-wait"
            onClick={() => executeButtonAction(ActionName.WAIT, {})}
            disabled={isLoading}
          >
            ⏳ Wait / Observe (30m)
          </button>
        </div>

        {/* Free Text Input (F2) */}
        <form className="free-text-form" onSubmit={handleFreeTextSubmit}>
          <input
            type="text"
            className="free-text-input"
            placeholder="Type orders (e.g., 'evacuate ward 1 and send 2 boats', 'reinforce bund with 200 sandbags')..."
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            disabled={isLoading}
            maxLength={400}
          />
          <button type="submit" className="btn btn-primary" disabled={isLoading || !freeText.trim()}>
            {isLoading ? 'Processing...' : 'Execute Order'}
          </button>
        </form>
      </section>

      {/* Action Configuration Modals */}
      {activeModal && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="action-modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {activeModal === 'warn' && 'Broadcast Early Warning'}
              {activeModal === 'evacuate' && 'Order Mandatory Evacuation'}
              {activeModal === 'transport' && 'Assign Transport Vehicles'}
              {activeModal === 'vulnerable' && 'Prioritize Vulnerable Evacuees'}
              {activeModal === 'reinforce' && 'Lay Sandbags to Reinforce Bund'}
            </h3>

            {/* Target Zone Selector */}
            {['warn', 'evacuate', 'transport', 'vulnerable'].includes(activeModal) && (
              <div className="form-group">
                <label>Target Ward:</label>
                <select value={targetZone} onChange={(e) => setTargetZone(e.target.value)}>
                  <option value="ward-1">Ward 1 (Lowland Riverside - Elev 220cm)</option>
                  <option value="ward-2">Ward 2 (Market Settlement - Elev 360cm)</option>
                  <option value="ward-3">Ward 3 (Highland Ridge - Elev 520cm)</option>
                </select>
              </div>
            )}

            {/* Transport Config */}
            {activeModal === 'transport' && (
              <>
                <div className="form-group">
                  <label>Transport Mode:</label>
                  <select value={transportType} onChange={(e) => setTransportType(e.target.value)}>
                    <option value="boat">Rescue Boat (Flooded watercraft, Cap 15)</option>
                    <option value="vehicle">Transport Truck (Roadway logistics, Cap 20)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity:</label>
                  <input
                    type="number"
                    min={1}
                    max={transportType === 'boat' ? state.resources.available_boats : state.resources.available_vehicles}
                    value={transportCount}
                    onChange={(e) => setTransportCount(parseInt(e.target.value) || 1)}
                  />
                </div>
              </>
            )}

            {/* Reinforce Config */}
            {activeModal === 'reinforce' && (
              <div className="form-group">
                <label>Sandbag Allotment:</label>
                <select
                  value={sandbagsCount}
                  onChange={(e) => setSandbagsCount(parseInt(e.target.value) || 100)}
                >
                  <option value={100}>100 Sandbags (+30 cm crest, +10% integrity)</option>
                  <option value={200}>200 Sandbags (+60 cm crest, +20% integrity)</option>
                  {state.resources.sandbags >= 300 && (
                    <option value={300}>300 Sandbags (+90 cm crest, +30% integrity)</option>
                  )}
                </select>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (activeModal === 'warn') {
                    executeButtonAction(ActionName.ISSUE_WARNING, { zone: targetZone });
                  } else if (activeModal === 'evacuate') {
                    executeButtonAction(ActionName.ORDER_EVACUATION, { zone: targetZone });
                  } else if (activeModal === 'transport') {
                    executeButtonAction(ActionName.ASSIGN_TRANSPORT, {
                      zone: targetZone,
                      transport_type: transportType,
                      count: transportCount,
                    });
                  } else if (activeModal === 'vulnerable') {
                    executeButtonAction(ActionName.PRIORITIZE_VULNERABLE, { zone: targetZone });
                  } else if (activeModal === 'reinforce') {
                    executeButtonAction(ActionName.REINFORCE_EMBANKMENT, { sandbags: sandbagsCount });
                  }
                }}
              >
                Confirm Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
