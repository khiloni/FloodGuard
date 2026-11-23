import { useEffect, useState } from 'react';

const KEY = 'floodguard.reducedMotion';

function readStored(): boolean | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === null ? null : v === '1';
  } catch {
    return null;
  }
}

/** Reduced motion follows the OS setting unless the player overrides it in the header. */
export function useReducedMotion(): [boolean, (v: boolean) => void] {
  const query = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const [system, setSystem] = useState<boolean>(query?.matches ?? false);
  const [override, setOverride] = useState<boolean | null>(readStored);

  useEffect(() => {
    if (!query) return;
    const fn = (e: MediaQueryListEvent) => setSystem(e.matches);
    query.addEventListener?.('change', fn);
    return () => query.removeEventListener?.('change', fn);
  }, [query]);

  const set = (v: boolean) => {
    setOverride(v);
    try { window.localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
  };
  return [override ?? system, set];
}
