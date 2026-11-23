# FloodGuard LLM Model Card

This document records the evaluation, provenance, and license details for the open-source Large Language Model selected for FloodGuard's local inference layer.

> **Gate A Selection**:
> Selected `Qwen2.5-1.5B-Instruct` (`qwen2.5:1.5b` in Ollama), licensed under **Apache-2.0** (OSI-approved). Non-OSI models (such as Llama Community License or Gemma) are excluded.

---

## 1. Model Details
- **Model Name / Identifier**: `Qwen2.5-1.5B-Instruct` (Ollama tag: `qwen2.5:1.5b`)
- **Organization / Developer**: Alibaba Cloud (Qwen Team)
- **Model Architecture**: Decoder-only Transformer
- **Parameter Count**: 1.5B parameters
- **Base License**: Apache License 2.0 (`Apache-2.0`)
- **Official Repository / Weights URL**: https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct
- **Inference Runtime Engine**: Ollama (MIT) / llama.cpp / vLLM

## 2. Intended Use in FloodGuard
- **Primary Function**:
  1. Educational turn narration: Voice simulation events in clear English.
  2. NPC dialogue: Roleplay as local community leaders and emergency volunteers.
  3. Fallback action parsing: Map ambiguous free-text phrases to engine actions when rule-based matching fails.
- **Out-of-Scope Use**:
  - The model **never** computes simulation outcomes, never scores the user, and never calculates water levels or flood spread.
  - The model must **never** be used for real-life disaster routing or operational flood emergency guidance.

## 3. Training Data & Alignment
- **Instruction Tuning**: Trained on multi-turn conversational instructions.
- **Safety Alignment**: Aligned with RLHF / DPO for factual adherence and refusal of malicious prompts.

## 4. Evaluation & Guardrail Verification (Gate A)
- [x] **License Check**: Verified `Apache-2.0` license on Hugging Face (`Qwen/Qwen2.5-1.5B-Instruct`).
- [x] **Number Grounding**: Verified via `pytest` (`GuardrailValidator` + `httpx.MockTransport` fake-HTTP tests) that invented integers, comma-formatted numbers (`50,000`), decimals (`10.5`), and negative numbers (`-5`) outside `facts_allowed` are blocked.
- [x] **Tone Compliance**: Verified via `pytest` (`tone.yaml`, markdown/URL, wrong-language, `"everyone survived"`, and prompt-leakage checks).
- [x] **Live Ollama Daemon Check**: Verified live against local Ollama daemon (`http://127.0.0.1:11434/v1`) with pulled `qwen2.5:1.5b` (`Apache-2.0`): `/api/v1/health` returned `llm_status: "online"`, turn narration & NPC reply returned `source: "llm"` (`guardrail.status: "passed"`, `retries: 0`), and unreachable endpoint silently fell back to `source: "template"` (`guardrail.status: "fallback"`, `fallback_reason: "endpoint_unavailable:ConnectError"`).

## 5. Deployment Configuration
- `LLM_MODE`: `openai_compat`
- `LLM_BASE_URL`: `http://127.0.0.1:11434/v1`
- `LLM_MODEL`: `qwen2.5:1.5b`
- `LLM_TIMEOUT`: `30.0`
- `LLM_MAX_TOKENS`: `300`

---
**Verified by**: Automated M1 `pytest` suite (`32 passed`, fake-HTTP + adversarial guardrail checks) and live Ollama `qwen2.5:1.5b` end-to-end verification (`source: "llm"` online / `source: "template"` unreachable fallback).  
**Date**: 2026-11-22

## 6. Human verification (Part 1 gate) - fill in by hand
| Check | Result | Date / initials |
| --- | --- | --- |
| Read the model card on Hugging Face and confirmed the license is Apache-2.0 | | |
| `ollama pull` + backend with `LLM_MODE=openai_compat`: `/api/v1/health` shows `llm_mode: openai_compat`, `llm_status: online` | | |
| One button turn returns `narration.source: "llm"` and `guardrail.status: "passed"` | | |
| Ollama stopped: next turn returns `source: "template"`, `guardrail.status: "fallback"`, game continues | | |
| Model name and digest used (`ollama show --modelfile <model>`) | | |

