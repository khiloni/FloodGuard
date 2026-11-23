# Open-Source Licenses Audit

All dependencies, models, and assets in FloodGuard strictly conform to OSI-approved open-source or public domain licenses. No proprietary runtime APIs, external CDNs, external fonts, or stock art are used.

## Source Code & Content Licenses
- **Source Code**: Apache License 2.0 (`SPDX-License-Identifier: Apache-2.0`)
- **Educational Rule Cards & Scenario Content**: Creative Commons Attribution 4.0 International (CC BY 4.0)

## Approved OSI License Allowlist
- MIT
- Apache-2.0
- BSD-2-Clause
- BSD-3-Clause
- ISC
- MPL-2.0
- Python Software Foundation (PSF)
- Public Domain / CC0

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
| certifi | MPL-2.0 | Weak, file-level copyleft; we ship the CA bundle unmodified. Pulled in by httpx. | Pending project-owner approval |

### Frontend (Node / TypeScript)
| Package | License | Usage |
| --- | --- | --- |
| React | MIT | UI component library |
| ReactDOM | MIT | DOM rendering engine |
| Vite, @vitejs/plugin-react | MIT | Build and dev server |
| TypeScript | Apache-2.0 | Static type checking |

Part 3 will add its icon set (Lucide, ISC, or Tabler, MIT), MSW (MIT, dev only) and Playwright (Apache-2.0, dev only) here when they are installed.

### Local Open-Source LLM Model (Ollama / llama.cpp / vLLM)
| Model Identifier | Base License | Serving Engine | Verified (Gate A) |
| --- | --- | --- | --- |
| `Qwen2.5-1.5B-Instruct` (`qwen2.5:1.5b`) | Apache-2.0 | Ollama (MIT) / llama.cpp (MIT) | [x] Apache-2.0 & Live Ollama Verified |
