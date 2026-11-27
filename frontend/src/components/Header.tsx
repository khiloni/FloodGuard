import React from 'react';
import type { Meta, Phase } from '../api/types';
import { Bot, FileText, Eye, EyeOff, ArrowLeft, MessagesSquare } from './icons';
import { useLang } from '../lib/i18n';
import { canSpeak } from '../lib/voice';
import { Logo } from './Logo';

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
  scenarioName?: string;
  onHome?: () => void;
  onToggleReduced: (v: boolean) => void;
  readAloud?: boolean;
  onToggleReadAloud?: (v: boolean) => void;
}> = ({ meta, phase, tick, maxTicks, reduced, scenarioName, onHome, onToggleReduced, readAloud, onToggleReadAloud }) => {
  const { t } = useLang();
  const llmOn = meta?.llm_mode === 'openai_compat';
  return (
    <header className="app-header">
      <div className="brand">
        {onHome && <button className="btn icon ghost small" onClick={onHome} aria-label="Back to the story list" data-testid="home"><ArrowLeft aria-hidden="true" /></button>}
        <Logo size={26} />
        <span className="brand-name">FloodGuard</span>
        {scenarioName ? <span className="brand-sub scenario-name">{scenarioName}</span> : <span className="brand-sub">educational simulation</span>}
      </div>
      {phase && (
        <div className={`phase-chip phase-${phase}`} data-testid="phase-chip">
          <span className="phase-dot" aria-hidden="true" />{t(phase)}
          {typeof tick === 'number' && <span className="tick" data-testid="header-tick"> · tick {tick}/{maxTicks}</span>}
        </div>
      )}
      <div className="header-tools">
        <span className={`badge ${llmOn ? 'badge-ai' : 'badge-template'}`} data-testid="llm-badge"
          title={llmOn ? `Open-source LLM narration (${meta?.llm_status})` : 'Narration from fixed templates'}>
          {llmOn ? <Bot aria-hidden="true" /> : <FileText aria-hidden="true" />}
          <span>{llmOn ? `${t('aiOn')}${meta?.llm_status && meta.llm_status !== 'online' ? ` (${meta.llm_status})` : ''}` : t('aiOff')}</span>
        </span>
        {onToggleReadAloud && canSpeak() && (
          <button className="btn ghost small" aria-pressed={!!readAloud} onClick={() => onToggleReadAloud(!readAloud)} data-testid="read-aloud-toggle"
            title="Voice assistant: read the story aloud">
            <MessagesSquare aria-hidden="true" /><span className="hide-sm">{readAloud ? t('reading') : t('readAloud')}</span>
          </button>
        )}
        <button className="btn ghost small" aria-pressed={reduced} onClick={() => onToggleReduced(!reduced)} data-testid="reduced-toggle">
          {reduced ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          <span className="hide-sm">{reduced ? t('motionReduced') : t('reduceMotion')}</span>
        </button>
      </div>
    </header>
  );
};
