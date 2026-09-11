# MedKit AI — Multimodal AI, OCR & Voice Provider Verification

**SIH Problem Statement:** SIH26047 — Patient Case-Taking Software  
**Lead Organization:** Ministry of Ayush / All India Institute of Ayurveda (AIIA)  
**Verification Date:** 2026-09-11  
**Target Models:**
- AI Summary: Google Gemini (`gemini-2.5-flash`) via `@google/genai`
- OCR Extraction: Multimodal Vision Provider
- Voice Transcription: Multilingual ASR (English + Telugu)

---

## 1. Executive Status

| Component | Verification State | Operational Behavior |
| :--- | :--- | :--- |
| **Gemini Clinical Summary Live** | `BLOCKED_EXTERNAL` | Host environment lacks `GEMINI_API_KEY`. Unauthenticated live calls safely fail-closed. |
| **OCR Document Extraction Live** | `BLOCKED_EXTERNAL` | Multimodal credentials missing. Manual entry & verification review flow intact. |
| **English Speech Live** | `BLOCKED_EXTERNAL` | Speech credentials missing. Verbatim text input flow intact. |
| **Telugu Speech Live** | `BLOCKED_EXTERNAL` | Speech credentials missing. Telugu verbatim text intake preserved. |
| **Provider Failure Handling** | `PASS` | Verified in unit & integration suites. Graceful fallback with latency tracking. |
| **Clinical Safety Boundaries** | `PASS` | Mandatory non-autonomous disclaimers, confidence thresholding, zero synthetic clinical hallucination on real inputs. |

---

## 2. Invariants Verified in Code & Test Suites

1. **Mandatory Disclaimer Invariant:**
   - Every AI-assisted summary produces the mandatory clinical disclaimer:
     `"AI-assisted summary — clinician review required."`
   - Every OCR extraction produces the unverified candidate disclaimer:
     `"Extracted from uploaded document — verify before use."`
2. **Deterministic Red Flags Invariant:**
   - Red flag identification is governed by the deterministic rules engine (`rules-engine.ts`), NEVER delegated autonomously to external LLMs.
3. **No Synthetic Clinical Fallback on Real Inputs:**
   - In production mode, if live providers fail on real patient documents or audio, the system displays an explicit failure/retry state and falls back to manual entry—it NEVER substitutes synthetic fixture medications or fake transcripts.
4. **Confidence Thresholding:**
   - Voice transcriptions with confidence `< 0.6` are automatically tagged with `requiresManualEdit = true` and `needs_review = true`.
5. **Raw Data & Provenance Preservation:**
   - Original Telugu/English verbatim text is retained in `originalText` / `rawTranscript` alongside any normalized English translation or clinical entities.

---

## 3. Test Evidence

- Integration Test: `tests/integration/gemini-live.test.ts`
- Unit Test: `tests/unit/providers.test.ts`
- Security Negative Test: `tests/unit/security-negative.test.ts`
- Machine-Readable Report: `provider-verification-report.json`
