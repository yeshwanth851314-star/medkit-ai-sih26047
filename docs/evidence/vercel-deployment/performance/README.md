# Deployed Lab Performance Evidence

## Overview
This directory contains empirical performance measurements collected directly from the deployed Vercel instance connected to the real Supabase cloud database (`MED-KIT-AI`).

## Targets
- **Largest Contentful Paint (LCP):** `<= 2.5s` (2500 ms)
- **Cumulative Layout Shift (CLS):** `<= 0.10`
- **Field INP (Interaction to Next Paint):** `NOT YET AVAILABLE` (Honest reporting: field telemetry requires accumulated real-user production traffic).

## Artifacts
- `preview-lab-results.json`: Full machine-readable route timing and Core Web Vitals breakdown.
- `preview-route-summary.txt`: Tabular comparison across all 7 evaluated routes.
- `production-smoke-summary.txt`: Production protected deployment smoke verification.
