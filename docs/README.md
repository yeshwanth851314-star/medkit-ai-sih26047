# MedKit AI — Specification Pack

This folder contains the six Antigravity source-of-truth documents.

1. 01_PRD.md — Product requirements and scope
2. 02_TRD.md — Technical architecture and engineering requirements
3. 03_BACKEND_SCHEMA.md — Database, API, security, provenance model
4. 04_APP_FLOW.md — User journeys, states, failure paths
5. 05_UI_UX_BRIEF.md — Clinical UX/design system direction
6. 06_IMPLEMENTATION_PLAN.md — Phased build/test/deploy plan

Recommended Antigravity order:
READ → UNDERSTAND → IDENTIFY CONFLICTS → REPORT → PLAN → IMPLEMENT → TEST → VERIFY → PACKAGE:AUDIT → COMMIT

Whenever completing code, test, configuration, or documentation changes, always execute `npm run package:audit` to regenerate the three synchronized distribution archives in `D:\SIH-zip-files-gpt`.

Source basis:
- SIH26047 problem statement
- SIH Structured Development Roadmap & Project Tracker
- Antigravity skills/resources supplied by the project
- Official Supabase/Vercel documentation
- ABDM public guidance
