# MedKit AI — Architecture & Product Decision Log (ADR)

This document records the foundational and ongoing technical and product decisions for MedKit AI (SIH26047), following the guidelines in `00_MASTER_SPEC.md` Section 26.

---

## ADR-001: Modular Monolith Architecture over Microservices

- **Decision:** Build MedKit AI as a single, coherent Next.js (App Router) modular monolith with domain-driven boundaries, rather than a multi-service or microservice architecture.
- **Context:** The SIH problem statement (SIH26047) requires an integrated multimodal intake and copilot system with voice, document digitization, longitudinal timeline, and clinical summary capabilities.
- **Options considered:**
  1. Microservices architecture with separate FastAPI Python services for AI/OCR and an Express/Next.js frontend.
  2. Next.js App Router modular monolith with TypeScript, server-only data access layer, and domain services.
- **Chosen option:** Option 2 (Next.js App Router Modular Monolith).
- **Why:** In accordance with the Ponytail Principle and `00_MASTER_SPEC.md` Section 5, a modular monolith minimizes operational complexity, enables rapid local and hermetic testing, simplifies Vercel/Supabase deployment, and provides a rock-solid, demo-reliable foundation without network serialization overhead between internal services.
- **Trade-offs:** Heavy non-Node machine learning tasks (if any) cannot run in the same process; however, modern AI capabilities are accessed via high-speed API SDKs (Google GenAI) or WebAssembly/edge workers, making external microservices redundant.
- **Date:** 2026-09-06

---

## ADR-002: Dual-Mode Service Architecture (Live Provider + Synthetic Demo/Offline Fallback)

- **Decision:** Encapsulate all AI, OCR, speech, and database interactions behind abstract domain service interfaces with both live providers and deterministic synthetic fallback fixtures.
- **Context:** Live cloud APIs (Gemini, Supabase, speech recognition) are subject to network jitter, latency, or rate limits during live hackathon demonstrations and hermetic automated CI testing.
- **Options considered:**
  1. Rely exclusively on live cloud connections for all operations.
  2. Implement a dual-mode provider architecture where services dynamically or configurably use synthetic known-good fixtures if cloud credentials are absent or remote services fail.
- **Chosen option:** Option 2.
- **Why:** `00_MASTER_SPEC.md` Section 21 mandates that live AI must never be the only path through the SIH demo. Having deterministic fallback fixtures guarantees that every stage of the 3-minute golden demo path functions without developer panic.
- **Trade-offs:** Slightly more code to maintain synthetic mock responses matching the real schemas, but completely eliminates presentation fragility.
- **Date:** 2026-09-06

---

## ADR-003: Language Pair for Multilingual Intake (English + Telugu)

- **Decision:** Standardize on English and Telugu as the primary language pair for the MVP and core demonstration, designed with an extensible i18n dictionary architecture.
- **Context:** `04_APP_FLOW.md` Section 23 specifies Telugu/English for the end-to-end demo flow, while `01_PRD.md` specifies English + one reliable Indian language.
- **Options considered:**
  1. English + Hindi.
  2. English + Telugu.
  3. Attempting 10+ languages simultaneously in the MVP.
- **Chosen option:** English + Telugu.
- **Why:** Aligns with `04_APP_FLOW.md` demo flow while satisfying the PRD requirement. Keeping the set focused ensures rigorous transcript preservation and translation verification without superficial claims.
- **Trade-offs:** Other regional languages (Hindi, Tamil, Kannada) will be added in Phase 12 once the core dictionary and transliteration pipelines are hardened.
- **Date:** 2026-09-06

---

## ADR-004: Structured Case Data Model & Provenance

- **Decision:** Store canonical intake records with structured JSONB attributes validated against explicit Zod schemas in `cases`, and enforce source provenance tracking (`patient`, `clinician`, `ocr`, `ai`, `system/rule`) on every clinical fact.
- **Context:** Clinical intake needs both strict structure for queries and flexibility for specialized sections (e.g., AYUSH Dashavidha Pariksha). AI must never silently overwrite clinician-confirmed facts.
- **Options considered:**
  1. Completely unstructured free-text medical notes.
  2. Ultra-normalized relational tables for every single question, symptom, and answer.
  3. Hybrid normalized entity model (`patients`, `cases`, `documents`, `audit_logs`) with typed, Zod-validated JSONB clinical sections and explicit source provenance.
- **Chosen option:** Option 3.
- **Why:** Matches `03_BACKEND_SCHEMA.md` Section 2.3 and the Ponytail principle. Provides type-safety, rapid schema evolution for AYUSH fields, and strict auditability.
- **Trade-offs:** Requires thorough Zod validation at every boundary, which is a desirable clinical safety feature.
- **Date:** 2026-09-06

---

## ADR-005: Non-Autonomous Clinical Boundary & Standardized Disclaimers

- **Decision:** Implement strict rule-based triggers and non-diagnostic language across all UI layers.
- **Context:** `00_MASTER_SPEC.md` Section 3 and `01_PRD.md` Section 5 strictly forbid autonomous diagnosis, autonomous prescribing, or presenting AI outputs as verified clinical truth.
- **Standardized Copy:**
  - Red flags: *"Potential red flag detected — immediate clinical assessment recommended."*
  - Summaries: *"AI-assisted summary — clinician review required."*
  - Documents: *"Extracted from uploaded document — verify before use."*
- **Trade-offs:** Requires deliberate copy review and prevents flashy but irresponsible "AI Diagnostic" claims.
- **Date:** 2026-09-06
