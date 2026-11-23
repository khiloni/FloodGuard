import React, { useEffect, useRef, useState } from 'react';
import type { Action, Layout, Phase } from '../api/types';
import { GROUP_LABELS, actionsFor, isAvailable, npcs, unavailableReason, type ActionMeta } from '../lib/actions';

interface Props {
  layout: Layout;
  phase: Phase;
  busy: boolean;
  mechanic?: string;
  onSubmit: (a: Action) => void;
  onHint: (text: string) => void;
}

const GROUPS = ['move', 'protect', 'recover', 'other'] as const;
const SHORT_GROUP: Record<(typeof GROUPS)[number], string> = { move: 'Move people', protect: 'Protect', recover: 'Recover', other: 'Talk / other' };

export const ActionPanel: React.FC<Props> = ({ layout, phase, busy, mechanic, onSubmit, onHint }) => {
  const [picking, setPicking] = useState<ActionMeta | null>(null);
  const [group, setGroup] = useState<(typeof GROUPS)[number]>(phase === 'recovery' ? 'recover' : 'move');
  useEffect(() => { if (phase === 'recovery') setGroup('recover'); }, [phase]);
  const all = actionsFor(mechanic);

  const click = (meta: ActionMeta) => {
    if (busy) return;
    if (!isAvailable(meta, phase)) {
      onHint(`${meta.label}: ${unavailableReason(meta)}`);
      return;
    }
    const needsPicker = meta.params.some((p) => p !== 'shelter') || (meta.params.includes('shelter') && layout.shelters.length > 1);
    if (!needsPicker) {
      const params: Record<string, unknown> = meta.params.includes('shelter') ? { shelter_id: layout.shelters[0]?.id ?? 'school' } : {};
      onSubmit({ name: meta.name, params });
      return;
    }
    setPicking(meta);
  };

  const waitMeta = all.find((a) => a.name === 'wait');
  const items = all.filter((a) => a.group === group && a.name !== 'wait');
  return (
    <section className="actions" aria-label="Orders">
      <div className="group-tabs" role="tablist" aria-label="Order groups">
        {GROUPS.map((g) => (
          <button key={g} role="tab" aria-selected={group === g} className={group === g ? 'on' : ''} onClick={() => setGroup(g)}
            title={GROUP_LABELS[g]} data-testid={`group-${g}`}>{SHORT_GROUP[g]}</button>
        ))}
        {waitMeta && (
          <button type="button" className="wait-btn" aria-disabled={busy} onClick={() => click(waitMeta)} title={waitMeta.help} data-testid="action-wait">
            <waitMeta.icon aria-hidden="true" /> Wait a turn
          </button>
        )}
      </div>
      <div className="action-grid" role="tabpanel" aria-label={GROUP_LABELS[group]}>
        {items.map((meta) => {
          const ok = isAvailable(meta, phase);
          const Icon = meta.icon;
          return (
            <button key={meta.name} type="button" className={`action-btn${ok ? '' : ' unavailable'}${meta.mechanic ? ' special' : ''}`}
              aria-disabled={busy} title={ok ? meta.help : `${meta.help} ${unavailableReason(meta)}`}
              aria-label={`${meta.label}${ok ? '' : ' (not available now)'}`}
              onClick={() => click(meta)} data-testid={`action-${meta.name}`}>
              <Icon aria-hidden="true" />
              <span>{meta.short}</span>
            </button>
          );
        })}
      </div>
      {picking && (
        <ParamPicker meta={picking} layout={layout} onCancel={() => setPicking(null)}
          onConfirm={(a) => { setPicking(null); onSubmit(a); }} />
      )}
    </section>
  );
};

export const ParamPicker: React.FC<{ meta: ActionMeta; layout: Layout; initial?: Record<string, unknown>; onCancel: () => void; onConfirm: (a: Action) => void }> = ({ meta, layout, initial = {}, onCancel, onConfirm }) => {
  const [zone, setZone] = useState(String(initial.zone ?? layout.zones[0]?.id ?? ''));
  const [shelter, setShelter] = useState(String(initial.shelter_id ?? layout.shelters[0]?.id ?? ''));
  const [ttype, setTtype] = useState<'boat' | 'vehicle'>((initial.transport_type as 'boat' | 'vehicle') ?? 'boat');
  const [count, setCount] = useState(Number(initial.count ?? 1));
  const [bags, setBags] = useState(Number(initial.sandbags ?? 100));
  const roster = npcs();
  const [npc, setNpc] = useState(String(initial.npc_id ?? Object.keys(roster)[0]));
  const [msg, setMsg] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, select, button')?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCancel]);

  const build = (): Action => {
    const p: Record<string, unknown> = {};
    if (meta.params.includes('zone')) p.zone = zone;
    if (meta.params.includes('shelter')) p.shelter_id = shelter;
    if (meta.params.includes('transport')) { p.transport_type = ttype; p.count = count; }
    if (meta.params.includes('sandbags')) p.sandbags = bags;
    if (meta.params.includes('npc')) { p.npc_id = npc; if (msg.trim()) p.user_message = msg.trim(); }
    return { name: meta.name, params: p };
  };

  return (
    <div className="picker" role="dialog" aria-label={`Choose details: ${meta.label}`} ref={ref} data-testid="param-picker">
      <h3>{meta.label}</h3>
      <p className="muted small">{meta.help}</p>
      <form onSubmit={(e) => { e.preventDefault(); onConfirm(build()); }}>
        {meta.params.includes('zone') && (
          <fieldset><legend>Area</legend>
            {layout.zones.map((z) => (
              <label key={z.id} className="radio"><input type="radio" name="zone" value={z.id} checked={zone === z.id} onChange={() => setZone(z.id)} />{z.name}</label>
            ))}
          </fieldset>
        )}
        {meta.params.includes('shelter') && (
          <fieldset><legend>Shelter</legend>
            {layout.shelters.map((s) => (
              <label key={s.id} className="radio"><input type="radio" name="shelter" value={s.id} checked={shelter === s.id} onChange={() => setShelter(s.id)} />{s.name}</label>
            ))}
          </fieldset>
        )}
        {meta.params.includes('transport') && (
          <fieldset><legend>Transport</legend>
            <label className="radio"><input type="radio" name="tt" checked={ttype === 'boat'} onChange={() => setTtype('boat')} />Boats</label>
            <label className="radio"><input type="radio" name="tt" checked={ttype === 'vehicle'} onChange={() => setTtype('vehicle')} />Trucks</label>
            <label className="inline">How many <select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></label>
          </fieldset>
        )}
        {meta.params.includes('sandbags') && (
          <fieldset><legend>Sandbags</legend>
            {[100, 200, 300, 400].map((n) => (
              <label key={n} className="radio"><input type="radio" name="bags" checked={bags === n} onChange={() => setBags(n)} />{n}</label>
            ))}
          </fieldset>
        )}
        {meta.params.includes('npc') && (
          <fieldset><legend>Who</legend>
            {Object.entries(roster).map(([id, n]) => (
              <label key={id} className="radio"><input type="radio" name="npc" checked={npc === id} onChange={() => setNpc(id)} />{n.name} <span className="muted">({n.role})</span></label>
            ))}
            <label className="stack">Your question (optional)
              <input type="text" maxLength={300} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="What should we do now?" />
            </label>
          </fieldset>
        )}
        <div className="picker-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn primary" data-testid="picker-confirm">Give the order</button>
        </div>
      </form>
    </div>
  );
};
