# FloodGuard LLM Model Card Template

This document records the evaluation, provenance, and license details for the open-source Large Language Model selected for FloodGuard's local inference layer.

> **Instruction for Human Operator (Gate A)**:
> Select one open-source model licensed under **Apache-2.0** or a compatible OSI license (e.g. `Llama-3.2-3B-Instruct`, `Phi-3-mini-4k-instruct`, or `Mistral-7B-Instruct`).
> Verify its model card and fill in the sections below.

---

## 1. Model Details
- **Model Name / Identifier**: *(e.g., Llama-3.2-3B-Instruct)*
- **Organization / Developer**: *(e.g., Meta AI / Microsoft / Mistral AI)*
- **Model Architecture**: Decoder-only Transformer
- **Parameter Count**: *(e.g., 3.2B parameters)*
- **Base License**: Apache License 2.0 (or OSI-approved compatible license)
- **Official Repository / Weights URL**: *(e.g., https://huggingface.co/...)*
- **Inference Runtime Engine**: Ollama / llama.cpp / vLLM

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
- [ ] **License Check**: Verified Apache-2.0 or OSI-approved license.
- [ ] **Number Grounding**: Verified that the model adheres to `facts_allowed` and avoids hallucinating statistics.
- [ ] **Tone Compliance**: Verified that outputs avoid graphic violence and sensational language.
- [ ] **Silent Fallback**: Verified that shutting down the model server triggers silent fallback to deterministic templates with `source: template`.

## 5. Deployment Configuration
- `LLM_MODE`: `openai_compat`
- `LLM_BASE_URL`: `http://localhost:11434/v1`
- `LLM_MODEL`: *(insert pulled model name)*
- `LLM_TIMEOUT`: `8.0`
- `LLM_MAX_TOKENS`: `300`

---
**Verified by Human Operator**: _____________________  
**Date**: _____________________  
