---
title: FloodGuard
emoji: 🌊
colorFrom: blue
colorTo: green
sdk: docker
app_port: 10000
pinned: false
short_description: Educational flood-response story simulation (not emergency guidance)
---

# FloodGuard

An educational flood-response story simulation. **Not emergency guidance**: in a real emergency in India
call **112** or the disaster helpline **1078** and follow your local authorities.

This Space is built from the project's `Dockerfile`. The simulation engine decides what happens; the LLM only
describes it, and the simulator falls back to template text when no model key is set.

Settings used by this Space:

- Variables: `LLM_MODE=openai_compat`, `LLM_PROVIDER=cloudflare`
- Secrets: `CF_ACCOUNT_ID`, `CF_API_TOKEN`

Sessions are stored in SQLite inside the container and are cleared when the Space restarts.
