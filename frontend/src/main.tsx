import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

async function start() {
  // Mock Service Worker only in `vite --mode mock`. The condition is a build-time constant,
  // so production builds drop this branch and never bundle src/mocks.
  if (import.meta.env.MODE === 'mock') {
    const { startMocks } = await import('./mocks/browser');
    await startMocks();
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

start();
