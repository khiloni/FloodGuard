import React, { useCallback, useEffect, useRef } from 'react';
import { tr } from '../lib/i18n';
import { ChevronLeft, ChevronRight } from './icons';

export interface PageDef { id: string; label: string; icon?: React.ReactNode; content: React.ReactNode }

/**
 * Two-page horizontal slide: pages sit side by side in a track that slides with a transform.
 * Navigation: numbered tabs (with a sliding highlight), arrows + dots, swipe on touch screens,
 * and ArrowLeft/ArrowRight on the keyboard (ignored while typing in a field).
 * Swipes that start inside [data-noswipe] (the map, sliders) are ignored.
 */
export const Pager: React.FC<{ pages: PageDef[]; index: number; onIndex: (i: number) => void; reduced: boolean }> = ({ pages, index, onIndex, reduced }) => {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const go = useCallback((i: number) => onIndex(Math.max(0, Math.min(pages.length - 1, i))), [onIndex, pages.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [data-noswipe]'))) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') { go(index + 1); }
      if (e.key === 'ArrowLeft') { go(index - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement).closest('[data-noswipe], input, textarea, select')) return;
    start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - s.t < 800) go(index + (dx < 0 ? 1 : -1));
  };

  return (
    <div className="pager">
      <div className="pager-nav" role="tablist" aria-label={tr('Pages')}>
        <span className="pill-glider" style={{ transform: `translateX(${index * 100}%)` }} aria-hidden="true" />
        {pages.map((p, i) => (
          <button key={p.id} role="tab" id={`tab-${p.id}`} aria-selected={index === i} aria-controls={`page-${p.id}`}
            tabIndex={index === i ? 0 : -1} className={`pager-tab${index === i ? ' on' : ''}`} onClick={() => go(i)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault(); e.stopPropagation();
                const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + pages.length) % pages.length;
                go(n); document.getElementById(`tab-${pages[n].id}`)?.focus();
              }
            }}
            data-testid={`tab-${p.id}`}>
            <span className="pager-num">{i + 1}.</span> {p.icon} <span>{p.label}</span>
          </button>
        ))}
      </div>
      <div className="pager-viewport" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { start.current = null; }}>
        <div className={`pager-track${reduced ? ' no-anim' : ''}`} style={{ transform: `translateX(-${index * (100 / pages.length)}%)`, width: `${pages.length * 100}%` }}>
          {pages.map((p, i) => (
            <section key={p.id} id={`page-${p.id}`} role="tabpanel" aria-labelledby={`tab-${p.id}`} className="pager-page"
              style={{ width: `${100 / pages.length}%` }} aria-hidden={index !== i} {...(index !== i ? { inert: '' } : {})}
              data-testid={`page-${p.id}`}>
              {p.content}
            </section>
          ))}
        </div>
      </div>
      <div className="pager-foot">
        <button className="btn icon ghost" onClick={() => go(index - 1)} disabled={index === 0} aria-label={tr('Previous page')} data-testid="page-prev">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="dots" aria-hidden="true">
          {pages.map((p, i) => <span key={p.id} className={i === index ? 'dot on' : 'dot'} onClick={() => go(i)} />)}
        </div>
        <span className="sr-only" aria-live="polite">Page {index + 1} of {pages.length}: {pages[index].label}</span>
        <button className="btn icon ghost" onClick={() => go(index + 1)} disabled={index === pages.length - 1} aria-label={tr('Next page')} data-testid="page-next">
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
