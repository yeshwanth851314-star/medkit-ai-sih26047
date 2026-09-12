# MedKit AI — System Architecture Document
**SIH Problem Statement: SIH26047 — Patient Case-Taking Software**

---

## 1. System Overview

MedKit AI transforms patient voice recordings, adaptive multilingual questionnaires, and uploaded prescriptions/lab documents into structured, clinically validated intake case sheets **before the physician consultation begins**.

### Architectural Tenets
1. **Clinical Safety First**: Non-autonomous copilot; every AI output is treated as a clinical candidate subject to attending physician review.
2. **Resilient Decoupled Intelligence**: Live cloud intelligence (Google Gemini 2.5 Flash, Multimodal Audio ASR, and Vision OCR) with instant zero-downtime deterministic fallbacks.
3. **Defense-in-Depth Security**: Cryptographic HMAC-SHA256 session tokens, server-side API authorization guards, and PostgreSQL Row-Level Security (RLS).
4. **ABDM & FHIR Interoperability**: Strict data provenance, consent persistence, and FHIR Release 4 compatible representation.

---

## 2. High-Level Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             PATIENT & CLINICIAN UI                          │
│                                                                             │
│   [ Patient Kiosk Intake ]           [ Physician Copilot Hub ]              │
│   - Bilingual (English / Telugu)     - Clinical Triage Queue                │
│   - Digital Consent Acknowledgement  - Red Flag Immediate Alerts            │
│   - Adaptive Question Engine (Graph) - AI Summary & HPI Review              │
│   - Audio Recording / Document Upload- Finalization & FHIR Export           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS (Cookies / Bearer Tokens)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SERVER-SIDE API & SECURITY GUARDS                      │
│                                                                             │
│   • Middleware Auth & Route Protection (/doctor/*)                          │
│   • Server Guard: requireApiAuth() with Role-Based Access Control (RBAC)    │
│   • Cryptographic HMAC-SHA256 Timing-Safe Session Verification (jwt.ts)     │
│   • Immutable Audit Logging (AuditAction enum, actor ID, resource type)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────┐     ┌───────────────────────────────────────┐
│     INTELLIGENCE PROVIDERS    │     │       PERSISTENCE & SECURITY          │
│                               │     │                                       │
│ • Decoupled Provider Layer:   │     │ • PostgreSQL Schema (Supabase):       │
│   - AIProvider (Gemini / Demo)│     │   - profiles (Clinicians & Staff)     │
│   - SpeechProvider (ASR/Demo) │     │   - patients (Demographics & ABHA)    │
│   - OCRProvider (Vision/Demo) │     │   - cases (HPI, AYUSH, Provenance)    │
│                               │     │   - consents (ABDM Consent Records)   │
│ • Resilient Fallback Engine:  │     │   - documents (Prescriptions & Labs)  │
│   - Strict 8-second timeout   │     │   - audit_logs (Immutable Audit Trail)│
│   - Automatic local fallback  │     │   - red_flag_events (Clinical Alerts) │
│   - Live Provider Status Badge│     │ • Row Level Security (RLS) Policies   │
│                               │     │ • Fail-Closed Database Connection     │
└───────────────────────────────┘     └───────────────────────────────────────┘
```

---

## 3. Decoupled Provider Layer

All intelligence capabilities are isolated behind strict TypeScript interfaces, completely decoupling client consumption from underlying third-party APIs:

### 3.1 AI Provider Interface (`src/features/ai/ai-provider.ts`)
```typescript
export interface AIProvider {
  readonly name: "gemini-2.5-flash" | "deterministic-demo";
  generateClinicalSummary(caseId: string): Promise<AIClinicalSummaryResult>;
}
```
- **`GeminiProvider`**: Utilizes `@google/genai` to query `gemini-2.5-flash` with structured system instructions enforcing the non-autonomous copilot boundary.
- **`DeterministicDemoAIProvider`**: Offline-ready rule engine synthesizing HPI, pertinent positives/negatives, vitals summaries, and red flags without network calls.
- **`ResilientAIProvider`**: A composite wrapper executing `Promise.race` against an 8,000ms timeout; on failure, latency spike, or rate limit, it seamlessly executes the deterministic provider with diagnostic metadata (`fallbackUsed: true`).

### 3.2 Speech / ASR Provider Interface (`src/features/voice/speech-provider.ts`)
```typescript
export interface SpeechProvider {
  readonly name: "gemini-audio" | "deterministic-demo";
  transcribe(options: SpeechTranscriptionOptions): Promise<SpeechTranscriptionResponse>;
}
```
- **`LiveSpeechProvider`**: Multimodal audio transcription via Gemini 2.5 Flash directly processing base64 audio frames.
- **`DeterministicDemoSpeechProvider`**: Instantaneous synthetic audio fixtures for English and regional Indian languages (Telugu).

### 3.3 OCR Provider Interface (`src/features/documents/ocr-provider.ts`)
```typescript
export interface OCRProvider {
  readonly name: "gemini-vision" | "deterministic-demo";
  extract(options: OCRExtractionOptions): Promise<OCRExtractionResponse>;
}
```
- **`LiveOCRProvider`**: Multimodal document vision extraction parsing medication names, dosages, durations, and clinical instructions.
- **`DeterministicDemoOCRProvider`**: Fixture-based structured prescription and lab panel extraction.

---

## 4. Consent & Audit Trail Pipeline

1. **Intake Consent**: Before any case intake begins, `/api/consents` records an immutable consent record specifying purpose (`clinical_care_and_case_taking`), scope (`['voice_recording', 'document_extraction', 'ai_summary']`), and method.
2. **Case Linkage**: Every compiled intake case carries a foreign key `consent_id`.
3. **Revocation Safeguard**: If a patient revokes consent via `/api/consents/[id]/revoke`, all downstream AI compilation and data sharing are immediately blocked with `CONSENT_REQUIRED`.
4. **Immutable Audit Trail**: Every clinical query, mutation, red flag acknowledgment, and consent action is logged in `audit_logs` with actor ID, role, timestamp, and metadata. Database RLS strictly forbids `UPDATE` or `DELETE` on this table.
