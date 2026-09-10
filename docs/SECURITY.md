# MedKit AI — Security & Compliance Architecture
**SIH Problem Statement: SIH26047 — Patient Case-Taking Software**

---

## 1. Threat Model & Security Posture

MedKit AI processes Protected Health Information (PHI) and clinical records. The system is designed under zero-trust principles and conforms to the ABDM (Ayushman Bharat Digital Mission) Health Data Management Policy and HIPAA security guidelines.

---

## 2. Authentication & Session Management

### 2.1 Cryptographic HMAC-SHA256 Session Tokens
- **Implementation**: Located at `src/lib/auth/jwt.ts`.
- **Token Structure**: Standard three-part token (`header.payload.signature`) encoded with URL-safe Base64.
- **Signing Key**: Sourced from server-side environment secrets (`SESSION_SECRET`). In demo mode, a dedicated high-entropy fallback key is used.
- **Timing-Safe Verification**: Verification employs `crypto.timingSafeEqual` across byte buffers to eliminate timing attack vectors.
- **Expiration Enforcement**: Tokens carry explicit timestamps (`iat` and `exp`). Expired tokens are rejected unconditionally with HTTP 401.

### 2.2 Server-Side API Guards (`src/lib/auth/api-guard.ts`)
All clinical API endpoints enforce server-side validation via `requireApiAuth(request, options)`:
- Missing token $\to$ `401 Unauthorized`
- Tampered or forged signature $\to$ `401 Unauthorized`
- Insufficient clinical role (e.g. staff attempting case finalization) $\to$ `403 Forbidden`

### 2.3 Role-Based Access Control (RBAC) Matrix

| Endpoint | Permitted Roles | Description |
| :--- | :--- | :--- |
| `GET /api/patients` | `doctor`, `clinician`, `staff`, `admin` | Search and view triage patient registry |
| `POST /api/patients` | `doctor`, `clinician`, `staff`, `admin` | Register patient at reception/intake |
| `GET /api/cases/[id]` | `doctor`, `clinician`, `staff`, `admin` | View clinical case sheet |
| `PATCH /api/cases/[id]` (update) | `doctor`, `clinician`, `staff` | Update draft clinical notes |
| `PATCH /api/cases/[id]` (finalize)| `doctor`, `clinician` | **Attending physician sign-off only** |
| `POST /api/cases/[id]/red-flags` | `doctor`, `clinician` | **Clinical acknowledgment of red flags** |
| `GET /api/cases/[id]/summary` | `doctor`, `clinician`, `staff` | Generate/view clinical intake summary |
| `POST /api/cases/[id]/summary` | `doctor`, `clinician` | Approve/generate AI-assisted summary |
| `GET /api/timeline/[patientId]` | `doctor`, `clinician`, `staff` | Access longitudinal medical history |

---

## 3. Database Security & Row Level Security (RLS)

- **Fail-Closed Architecture**: In production mode (`NEXT_PUBLIC_DEMO_MODE=false`), any failure in database connectivity or query execution fails closed (throws explicit 500/503 error), preventing silent fallback to mock data.
- **PostgreSQL Row Level Security (RLS)**: Enabled across all production tables (`profiles`, `patients`, `consents`, `cases`, `documents`, `sync_mutations`, `audit_logs`, `red_flag_events`, `case_amendments`).
- **Institutional Facility Isolation**:
  - All legacy permissive policies are explicitly purged (`DROP POLICY IF EXISTS`) to eliminate logical `OR` bypass in PostgreSQL.
  - Queries are strictly scoped to the clinician's assigned facility (`facility_id = public.current_user_facility()`).
  - Private storage bucket `clinical-documents` enforces path-based facility checks: `patients/<patient_id>/...`.
- **Audit Immutability**: The `audit_logs` table permits `INSERT` and `SELECT`, but strictly disallows `UPDATE` and `DELETE`, ensuring an untamperable audit trail.

---

## 4. Privacy & PII De-Identification

- **De-Identification Module (`src/features/security/de-identification.ts`)**:
  - Masking for phone numbers (`+91 98****3210`)
  - Masking for ABHA IDs (`**-****-****-0123`)
  - Masking for patient names (`R***** V****`)
- **Error Sanitization**: Database strings, connection URIs, credentials, and server stack traces are filtered using `sanitizeErrorMessage()`.

---

## 5. Kiosk Privacy, Offline Isolation & Concurrency

- **Mandatory Consent Before Intake**: Unauthenticated kiosk intake cannot begin collecting clinical data without explicit patient consent acknowledgment (`consentAcknowledged: true`).
- **Actor-Scoped Offline Storage**: LocalStorage mutation queues are strictly isolated by actor ID (`medkit_offline_queue_${actorId}`).
- **Cross-Tab Synchronization**: Real-time `window.addEventListener("storage", ...)` keeps open browser tabs synchronized and prevents stale in-memory queue collisions.
- **Session Cleanup**: Kiosk completion or clinician logout destroys the active actor queue and clears ephemeral intake capability tokens.
- **Optimistic Concurrency**: Draft updates evaluate base timestamps (`expectedUpdatedAt`) and reject concurrent overwrites with `409 Conflict`.

