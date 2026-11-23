import React from 'react';
import type { Meta, Phase } from '../api/types';
import { Bot, FileText, Eye, EyeOff } from './icons';

export const PHASE_LABEL: Record<Phase, string> = {
  before: 'Before the flood',
  flood: 'During the flood',
  recovery: 'After the flood',
};

export const Header: React.FC<{
  meta: Meta | null;
  phase?: Phase;
  tick?: number;
  maxTicks?: number;
  reduced: boolean;
  onToggleReduced: (v: boolean) => void;
}> = ({ meta, phase, tick, maxTicks, reduced, onToggleReduced }) => {
  const llmOn = meta?.llm_mode === 'openai_compat';
  return (
    <header className="app-header">
      <div className="brand">
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <rect width="32" height="32" rx="6" fill="#0072B2" /><path d="M4 20c4-4 8 4 12 0s8 4 12 0v8H4z" fill="#56B4E9" /><path d="M8 15l8-7 8 7v3H8z" fill="#fff" />
        </svg>
        <span className="brand-name">FloodGuard</span>
        <span className="brand-sub">educational simulation</span>
      </div>
      {phase && (
        <div className={`phase-chip phase-${phase}`} data-testid="phase-chip">
          <span className="phase-dot" aria-hidden="true" />{PHASE_LABEL[phase]}
          {typeof tick === 'number' && <span className="tick" data-testid="header-tick"> · tick {tick}/{maxTicks}</span>}
        </div>
      )}
      <div className="header-tools">
        <span className={`badge ${llmOn ? 'badge-ai' : 'badge-template'}`} data-testid="llm-badge"
          title={llmOn ? `Open-source LLM narration (${meta?.llm_status})` : 'Narration from fixed templates'}>
          {llmOn ? <Bot aria-hidden="true" /> : <FileText aria-hidden="true" />}
          {llmOn ? `AI narration on${meta?.llm_status && meta.llm_status !== 'online' ? ` (${meta.llm_status})` : ''}` : 'AI narration off'}
        </span>
        <button className="btn ghost small" aria-pressed={reduced} onClick={() => onToggleReduced(!reduced)} data-testid="reduced-toggle">
          {reduced ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          {reduced ? 'Motion reduced' : 'Reduce motion'}
        </button>
      </div>
    </header>
  );
};
