# Open-Source Licenses Audit

All dependencies and assets in FloodGuard strictly conform to OSI-approved open-source or public domain licenses. No proprietary runtime APIs are used.

## Source Code & Content Licenses
- **Source Code**: Apache License 2.0 (`SPDX-License-Identifier: Apache-2.0`)
- **Educational Rule Cards & Scenario Content**: Creative Commons Attribution 4.0 International (CC BY 4.0)

## Runtime Dependencies

### Backend (Python)
| Package | License | Usage |
| --- | --- | --- |
| Python | PSF License | Runtime environment |
| FastAPI | MIT License | Web API framework |
| Uvicorn | BSD-3-Clause | ASGI server |
| Pydantic | MIT License | Data validation & state models |
| PyYAML | MIT License | Scenario loading |
| SQLite | Public Domain | Session storage & audit log |
| Pytest | MIT License | Test execution suite |

### Frontend (Node / TypeScript)
| Package | License | Usage |
| --- | --- | --- |
| React | MIT License | UI component rendering |
| ReactDOM | MIT License | Browser DOM reconciliation |
| Vite | MIT License | Frontend compilation & bundling |
| TypeScript | Apache-2.0 | Static type safety |
