import React, { useState } from 'react';

interface Props {
  onStart: (scenarioId: string, difficulty: string, language: string) => void;
  isLoading: boolean;
}

export const SetupScreen: React.FC<Props> = ({ onStart, isLoading }) => {
  const [scenario, setScenario] = useState('village-river-01');
  const [difficulty, setDifficulty] = useState('standard');
  const [language, setLanguage] = useState('en');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(scenario, difficulty, language);
  };

  return (
    <div className="setup-container">
      <div className="setup-hero">
        <div className="logo-badge">🌊 FloodGuard</div>
        <h1>Community Flood Resilience Simulation</h1>
        <p className="hero-subtitle">
          Test your decision-making under escalating monsoon river flood conditions. Protect citizens,
          prioritize vulnerable families, and manage vital logistics before waters peak.
        </p>
      </div>

      <div className="setup-card">
        <h2>Scenario Configuration</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="scenario-select">Select Scenario</label>
            <select
              id="scenario-select"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              <option value="village-river-01">
                village-river-01: Riverbank Village Alert (3 Wards, 24 Ticks)
              </option>
            </select>
            <span className="field-hint">
              Lowland settlements, rising tributary, 400 sandbags, 2 rescue boats & 3 transport trucks.
            </span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="difficulty-select">Difficulty</label>
              <select
                id="difficulty-select"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="standard">Standard (Realistic Hydrology)</option>
                <option value="guided">Guided (Extended Lead Time)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="lang-select">Language</label>
              <select
                id="lang-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English (Official Pack)</option>
              </select>
            </div>
          </div>

          <div className="action-row">
            <button
              type="submit"
              className="btn btn-primary btn-large btn-block"
              disabled={isLoading}
            >
              {isLoading ? 'Initializing Simulation...' : 'Commence Incident Response'}
            </button>
          </div>
        </form>
      </div>

      <div className="scenario-brief">
        <h3>Operational Briefing</h3>
        <ul>
          <li><strong>River Basin:</strong> Heavy rainfall in upper catchment area.</li>
          <li><strong>Assets:</strong> 2 Motorized Inflatable Rescue Boats, 3 Cargo Transport Trucks, 1 Elevated High School Shelter (Cap: 320).</li>
          <li><strong>Defense:</strong> Earthen Bund at 380 cm elevation with 400 Sandbags in reserve.</li>
        </ul>
      </div>
    </div>
  );
};
