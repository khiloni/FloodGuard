import React, { useEffect, useRef, useState } from 'react';
import { tr } from '../lib/i18n';
import { useLang } from '../lib/i18n';
import { Siren, Phone } from './icons';

/** Full disclaimer gate. Must be acknowledged with a checkbox before anything else is shown. */
export const DisclaimerGate: React.FC<{ onAcknowledge: () => void; serverDisclaimer?: string }> = ({ onAcknowledge, serverDisclaimer }) => {
  const [agreed, setAgreed] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="gate-title" data-testid="disclaimer-gate">
      <div className="card gate">
        <h1 id="gate-title" tabIndex={-1} ref={titleRef}>{tr('Before you start: this is a simulation')}</h1>
        <p><strong>{tr('This is an educational simulation, not emergency guidance.')}</strong> {tr('FloodGuard is a simplified teaching simulation. Its water levels, outcomes and scores are invented and are not a flood forecast or a real-world plan. Characters are fictional and AI-generated text can be wrong.')}</p>
        <p className="callout danger" role="note">
          <Siren aria-hidden="true" /> <span><strong>{tr('If you are in a real emergency or a flood is happening near you:')}</strong> {tr('stop playing now and call')} <strong>112</strong> ({tr('India emergency number')}) {tr('or')} <strong>1078</strong> ({tr('Disaster helpline')}). {tr('Follow your local authorities and official sources (IMD, CWC, your State Disaster Management Authority).')}</span>
        </p>
        <p>{tr('Do not rely on this simulation for decisions about evacuation, safety or health.')}</p>
        {serverDisclaimer && <details><summary>{tr('Full notice from the server')}</summary><p>{serverDisclaimer}</p></details>}
        <label className="check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} data-testid="gate-check" />
          <span>{tr('I understand that FloodGuard is an educational simulation and not real-world emergency guidance.')}</span>
        </label>
        <button className="btn primary big" disabled={!agreed} onClick={onAcknowledge} data-testid="gate-enter">{tr('Enter the simulation')}</button>
      </div>
    </div>
  );
};

/** Persistent footer, shown on every screen. */
export const EmergencyFooter: React.FC = () => {
  const { t } = useLang();
  return (
    <footer className="emergency-footer" role="contentinfo" data-testid="emergency-footer">
      <Phone aria-hidden="true" />
      <span>{t('footer')} <strong>112</strong> {t('footerOr')} <strong>1078</strong>.</span>
    </footer>
  );
};

/** Shown when the server's real-emergency detector fires. The simulation is paused behind it. */
export const RealEmergencyScreen: React.FC<{ message: string; onReturn: () => void }> = ({ message, onReturn }) => {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="overlay emergency" role="alertdialog" aria-modal="true" aria-labelledby="emg-title" aria-describedby="emg-msg" data-testid="real-emergency">
      <div className="card emergency-card">
        <h1 id="emg-title" tabIndex={-1} ref={ref}><Siren aria-hidden="true" /> {tr('Are you in real danger?')}</h1>
        <p id="emg-msg">{message}</p>
        <div className="helplines">
          <a className="helpline" href="tel:112">{tr('Call')} 112<small>{tr('India emergency number')}</small></a>
          <a className="helpline" href="tel:1078">{tr('Call')} 1078<small>{tr('Disaster helpline')}</small></a>
        </div>
        <p>{tr('The simulation is paused. FloodGuard cannot help in a real emergency.')}</p>
        <button className="btn" onClick={onReturn}>{tr('I am safe, return to the simulation')}</button>
      </div>
    </div>
  );
};

/** Cold start on free hosting can take up to a minute. */
export const WakingUp: React.FC<{ seconds: number; failed: boolean; onRetry: () => void }> = ({ seconds, failed, onRetry }) => (
  <div className="overlay" role="status" aria-live="polite" data-testid="waking-up">
    <div className="card waking">
      <div className="spinner" aria-hidden="true" />
      <h1>{failed ? tr('The server is not answering') : tr('Waking up the simulation server…')}</h1>
      <p>{failed
        ? tr('Please check your connection and try again.')
        : tr('Free hosting sleeps when idle; the first visit can take up to a minute ({s}s so far).', { s: seconds })}</p>
      {failed && <button className="btn primary" onClick={onRetry}>{tr('Try again')}</button>}
    </div>
  </div>
);
