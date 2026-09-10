# MedKit AI — Agent Workflow & Project Instructions

**SIH Problem Statement:** SIH26047 — Patient Case-Taking Software  
**Lead Organization:** Ministry of Ayush / All India Institute of Ayurveda (AIIA)

## Mandatory Packaging & Source Audit Rule

Whenever you finish making changes to this project, you MUST run:
```bash
npm run package:audit
```
Execute this command after your final edits and before reporting completion to the user. This requirement applies to any modifications involving:
- Application source code and assets (`src/`, `public/`)
- Test suites, mocks, and fixtures (`tests/`)
- Configuration, dependencies, and build files (`package.json`, `tsconfig.json`, `next.config.ts`, etc.)
- Database schema and migrations (`supabase/`)
- Specifications and documentation (`docs/`, `README.md`)
- Packaging scripts (`scripts/`)

Running `npm run package:audit` produces and validates three synchronized, non-overlapping archives and manifest at:
`D:\SIH-zip-files-gpt`
- `medkit-source-assets.zip`
- `medkit-tests.zip`
- `medkit-supabase-config.zip`
- `audit-package-manifest.json`

## Local Development & Quality Gates
Before packaging, ensure the standard verification gates remain passing:
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Unit Tests: `npm run test:unit`
- End-to-End Tests: `npm run test:e2e`
- Production Build: `npm run build`
