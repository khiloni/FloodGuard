"""LLM provider presets for the OpenAI-compatible client.

Choose with LLM_PROVIDER (default "ollama"). LLM_BASE_URL / LLM_MODEL / LLM_MAX_TOKENS /
LLM_JSON_MODE still override any preset. API keys are read from environment variables only
and are never logged or returned by the API.

Only openly licensed models are allowed at runtime (Apache-2.0 or MIT). The presets below
point at such models; MODEL_LICENSES documents them and is shown in /meta.
"""
import os
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass(frozen=True)
class Preset:
    base_url: str
    model: str
    key_env: Optional[str]          # env var holding the API key (None = no auth)
    auth_header: str                # "bearer" or a header name such as "api-subscription-key"
    json_mode: bool                 # send response_format={"type": "json_object"}
    max_tokens: int                 # reasoning models spend tokens on thinking
    ping_models: bool               # health check by GET /models (local servers only)


PRESETS: Dict[str, Preset] = {
    # Local server (Ollama, llama.cpp, vLLM) - no key.
    "ollama": Preset("http://127.0.0.1:11434/v1", "qwen2.5:1.5b", None, "bearer", True, 300, True),
    # Sarvam's own OpenAI-compatible API. sarvam-30b is deprecated there; sarvam-105b is served.
    "sarvam": Preset("https://api.sarvam.ai/v1", "sarvam-105b", "SARVAM_API_KEY", "api-subscription-key", False, 1500, False),
    # Cloudflare Workers AI OpenAI-compatible endpoint; {CF_ACCOUNT_ID} is filled from env.
    "cloudflare": Preset("https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/v1",
                         "@cf/openai/gpt-oss-20b", "CF_API_TOKEN", "bearer", False, 1500, False),
    # Hugging Face Inference Providers router.
    "huggingface": Preset("https://router.huggingface.co/v1", "openai/gpt-oss-20b", "HF_TOKEN", "bearer", False, 1500, False),
}

# Licences of the preset models (documented in docs/MODEL_CARD.md).
MODEL_LICENSES: Dict[str, str] = {
    "qwen2.5:1.5b": "Apache-2.0",
    "sarvam-105b": "Apache-2.0",
    "sarvam-30b": "Apache-2.0",
    "@cf/openai/gpt-oss-20b": "Apache-2.0",
    "openai/gpt-oss-20b": "Apache-2.0",
    "openai/gpt-oss-120b": "Apache-2.0",
}


def provider_name() -> str:
    name = os.environ.get("LLM_PROVIDER", "ollama").strip().lower()
    return name if name in PRESETS else "ollama"


def preset() -> Preset:
    return PRESETS[provider_name()]


def base_url() -> str:
    url = os.environ.get("LLM_BASE_URL", "").strip() or preset().base_url
    if "{CF_ACCOUNT_ID}" in url:
        url = url.replace("{CF_ACCOUNT_ID}", os.environ.get("CF_ACCOUNT_ID", "").strip() or "MISSING_ACCOUNT_ID")
    return url.rstrip("/")


def model() -> str:
    return os.environ.get("LLM_MODEL", "").strip() or preset().model


def api_key() -> Optional[str]:
    env = preset().key_env
    if not env:
        return os.environ.get("LLM_API_KEY", "").strip() or None
    return os.environ.get(env, "").strip() or os.environ.get("LLM_API_KEY", "").strip() or None


def key_missing() -> bool:
    p = preset()
    if p.key_env is None:
        return False
    if api_key() is None:
        return True
    return provider_name() == "cloudflare" and not os.environ.get("CF_ACCOUNT_ID", "").strip() and not os.environ.get("LLM_BASE_URL")


def auth_headers() -> Dict[str, str]:
    key = api_key()
    if not key:
        return {}
    header = preset().auth_header
    if header == "bearer":
        return {"Authorization": f"Bearer {key}"}
    return {header: key, "Authorization": f"Bearer {key}"}


def model_license(name: Optional[str] = None) -> str:
    return MODEL_LICENSES.get(name or model(), "unknown (check before release)")
