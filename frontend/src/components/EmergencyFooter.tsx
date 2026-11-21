import React from 'react';

export const EmergencyFooter: React.FC = () => {
  return (
    <footer className="emergency-footer" role="contentinfo">
      <div className="footer-content">
        <span className="emergency-badge">⚠️ NOTICE</span>
        <span className="footer-text">
          Educational simulation only. In a real emergency or flood threat in India, immediately dial{' '}
          <strong>112</strong> (National Emergency) or <strong>1078</strong> (Disaster Helpline).
        </span>
      </div>
    </footer>
  );
};
