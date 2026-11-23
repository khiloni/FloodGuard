import React, { useEffect, useRef, useState } from 'react';
import type { Action, Layout, Phase } from '../api/types';
import { ACTIONS, GROUP_LABELS, NPCS, isAvailable, unavailableReason, type ActionMeta } from '../lib/actions';

interface Props {
  layout: Layout;
  phase: Phase;
  busy: boolean;
  onSubmit: (a: Action) => void;
  onHint: (text: string) => void;
}

export const ActionPanel: React.FC<Props> = ({ layout, phase, busy, onSubmit, onHint }) => {
  const [picking, setPicking] = useState<ActionMeta | null>(null);
  const groups = (['move', 'protect', 'recover', 'other'] as const).map((g) => ({ g, items: ACTIONS.filter((a) => a.group === g) }));

  const click = (meta: ActionMeta) => {
    if (busy) return;
    if (!isAvailable(meta, phase)) {
      onHint(`${meta.label}: ${unavailableReason(meta)}`);
      return;
    }
    const needsPicker = meta.params.some((p) => p !== 'shelter');
    if (!needsPicker) {
      const params: Record<string, unknown> = meta.params.includes('shelter') ? { shelter_id: layout.shelters[0]?.id ?? 'school' } : {};
      onSubmit({ name: meta.name, params });
      return;
    }
    setPicking(meta);
  };

  return (
    <section className="actions" aria-label="Actions">
      <h2 className="panel-title">Your orders</h2>
      {groups.map(({ g, items }) => (
        <div key={g} className={`action-group group-${g}`}>
          <h3>{GROUP_LABELS[g]}</h3>
          <div className="action-grid">
            {items.map((meta) => {
              const ok = isAvailable(meta, phase);
              const Icon = meta.icon;
              return (
                <button key={meta.name} type="button" className={`action-btn${ok ? '' : ' unavailable'}`}
                  aria-disabled={busy} title={ok ? meta.help : `${meta.help} ${unavailableReason(meta)}`}
                  aria-label={`${meta.label}${ok ? '' : ' (not available now)'}`}
                  onClick={() => click(meta)} data-testid={`action-${meta.name}`}>
                  <Icon aria-hidden="true" />
                  <span>{meta.short}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {picking && (
        <ParamPicker meta={picking} layout={layout} onCancel={() => setPicking(null)}
          onConfirm={(a) => { setPicking(null); onSubmit(a); }} />
      )}
    </section>
  );
};

const ParamPicker: React.FC<{ meta: ActionMeta; layout: Layout; onCancel: () => void; onConfirm: (a: Action) => void }> = ({ meta, layout, onCancel, onConfirm }) => {
  const [zone, setZone] = useState(layout.zones[0]?.id ?? 'ward-1');
  const [ttype, setTtype] = useState<'boat' | 'vehicle'>('boat');
  const [count, setCount] = useState(1);
  const [bags, setBags] = useState(100);
  const [npc, setNpc] = useState('village_head');
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
    if (meta.params.includes('transport')) { p.transport_type = ttype; p.count = count; }
    if (meta.params.includes('sandbags')) p.sandbags = bags;
    if (meta.params.includes('npc')) { p.npc_id = npc; if (msg.trim()) p.user_message = msg.trim(); }
    return { name: meta.name, params: p };
  };

  return (
    <div className="picker" role="dialog" aria-label={`Choose details: ${meta.label}`} ref={ref} data-testid="param-picker">
      <h3>{meta.label}</h3>
      <p className="muted">{meta.help}</p>
      <form onSubmit={(e) => { e.preventDefault(); onConfirm(build()); }}>
        {meta.params.includes('zone') && (
          <fieldset><legend>Ward</legend>
            {layout.zones.map((z) => (
              <label key={z.id} className="radio"><input type="radio" name="zone" value={z.id} checked={zone === z.id} onChange={() => setZone(z.id)} />{z.name}</label>
            ))}
          </fieldset>
        )}
        {meta.params.includes('transport') && (
          <fieldset><legend>Transport</legend>
            <label className="radio"><input type="radio" name="tt" checked={ttype === 'boat'} onChange={() => setTtype('boat')} />Boats</label>
            <label className="radio"><input type="radio" name="tt" checked={ttype === 'vehicle'} onChange={() => setTtype('vehicle')} />Trucks</label>
            <label className="inline">How many <select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select></label>
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
            {Object.entries(NPCS).map(([id, n]) => (
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
