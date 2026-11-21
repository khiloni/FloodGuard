# FloodGuard Architecture Overview

## The One Golden Rule
**The engine decides what happens. The API moves data. The LLM only describes.**

```
frontend/ (React + Vite + TypeScript)
    │  HTTP /api/v1 (JSON, OpenAPI contract)
    ▼
backend/app/api/ (routing, serialization, CORS)
    ▼
backend/app/services/ (turn orchestration: parse -> validate -> step -> narrate -> guard)
    │        ├── guardrail/ (tone, emergency detector, facts validation)
    │        ├── rag/ (in-memory BM25 over verified rule cards)
    │        └── llm/ (template-based narration & optional open-weights adapter)
    ▼
backend/app/engine/ (pure deterministic simulation state machine)
    ▲
scenarios/*.yaml (declarative scenario definitions, hydrology curves)
    ▼
backend/app/store/ (SQLite persistence & deterministic session replay)
```

## Layer Separation and Boundaries
1. **`engine/`**: Pure Python. Zero network, database, or LLM imports. Immutable state transitions: `step(state, action, rng) -> (new_state, events)`.
2. **`services/`**: Coordinates player action resolution (rule-based parser), guardrail checks, narration generation, and educational rulecard citations.
3. **`guardrail/`**: Multi-layer safety: real-emergency phrase detection, vocabulary tone check, and numerical fact verification.
4. **`frontend/`**: Accessible, lightweight React dashboard with live gauges, zone cards, action triggers, and persistent emergency disclosures.
