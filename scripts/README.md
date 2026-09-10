# MedKit AI — Packaging & Source Audit Workflow

This directory contains the repeatable packaging and distribution scripts for **MedKit AI (SIH26047)**.

## Destination
All archives and the audit manifest are generated in:
`D:\SIH-zip-files-gpt`

## Archive Distribution
The project is split into three synchronized, completely disjoint, non-overlapping ZIP archives to facilitate analysis in ChatGPT and maintain upload limits:

1. **`medkit-source-assets.zip`**
   - Application source code and assets: `src/` (app router, components, config, features, lib, types, middleware) and any public assets.
2. **`medkit-tests.zip`**
   - All unit, integration, and end-to-end tests: `tests/` (e2e, fixtures, integration, unit).
3. **`medkit-supabase-config.zip`**
   - Database migrations and RLS policies: `supabase/`
   - Specifications and documentation: `docs/`, `README.md`, `AGENTS.md`
   - Configuration files: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `.env.example`
   - CI and scripts: `.github/`, `scripts/`

## Manifest
Beside the ZIPs, **`audit-package-manifest.json`** records:
- Generation timestamp in UTC and snapshot identifier
- Project version and Git commit / dirty status
- File count, byte size, and SHA-256 for each archive
- Complete inventory of all included relative paths and their individual SHA-256 checksums
- Universal exclusion rules

## Exclusions
Strictly excluded at all depths:
- `node_modules/`, `.next/`, `.git/`, `test-results/`, `playwright-report/`, `coverage/`
- Real `.env` and environment-specific variants (only placeholder-verified `.env.example` included)
- Build caches (`tsconfig.tsbuildinfo`, `.vercel/`), temporary files (`*.tmp`, `*.swp`, `*.swo`, `*.log`, `*.bak`)
- Credentials and private keys (pre-packaging scan blocks publication if detected)

## Commands

### 1. Manual Generation & Verification
```bash
npm run package:audit
```
Captures a staged snapshot, checks for concurrent file changes, scans for secrets, generates ZIPs via native `tar.exe`, validates by extracting to a temp directory, and atomically updates `D:\SIH-zip-files-gpt`.

### 2. Automated File Watcher
```bash
# Start watcher (foreground or via process manager)
npm run package:watch

# Check watcher status
npm run package:watch:status

# Stop active watcher cleanly
npm run package:watch:stop
```
The watcher monitors eligible files, debounces multi-file edits (1500ms), queues runs during active packaging, and automatically updates the archive set.
