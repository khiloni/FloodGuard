import React, { useState } from 'react';

interface Props {
  onAcknowledge: () => void;
  disclaimerText: string;
}

export const DisclaimerGate: React.FC<Props> = ({ onAcknowledge, disclaimerText }) => {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="gate-overlay" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="gate-card">
        <div className="gate-header">
          <div className="gate-icon">⚠️</div>
          <h1 id="gate-title">Simulation Notice & Safety Disclaimer</h1>
        </div>

        <div className="gate-body">
          <div className="disclaimer-callout">
            <p>
              <strong>This is an educational simulation, not emergency guidance.</strong> FloodGuard
              is a simplified teaching game. Its water levels, outcomes and scores are invented and
              are <strong>not</strong> a flood forecast or a real-world plan. Characters are
              fictional and AI-generated text can be wrong.
            </p>
            <p className="emergency-highlight">
              🚨 <strong>If you are in a real emergency or a flood is happening near you:</strong>{' '}
              Stop playing immediately and call <strong>112</strong> (India Emergency Helpline) or{' '}
              <strong>1078</strong> (National Disaster Helpline). Follow instructions from your
              local authorities and official agencies (IMD, CWC, SDMA).
            </p>
            <p>Do not rely on this game for decisions about evacuation, safety or health.</p>
          </div>

          <label className="checkbox-container">
            <input
              type="checkbox"
              id="disclaimer-check"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span className="checkbox-label">
              I understand that FloodGuard is an educational simulation game and not real-world emergency guidance.
            </span>
          </label>
        </div>

        <div className="gate-footer">
          <button
            className="btn btn-primary btn-large"
            disabled={!agreed}
            onClick={onAcknowledge}
          >
            Enter Simulation
          </button>
        </div>
      </div>
    </div>
  );
};
