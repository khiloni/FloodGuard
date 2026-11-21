# FloodGuard: Educational Flood-Response Story Simulator

> **IMPORTANT SIMULATION NOTICE**
> This software is an educational simulation game designed for learning preparedness concepts. It is not an operational flood forecast or emergency guidance system. In any real emergency in India, contact official disaster response authorities immediately at 112 (National Emergency Helpline) or 1078 (Disaster Management Helpline).

## Overview
FloodGuard is an open-source, interactive simulation where players make critical decisions to protect a community facing an escalating river flood.

## Core Architecture
- **Engine**: Pure, deterministic, state-machine simulation.
- **Backend**: FastAPI with rule-based action parsing, guardrails, and template narration.
- **Frontend**: Lightweight React/TypeScript dashboard with accessibility and offline-mock capability.
- **License**: Apache-2.0.

## Running Locally

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 10000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
