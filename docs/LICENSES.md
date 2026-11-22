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

### Backend (Python)
| Package | License | Usage |
| --- | --- | --- |
| Python | PSF License | Core runtime environment |
| FastAPI | MIT | REST API web framework |
| Uvicorn | BSD-3-Clause | ASGI web server |
| Pydantic | MIT | Data models & schema validation |
| PyYAML | MIT | Scenario & rule card configuration parser |
| httpx | BSD-3-Clause | HTTP client for OpenAI-compatible LLM endpoint |
| SQLite | Public Domain | Session persistence & deterministic event log |
| Pytest | MIT | Automated testing framework |

### Frontend (Node / TypeScript)
| Package | License | Usage |
| --- | --- | --- |
| React | MIT | UI component library |
| ReactDOM | MIT | DOM rendering engine |
| Vite | MIT | Frontend build & development server |
| TypeScript | Apache-2.0 | Static type checking |
| Lucide React | ISC | Open-source SVG icons |

### Local Open-Source LLM Model (Ollama / llama.cpp / vLLM)
| Model Identifier | Base License | Serving Engine | Verified by Human (Gate A) |
| --- | --- | --- | --- |
| *(Record chosen model card e.g. Llama-3.2-3B-Instruct or Phi-3-mini)* | *(Verify Apache-2.0 / OSI approved)* | Ollama (MIT) / llama.cpp (MIT) | [ ] Verified & Recorded |
