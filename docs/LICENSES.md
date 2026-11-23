# Open-Source Licenses Audit

All dependencies, models and assets in FloodGuard use OSI-approved open-source or public-domain licenses, with the dev-only data exception noted below. No proprietary runtime APIs, external CDNs, external fonts, or stock art are used.

## Source Code & Content Licenses
- **Source Code**: Apache License 2.0 (`SPDX-License-Identifier: Apache-2.0`)
- **Educational Rule Cards & Scenario Content**: Creative Commons Attribution 4.0 International (CC BY 4.0)

## Approved OSI License Allowlist
- MIT
- Apache-2.0
- BSD-2-Clause
- BSD-3-Clause
- ISC
- MPL-2.0 - approved by the project owner (23 Nov 2026) for dependencies used **unmodified**:
  `certifi` (CA bundle, pulled in by `httpx`, which we keep) and `Hypothesis` (if property-based tests are
  added). MPL-2.0 is file-level copyleft: modified MPL files would have to stay MPL; we modify none.
- Python Software Foundation (PSF)
- Public Domain / CC0

`backend/scripts/check_licenses.py` enforces this list in CI (MIT, Apache, BSD, ISC, public domain, MPL-2.0)
and fails on anything else unless it is a documented exception.

## Runtime Dependencies

### Backend (Python) - checked in CI by `backend/scripts/check_licenses.py`
| Package | License | Why it is here |
| --- | --- | --- |
| Python | PSF-2.0 | Runtime |
| fastapi | MIT | REST API |
| starlette | BSD-3-Clause | FastAPI dependency |
| pydantic, pydantic-core, annotated-types | MIT | Models and schema validation |
| uvicorn[standard] | BSD-3-Clause | ASGI server |
| h11, httptools, watchfiles, exceptiongroup | MIT | uvicorn dependencies |
| uvloop | MIT / Apache-2.0 | uvicorn dependency |
| websockets, python-dotenv, click | BSD-3-Clause | uvicorn dependencies |
| PyYAML | MIT | Scenario and rule-card files |
| httpx | BSD-3-Clause | HTTP client for the OpenAI-compatible LLM endpoint; FastAPI TestClient |
| httpcore, idna | BSD-3-Clause | httpx dependencies |
| anyio | MIT | httpx/starlette dependency |
| SQLite (stdlib) | Public Domain | Session store and event log |
| pytest, pluggy, iniconfig | MIT | Tests |
| pygments | BSD-2-Clause | pytest dependency |
| packaging | Apache-2.0 OR BSD-2-Clause | pytest dependency |

### Documented exceptions (outside MIT/Apache/BSD/ISC/public domain)
| Package | License | Reason | Status |
| --- | --- | --- | --- |
| typing-extensions | PSF-2.0 | Same permissive license as Python itself; required by pydantic and FastAPI. | Unavoidable |
| certifi | MPL-2.0 | CA certificate bundle, used unmodified; pulled in by httpx. | Allowed (MPL-2.0 approved) |

### Frontend (Node / TypeScript)
Runtime (shipped in the ~83 KB gzip JavaScript bundle):
| Package | License | Usage |
| --- | --- | --- |
| react, react-dom, scheduler, loose-envify, js-tokens | MIT | UI |
| lucide-react | ISC | Icons (tree-shaken, inline SVG) |

Development only (never in `dist/`):
| Package | License | Usage |
| --- | --- | --- |
| vite, @vitejs/plugin-react, esbuild, rollup, babel | MIT | Build and dev server |
| typescript | Apache-2.0 | Type checking |
| msw | MIT | Mock API for `npm run dev:mock` and Playwright |
| @playwright/test | Apache-2.0 | End-to-end tests |
| Other transitive build tools | MIT / ISC / Apache-2.0 / BSD-3-Clause; type-fest is MIT OR CC0-1.0 | |

Documented dev-only exception (approved 23 Nov 2026): **caniuse-lite**, licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution: browser-support data from
[Can I use](https://caniuse.com) by Alexis Deveria, packaged as `caniuse-lite` by the Browserslist project
(https://github.com/browserslist/caniuse-lite). It is read by the build tools (Browserslist, via Vite/Babel)
at build time only and is **not** shipped: the production bundle in `frontend/dist` contains no caniuse data
(verified with a search of the built files).

Fonts: system fonts only. Art: hand-drawn inline SVG (maps, hazard illustrations, character portraits); no
stock art, no CDN. The FloodGuard logo, favicon and PWA icons are original artwork made for this project
(`frontend/branding/`), released with the code under Apache-2.0.

### Deployment (not part of the app's code)
| Component | License | Usage |
| --- | --- | --- |
| Caddy (`caddy:2` image) | Apache-2.0 | HTTPS reverse proxy in `docker-compose.yml` |
| Ollama (`ollama/ollama` image) | MIT | Optional local model server (`local-llm` profile) |
| Docker Engine / Compose | Apache-2.0 | Container runtime on the server |

### Local Open-Source LLM Model (Ollama / llama.cpp / vLLM)
| Model Identifier | Base License | Serving Engine | Verified (Gate A) |
| --- | --- | --- | --- |
| `Qwen2.5-1.5B-Instruct` (`qwen2.5:1.5b`) | Apache-2.0 | Ollama (MIT) / llama.cpp (MIT) | [x] Apache-2.0 & Live Ollama Verified |

### Hosted open models (optional, by `LLM_PROVIDER`)
| Model | License | Provider |
| --- | --- | --- |
| `sarvam-105b` | Apache-2.0 | Sarvam API |
| `gpt-oss-20b` | Apache-2.0 | Cloudflare Workers AI, Hugging Face Inference Providers |

Closed or non-OSI models are not used at runtime.
