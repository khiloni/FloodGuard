import React from 'react';
import { ScoreBreakdown, TurnEvent, State, RuleCard } from '../types/api';

interface Props {
  score: ScoreBreakdown;
  state: State;
  events: TurnEvent[];
  citedCards: RuleCard[];
  onPlayAgain: () => void;
}

export const ReportScreen: React.FC<Props> = ({
  score,
  state,
  events,
  citedCards,
  onPlayAgain,
}) => {
  const getScoreRating = (s: number) => {
    if (s >= 80) return { label: 'EXCELLENT RESILIENCE', color: 'rating-high' };
    if (s >= 50) return { label: 'MODERATE PREPAREDNESS', color: 'rating-med' };
    return { label: 'CRITICAL VULNERABILITY', color: 'rating-low' };
  };

  const rating = getScoreRating(score.total_score);

  return (
    <div className="report-container">
      <div className="report-header">
        <h1>Incident After-Action Assessment Report</h1>
        <p className="report-subtitle">
          Comprehensive evaluation of community flood protection decisions, evacuation velocity, and
          logistical resource deployment.
        </p>
      </div>

      {/* Hero Score Gauge */}
      <div className="score-hero-card">
        <div className="score-circle">
          <span className="score-number">{score.total_score}</span>
          <span className="score-out-of">/ 100</span>
        </div>
        <div className="score-meta">
          <span className={`rating-pill ${rating.color}`}>{rating.label}</span>
          <p className="score-description">
            Simulation concluded at tick {state.tick}. {score.details.total_safe} residents safely evacuated
            to shelters with {score.details.total_lost} casualties recorded.
          </p>
        </div>
      </div>

      {/* Component Breakdown Cards */}
      <div className="score-breakdown-grid">
        <div className="breakdown-card">
          <div className="breakdown-title-row">
            <span>Residents Safe</span>
            <strong>{score.residents_safe_score} / 40</strong>
          </div>
          <div className="mini-progress-track">
            <div
              className="mini-progress-bar"
              style={{ width: `${(score.residents_safe_score / 40) * 100}%` }}
            />
          </div>
          <small>Proportion of threatened villagers evacuated before severe inundation.</small>
        </div>

        <div className="breakdown-card">
          <div className="breakdown-title-row">
            <span>Vulnerable Protected</span>
            <strong>{score.vulnerable_protected_score} / 25</strong>
          </div>
          <div className="mini-progress-track">
            <div
              className="mini-progress-bar"
              style={{ width: `${(score.vulnerable_protected_score / 25) * 100}%` }}
            />
          </div>
          <small>Elderly, infants, and persons with mobility constraints prioritized.</small>
        </div>

        <div className="breakdown-card">
          <div className="breakdown-title-row">
            <span>Response Time</span>
            <strong>{score.response_time_score} / 15</strong>
          </div>
          <div className="mini-progress-track">
            <div
              className="mini-progress-bar"
              style={{ width: `${(score.response_time_score / 15) * 100}%` }}
            />
          </div>
          <small>Timely issuance of early warnings and evacuation alerts.</small>
        </div>

        <div className="breakdown-card">
          <div className="breakdown-title-row">
            <span>Resource Efficiency</span>
            <strong>{score.resource_efficiency_score} / 10</strong>
          </div>
          <div className="mini-progress-track">
            <div
              className="mini-progress-bar"
              style={{ width: `${(score.resource_efficiency_score / 10) * 100}%` }}
            />
          </div>
          <small>Effective utilization of rescue boats, trucks, and high school shelter.</small>
        </div>

        <div className="breakdown-card">
          <div className="breakdown-title-row">
            <span>Infrastructure Preserved</span>
            <strong>{score.infrastructure_preserved_score} / 10</strong>
          </div>
          <div className="mini-progress-track">
            <div
              className="mini-progress-bar"
              style={{ width: `${(score.infrastructure_preserved_score / 10) * 100}%` }}
            />
          </div>
          <small>Embankment bund reinforcement and integrity maintenance.</small>
        </div>
      </div>

      {/* Educational Rule Cards Section */}
      <div className="rulecards-review-section">
        <h2>Key Preparedness Principles Applied</h2>
        <div className="rulecards-grid">
          {citedCards && citedCards.length > 0 ? (
            citedCards.map((rc) => (
              <div key={rc.id} className="rulecard-item">
                <span className="rc-category">{rc.category}</span>
                <h3>{rc.title}</h3>
                <p>{rc.guidance}</p>
                <small className="rc-source">Source: {rc.source_reference}</small>
              </div>
            ))
          ) : (
            <div className="rulecard-item">
              <span className="rc-category">General</span>
              <h3>Early Multi-Stakeholder Action</h3>
              <p>
                Evacuate lowlands before road routes become submerged. Wheeled vehicles stall in water
                depths above 30 cm, making early motorized boat deployment critical.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Emergency Reminder Box */}
      <div className="disclaimer-reminder-box">
        <strong>Important Emergency Disclaimer:</strong> This score measures simulation gameplay actions
        and is not an assessment of real-world readiness or hydrological forecast. In a real flood emergency,
        always call <strong>112</strong> and heed instructions from National & State Disaster Authorities.
      </div>

      {/* Restart Simulation Action */}
      <div className="report-action-bar">
        <button className="btn btn-primary btn-large" onClick={onPlayAgain}>
          Run Another Incident Scenario
        </button>
      </div>
    </div>
  );
};
