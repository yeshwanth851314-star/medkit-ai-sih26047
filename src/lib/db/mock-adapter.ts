import crypto from "node:crypto";
import { Patient, ClinicalCase, MedicalDocument, AuditLogEntry, IntakeSessionRecord } from "@/types/database";

// In-memory data store seeded from synthetic fixtures
class MockDatabaseAdapter {
  private patients: Map<string, Patient> = new Map();
  private cases: Map<string, ClinicalCase> = new Map();
  private documents: Map<string, MedicalDocument> = new Map();
  private consents: Map<string, any> = new Map();
  private syncMutations: Map<string, any> = new Map();
  private storageFiles: Map<string, { bytes: Buffer; mimeType: string }> = new Map();
  private auditLogs: AuditLogEntry[] = [];
  private redFlagEvents: Map<string, any> = new Map();
  private intakeSessions: Map<string, IntakeSessionRecord> = new Map();
  private caseAmendments: Map<string, any[]> = new Map();
  private kioskInstances: Map<string, any> = new Map();
  private capabilityRevocations: Set<string> = new Set();
  private isInitialized = false;

  recordRevocation(sessionId: string, reason?: string, targetStatus: "abandoned" | "submitted" = "abandoned"): void {
    this.capabilityRevocations.add(sessionId);
    const session = this.intakeSessions.get(sessionId);
    if (session) {
      session.status = targetStatus;
      session.completed_at = new Date().toISOString();
    }
  }

  isSessionRevoked(sessionId: string): boolean {
    if (this.capabilityRevocations.has(sessionId)) return true;
    const session = this.intakeSessions.get(sessionId);
    if (session && (session.status === "abandoned" || session.status === "submitted")) {
      return true;
    }
    return false;
  }

  constructor() {
    this.seedKiosks();
    this.initializeFromFixtures();
  }

  private seedKiosks() {
    this.kioskInstances.set("00000000-0000-0000-0000-000000000001", {
      id: "00000000-0000-0000-0000-000000000001",
      facility_id: "fac-hyd-01",
      name: "AIIA Hyderabad Reception Kiosk 01",
      secret_hash: "kiosk-secret-hyd-01",
      status: "active",
      created_at: new Date().toISOString(),
      expires_at: null,
      last_active_at: null,
    });
  }

  private initializeFromFixtures() {
    if (this.isInitialized) return;

    try {
      // Dynamic require or fallback seeds for synthetic demo
      const patientsData: any[] = require("../../../tests/fixtures/synthetic/patients.json");
      for (const p of patientsData) {
        this.patients.set(p.id, {
          id: p.id,
          patient_code: p.patient_code,
          full_name: p.full_name,
          date_of_birth: p.date_of_birth,
          gender: p.gender,
          phone: p.phone,
          address: p.address,
          blood_group: p.blood_group,
          facility_id: p.facility_id || "fac-hyd-01",
          emergency_contact: p.emergency_contact,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Seed default active consent record for synthetic demo patients
        const consentId = `con-${p.id.slice(0, 8)}`;
        this.consents.set(consentId, {
          id: consentId,
          patient_id: p.id,
          case_id: null,
          purpose: "clinical_care_and_case_taking",
          scope: ["voice_recording", "document_extraction", "ai_summary"],
          language: "en",
          consent_method: "touch_acknowledgement",
          consent_version: "v1.0",
          consent_timestamp: new Date().toISOString(),
          status: "granted",
          granted_at: new Date().toISOString(),
          actor_id: p.id,
          revocation_reason: null,
          revoked: false,
          revoked_at: null,
          created_at: new Date().toISOString(),
        });
      }

      const casesData: any[] = require("../../../tests/fixtures/synthetic/cases.json");
      for (const c of casesData) {
        this.cases.set(c.id, { ...c });
      }

      const docsData: any[] = require("../../../tests/fixtures/synthetic/documents.json");
      for (const d of docsData) {
        this.documents.set(d.id, {
          id: d.id,
          patient_id: d.patient_id,
          case_id: null,
          uploaded_by: "system",
          storage_path: `/private/documents/${d.id}`,
          original_filename: d.original_filename,
          mime_type: "application/pdf",
          file_size: 102400,
          document_type: d.document_type,
          processing_status: d.processing_status,
          ocr_confidence: d.ocr_confidence,
          extracted_data: d.extracted_data,
          error_message: d.error_message,
          created_at: new Date().toISOString(),
        });
      }

      this.isInitialized = true;
    } catch (err) {
      console.warn("Notice: Initializing mock database without filesystem fixtures", err);
    }
  }

  // Patients
  async getPatients(searchQuery?: string): Promise<Patient[]> {
    const list = Array.from(this.patients.values());
    if (!searchQuery || !searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (p) =>
        p.patient_code.toLowerCase().includes(q) ||
        p.full_name.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q))
    );
  }

  async getPatientById(id: string): Promise<Patient | null> {
    return this.patients.get(id) || null;
  }

  async getPatientByCode(code: string): Promise<Patient | null> {
    for (const p of this.patients.values()) {
      if (p.patient_code.toLowerCase() === code.toLowerCase().trim()) return p;
    }
    return null;
  }

  async createPatient(data: Omit<Patient, "id" | "created_at" | "updated_at">): Promise<Patient> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newPatient: Patient = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };
    this.patients.set(id, newPatient);
    this.recordAudit("system", "CREATE_PATIENT", "patients", id, { patient_code: newPatient.patient_code });
    return newPatient;
  }

  // Cases
  async getCasesByPatientId(patientId: string): Promise<ClinicalCase[]> {
    const list = Array.from(this.cases.values())
      .filter((c) => c.patient_id === patientId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return list.map((c) => {
      const amendments = this.caseAmendments.get(c.id) || [];
      if (amendments.length > 0) {
        return {
          ...c,
          amendments: amendments.map((a) => ({
            id: a.id,
            version: a.version,
            actor_id: a.author_id || a.actor_id,
            actor_name: a.author_name || a.actor_name,
            timestamp: a.created_at || a.timestamp,
            reason: a.reason,
            notes: a.notes,
          })),
        };
      }
      return c;
    });
  }

  async getCaseById(id: string): Promise<ClinicalCase | null> {
    const c = this.cases.get(id);
    if (!c) return null;
    const amendments = this.caseAmendments.get(id) || [];
    if (amendments.length > 0) {
      return {
        ...c,
        amendments: amendments.map((a) => ({
          id: a.id,
          version: a.version,
          actor_id: a.author_id || a.actor_id,
          actor_name: a.author_name || a.actor_name,
          timestamp: a.created_at || a.timestamp,
          reason: a.reason,
          notes: a.notes,
        })),
      };
    }
    return c;
  }

  async createCase(data: Omit<ClinicalCase, "id" | "created_at" | "updated_at">): Promise<ClinicalCase> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newCase: ClinicalCase = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };
    this.cases.set(id, newCase);
    this.recordAudit("system", "CREATE_CASE", "cases", id, { status: newCase.status });
    return newCase;
  }

  async updateCase(id: string, updates: Partial<ClinicalCase>): Promise<ClinicalCase | null> {
    const existing = this.cases.get(id);
    if (!existing) return null;

    // Finalized case immutability check (mirrors Postgres RLS policy status != 'final')
    if (existing.status === "final" && updates.status !== "final") {
      const allowedKeys = new Set(["amendments", "red_flags"]);
      const mutatingKeys = Object.keys(updates).filter((k) => !allowedKeys.has(k));
      if (mutatingKeys.length > 0) {
        throw new Error("CANNOT_MUTATE_FINAL: Finalized cases cannot be directly modified in cases table");
      }
    }

    const updated: ClinicalCase = {
      ...existing,
      ...updates,
      id, // Immutable ID
      updated_at: new Date().toISOString(),
    };
    this.cases.set(id, updated);
    this.recordAudit("system", "UPDATE_CASE", "cases", id, { status: updated.status });
    return updated;
  }

  // Case Amendments (Append-Only Immutable Addenda)
  async getCaseAmendments(caseId: string): Promise<any[]> {
    const list = this.caseAmendments.get(caseId) || [];
    return [...list].sort((a, b) => a.version - b.version);
  }

  async createCaseAmendment(data: any): Promise<any> {
    const id = data.id || `amend-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const amendment = {
      ...data,
      id,
      created_at: data.created_at || now,
    };
    const list = this.caseAmendments.get(data.case_id) || [];
    list.push(amendment);
    this.caseAmendments.set(data.case_id, list);
    return amendment;
  }

  // Intake Sessions (Durable Kiosk State)
  async createIntakeSession(data: Omit<IntakeSessionRecord, "id" | "started_at"> & { id?: string }): Promise<IntakeSessionRecord> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const session: IntakeSessionRecord = {
      ...data,
      id,
      started_at: now,
      expires_at: data.expires_at || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      answers: data.answers || {},
    };
    this.intakeSessions.set(id, session);
    return session;
  }

  async getIntakeSessionById(id: string): Promise<IntakeSessionRecord | null> {
    return this.intakeSessions.get(id) || null;
  }

  async updateIntakeSession(id: string, updates: Partial<IntakeSessionRecord>): Promise<IntakeSessionRecord | null> {
    const existing = this.intakeSessions.get(id);
    if (!existing) return null;
    const updated: IntakeSessionRecord = {
      ...existing,
      ...updates,
      id,
    };
    this.intakeSessions.set(id, updated);
    return updated;
  }

  async deleteIntakeSession(id: string): Promise<boolean> {
    return this.intakeSessions.delete(id);
  }

  // Documents
  async getDocumentsByPatientId(patientId: string): Promise<MedicalDocument[]> {
    return Array.from(this.documents.values()).filter((d) => d.patient_id === patientId);
  }

  async getDocumentById(id: string): Promise<MedicalDocument | null> {
    return this.documents.get(id) || null;
  }

  async createDocument(data: Omit<MedicalDocument, "created_at">): Promise<MedicalDocument> {
    const id = data.id || `doc-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const newDoc: MedicalDocument = {
      ...data,
      id,
      created_at: now,
    };
    this.documents.set(id, newDoc);
    this.recordAudit("system", "UPLOAD_DOCUMENT", "documents", id, { original_filename: newDoc.original_filename });
    return newDoc;
  }

  async updateDocument(id: string, updates: Partial<MedicalDocument>): Promise<MedicalDocument | null> {
    const existing = this.documents.get(id);
    if (!existing) return null;
    const updated: MedicalDocument = {
      ...existing,
      ...updates,
      id,
    };
    this.documents.set(id, updated);
    this.recordAudit("system", "UPDATE_DOCUMENT", "documents", id, { processing_status: updated.processing_status });
    return updated;
  }

  // Consents
  async recordConsent(data: any): Promise<any> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const record = {
      ...data,
      id,
      consent_timestamp: data.consent_timestamp || now,
      revoked: false,
      created_at: now,
    };
    this.consents.set(id, record);
    return record;
  }

  async getConsentById(id: string): Promise<any | null> {
    return this.consents.get(id) || null;
  }

  async getConsentByPatientId(patientId: string): Promise<any | null> {
    const list = Array.from(this.consents.values()).filter((c) => c.patient_id === patientId);
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
  }

  async revokeConsent(
    id: string,
    actorId?: string,
    reason?: string,
    actorRole?: string,
    actorFacility?: string
  ): Promise<any | null> {
    const existing = this.consents.get(id);
    if (!existing) return null;

    if (existing.revoked || existing.status === "revoked") {
      throw new Error(`ALREADY_REVOKED: Consent record '${id}' is already revoked`);
    }

    const patient = this.patients.get(existing.patient_id);
    if (patient && actorRole && actorRole !== "admin" && actorFacility && patient.facility_id) {
      if (actorFacility !== patient.facility_id) {
        throw new Error("FORBIDDEN: Cross-facility consent revocation denied");
      }
    }

    const updated = {
      ...existing,
      status: "revoked",
      revoked: true,
      revoked_at: new Date().toISOString(),
      actor_id: actorId || null,
      revocation_reason: reason || "Revoked by clinician",
    };
    this.consents.set(id, updated);
    return updated;
  }

  // Sync Mutations & Idempotency
  isIdempotencyKeyProcessed(key: string): boolean {
    const item = this.syncMutations.get(key);
    return Boolean(item && item.status === "completed");
  }

  reserveIdempotencyKey(params: {
    key: string;
    userId: string;
    entity: string;
    action: string;
    payloadHash?: string;
  }): { claimed: boolean; status?: "in_progress" | "completed" | "failed" | "conflict"; resourceId?: string } {
    const compositeKey = `${params.userId}:${params.key}`;
    const existing = this.syncMutations.get(compositeKey) || this.syncMutations.get(params.key);
    if (existing) {
      if (existing.payload_hash && params.payloadHash && existing.payload_hash !== params.payloadHash) {
        return {
          claimed: false,
          status: "conflict" as any,
          resourceId: existing.resource_id,
        };
      }
      // Orphan lease recovery: if in_progress and lease expired
      if (
        existing.status === "in_progress" &&
        existing.lease_expires_at &&
        new Date(existing.lease_expires_at).getTime() < Date.now()
      ) {
        existing.lease_expires_at = new Date(Date.now() + 60000).toISOString();
        return { claimed: true, status: "in_progress" };
      }
      return {
        claimed: false,
        status: existing.status as any,
        resourceId: existing.resource_id,
      };
    }
    const record = {
      id: crypto.randomUUID(),
      idempotency_key: params.key,
      user_id: params.userId,
      entity: params.entity,
      action: params.action,
      payload_hash: params.payloadHash,
      status: "in_progress",
      lease_expires_at: new Date(Date.now() + 60000).toISOString(),
      created_at: new Date().toISOString(),
    };
    this.syncMutations.set(compositeKey, record);
    this.syncMutations.set(params.key, record);
    return { claimed: true, status: "in_progress" };
  }

  updateSyncMutationStatus(params: {
    key: string;
    status: "completed" | "failed";
    resourceId?: string;
    errorMessage?: string;
  }): void {
    const existing = this.syncMutations.get(params.key);
    if (existing) {
      existing.status = params.status;
      if (params.resourceId) existing.resource_id = params.resourceId;
      if (params.errorMessage) existing.error_message = params.errorMessage;
      existing.completed_at = new Date().toISOString();
    }
  }

  getSyncMutation(key: string): any {
    return this.syncMutations.get(key) || null;
  }

  recordSyncMutation(mutation: {
    idempotency_key: string;
    user_id: string;
    entity: string;
    action: string;
    resource_id?: string;
    status?: "completed" | "failed";
    error_message?: string;
  }): void {
    this.syncMutations.set(mutation.idempotency_key, {
      id: crypto.randomUUID(),
      ...mutation,
      status: mutation.status || "completed",
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  }

  // Audit Logs
  recordAudit(actorId: string, action: string, resourceType: string, resourceId: string, metadata?: Record<string, any>) {
    this.auditLogs.push({
      id: crypto.randomUUID(),
      actor_id: actorId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata,
      created_at: new Date().toISOString(),
    });
  }

  // In-Memory Storage Simulation
  saveStorageFile(path: string, bytes: Buffer, mimeType: string) {
    this.storageFiles.set(path, { bytes, mimeType });
  }

  getStorageFile(path: string): { bytes: Buffer; mimeType: string } | null {
    return this.storageFiles.get(path) || null;
  }

  deleteStorageFile(path: string) {
    this.storageFiles.delete(path);
  }

  getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }

  // Red Flag Events
  recordRedFlagEvent(event: {
    id?: string;
    case_id: string;
    rule_id: string;
    severity: string;
    trigger_text: string;
    acknowledged_by?: string | null;
    acknowledged_at?: string | null;
  }): any {
    const id = event.id || crypto.randomUUID();
    const record = {
      id,
      case_id: event.case_id,
      rule_id: event.rule_id,
      severity: event.severity,
      trigger_text: event.trigger_text,
      acknowledged_by: event.acknowledged_by || null,
      acknowledged_at: event.acknowledged_at || null,
      created_at: new Date().toISOString(),
    };
    this.redFlagEvents.set(id, record);
    return record;
  }

  updateRedFlagEvent(
    caseId: string,
    ruleId: string,
    acknowledgedBy: string,
    acknowledgedAt: string,
    actorRole?: string,
    actorFacility?: string
  ): void {
    const c = this.cases.get(caseId);
    if (c) {
      const patient = this.patients.get(c.patient_id);
      if (patient && actorRole && actorRole !== "admin" && actorFacility && patient.facility_id) {
        if (actorFacility !== patient.facility_id) {
          throw new Error("FORBIDDEN: Cross-facility red flag acknowledgement denied");
        }
      }
    }

    let updatedCount = 0;
    for (const record of this.redFlagEvents.values()) {
      if (record.case_id === caseId && record.rule_id === ruleId && !record.acknowledged_by) {
        record.acknowledged_by = acknowledgedBy;
        record.acknowledged_at = acknowledgedAt;
        updatedCount++;
      }
    }

    if (updatedCount === 0) {
      throw new Error(`NOT_FOUND_OR_ALREADY_ACKNOWLEDGED: Red flag ${ruleId} on case ${caseId} not found or already acknowledged`);
    }

    this.recordAudit(acknowledgedBy || "system", "ACKNOWLEDGE_RED_FLAG", "cases", caseId, {
      ruleId,
      acknowledgedAt,
      facilityId: actorFacility,
    });
  }

  getRedFlagEvents(caseId?: string): any[] {
    const all = Array.from(this.redFlagEvents.values());
    if (!caseId) return all;
    return all.filter((r) => r.case_id === caseId);
  }

  // Kiosk Instances & Bootstrapping
  async getKioskInstanceById(id: string): Promise<any | null> {
    return this.kioskInstances.get(id) || null;
  }

  async verifyKioskCredentials(kioskId: string, secret: string): Promise<any | null> {
    const kiosk = this.kioskInstances.get(kioskId);
    if (!kiosk || kiosk.status !== "active") return null;
    if (kiosk.expires_at && new Date(kiosk.expires_at).getTime() < Date.now()) return null;
    const sha256Hash = crypto.createHash("sha256").update(secret).digest("hex");
    if (
      kiosk.secret_hash !== secret &&
      kiosk.secret_hash !== sha256Hash &&
      kiosk.secret_hash !== `hash-${secret}`
    ) {
      return null;
    }
    kiosk.last_active_at = new Date().toISOString();
    return kiosk;
  }

  async registerKioskInstance(instance: {
    id?: string;
    facility_id?: string;
    name: string;
    secret?: string;
    secretHash?: string;
    status?: "active" | "disabled" | "revoked";
    expiresAt?: string | null;
    actorOrToken?: any;
  }): Promise<any> {
    if (instance.actorOrToken && typeof instance.actorOrToken === "object") {
      const role = instance.actorOrToken.role;
      if (role && role !== "admin" && role !== "staff") {
        throw new Error(`FORBIDDEN: Role ${role} not permitted to provision kiosks`);
      }
    }
    const id = instance.id || crypto.randomUUID();
    const secretHash = instance.secretHash || instance.secret || "";
    const record = {
      id,
      facility_id: instance.facility_id || instance.actorOrToken?.facilityId || "fac-hyd-01",
      name: instance.name,
      secret_hash: secretHash,
      status: instance.status || "active",
      created_by: instance.actorOrToken?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: instance.expiresAt || null,
      last_active_at: null,
    };
    this.kioskInstances.set(id, record);
    return record;
  }

  async bootstrapKioskIntake(params: {
    kioskId: string;
    kioskSecret: string;
    fullName?: string;
    language?: string;
    consentAcknowledged: boolean;
    consentMethod?: string;
    dateOfBirth?: string | null;
    gender?: string | null;
  }): Promise<{ patientId: string; sessionId: string; consentId: string; facilityId: string; patientCode: string }> {
    if (params.consentAcknowledged !== true) {
      throw new Error("CONSENT_REQUIRED: Kiosk intake requires explicit patient consent acknowledgment");
    }

    const kiosk = await this.verifyKioskCredentials(params.kioskId, params.kioskSecret);
    if (!kiosk) {
      throw new Error("UNAUTHORIZED: Invalid kiosk identifier or secret");
    }

    const facilityId = kiosk.facility_id;
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = crypto.randomUUID().slice(0, 6).toUpperCase();
    const preRegCode = `PRE-${todayStr}-${randomSuffix}`;

    const newPatient = await this.createPatient({
      patient_code: preRegCode,
      full_name: params.fullName?.trim() || `Walk-in Patient (${preRegCode})`,
      date_of_birth: params.dateOfBirth || null,
      gender: params.gender || null,
      facility_id: facilityId,
    });

    const consent = await this.recordConsent({
      patient_id: newPatient.id,
      purpose: "clinical_care_and_case_taking",
      scope: ["voice_recording", "document_extraction", "ai_summary"],
      language: params.language || "en",
      consent_method: params.consentMethod || "touch_acknowledgement",
      consent_version: "v1.0",
      status: "granted",
      granted_at: new Date().toISOString(),
      actor_id: newPatient.id,
    });

    const session = await this.createIntakeSession({
      facility_id: facilityId,
      patient_id: newPatient.id,
      consent_id: consent.id,
      language: (params.language === "te" ? "te" : "en"),
      status: "active",
      current_question_id: "Q_CHIEF_COMPLAINT",
      answers: {},
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });

    this.recordAudit(`kiosk:${params.kioskId}`, "KIOSK_BOOTSTRAP", "patients", newPatient.id, {
      sessionId: session.id,
      consentId: consent.id,
      facilityId,
      kioskId: params.kioskId,
      patientCode: preRegCode,
    });

    return {
      patientId: newPatient.id,
      sessionId: session.id,
      consentId: consent.id,
      facilityId,
      patientCode: preRegCode,
    };
  }

  async submitIntakeToCase(params: {
    sessionId: string;
    kioskId: string;
    kioskSecret: string;
    redFlags?: any[];
  }): Promise<ClinicalCase> {
    const kiosk = await this.verifyKioskCredentials(params.kioskId, params.kioskSecret);
    if (!kiosk) {
      throw new Error("UNAUTHORIZED: Active kiosk instance required");
    }

    const session = this.intakeSessions.get(params.sessionId);
    if (!session) {
      throw new Error(`SESSION_NOT_FOUND: Intake session ${params.sessionId} does not exist`);
    }

    if (session.status !== "active") {
      throw new Error(`SESSION_NOT_ACTIVE: Session status is ${session.status}, expected active`);
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      throw new Error("SESSION_EXPIRED: Intake session has expired");
    }

    if (session.facility_id !== kiosk.facility_id) {
      throw new Error(`FORBIDDEN: Session facility ${session.facility_id} does not match kiosk facility ${kiosk.facility_id}`);
    }

    const consent = session.consent_id ? this.consents.get(session.consent_id) : null;
    if (!consent || consent.revoked || consent.status !== "granted") {
      throw new Error("CONSENT_REQUIRED: Valid unrevoked consent is required to compile case");
    }

    const chiefComplaint =
      session.answers?.Q_CHIEF_COMPLAINT?.value ||
      session.answers?.Q_CHIEF_COMPLAINT?.rawAnswer ||
      session.answers?.chief_complaint?.rawAnswer ||
      session.answers?.chief_complaint;

    if (!chiefComplaint || typeof chiefComplaint !== "string" || chiefComplaint.trim().length < 3) {
      throw new Error("INVALID_INTAKE: Chief complaint is required (min 3 characters)");
    }

    const newCase = await this.createCase({
      patient_id: session.patient_id,
      consent_id: consent.id,
      status: "draft",
      case_type: "general",
      patient_language: session.language,
      chief_complaint: chiefComplaint.trim(),
      raw_patient_complaint: chiefComplaint.trim(),
      hpi: null,
      red_flags: params.redFlags && params.redFlags.length > 0 ? params.redFlags : null,
      assessment_plan: {
        summary: `Compiled from kiosk intake session ${params.sessionId}`,
      },
    });

    if (params.redFlags && params.redFlags.length > 0) {
      for (const rf of params.redFlags) {
        this.recordRedFlagEvent({
          case_id: newCase.id,
          rule_id: rf.ruleId,
          severity: (rf.severity || "HIGH").toUpperCase(),
          trigger_text: rf.message || `Triggered red flag ${rf.ruleId}`,
        });
      }
    }

    session.status = "submitted";
    session.completed_at = new Date().toISOString();
    session.compiled_case_id = newCase.id;

    this.recordAudit(`kiosk:${params.kioskId}`, "INTAKE_CASE_COMPILED", "cases", newCase.id, {
      sessionId: params.sessionId,
      patientId: session.patient_id,
      facilityId: kiosk.facility_id,
      redFlagsCount: params.redFlags?.length || 0,
    });

    return newCase;
  }

  async executeIdempotentMutation(params: {
    idempotencyKey: string;
    userId: string;
    entity: string;
    action: string;
    payloadHash?: string;
    payload?: any;
  }): Promise<{
    idempotencyKey: string;
    status: "completed" | "in_progress" | "failed";
    isReplay: boolean;
    mutationId?: string;
    summary?: any;
  }> {
    if (!params.idempotencyKey || !params.idempotencyKey.trim()) {
      throw new Error("INVALID_ARGUMENT: idempotency_key is required");
    }

    const compositeKey = `${params.userId}:${params.idempotencyKey}`;
    const existing = this.syncMutations.get(compositeKey);

    if (existing) {
      if (existing.status === "completed") {
        if (existing.payload_hash && params.payloadHash && existing.payload_hash !== params.payloadHash) {
          throw new Error("CONFLICT_IDEMPOTENCY_PAYLOAD_MISMATCH: Payload does not match previously completed mutation");
        }
        return {
          idempotencyKey: params.idempotencyKey,
          status: "completed",
          isReplay: true,
          mutationId: existing.id,
          summary: existing.summary,
        };
      }

      if (
        existing.status === "in_progress" &&
        existing.lease_expires_at &&
        new Date(existing.lease_expires_at).getTime() > Date.now()
      ) {
        throw new Error("LOCKED_IN_PROGRESS: Mutation is currently being processed by another worker");
      }

      existing.status = "completed";
      existing.completed_at = new Date().toISOString();
      existing.payload_hash = params.payloadHash || existing.payload_hash;
      existing.summary = { success: true, action: params.action, entity: params.entity };

      this.recordAudit(params.userId, "SYNC_MUTATION_EXECUTED", params.entity, params.idempotencyKey, {
        action: params.action,
        mutationId: existing.id,
        payloadHash: params.payloadHash,
      });

      return {
        idempotencyKey: params.idempotencyKey,
        status: "completed",
        isReplay: false,
        mutationId: existing.id,
      };
    }

    const mutationId = crypto.randomUUID();
    let mutationSummary: any = { success: true, action: params.action, entity: params.entity };

    if (params.entity === "documents") {
      if (params.action === "create") {
        const docId = params.payload?.id || crypto.randomUUID();
        const docRecord = {
          id: docId,
          patient_id: params.payload?.patientId || params.payload?.patient_id,
          case_id: params.payload?.caseId || params.payload?.case_id || null,
          uploaded_by: params.userId,
          storage_path: params.payload?.storage_path || params.payload?.storagePath || "mock-storage/doc.pdf",
          original_filename: params.payload?.original_filename || params.payload?.originalFilename || "document.pdf",
          mime_type: params.payload?.mime_type || params.payload?.mimeType || "application/pdf",
          file_size: params.payload?.file_size || params.payload?.fileSize || 1024,
          document_type: params.payload?.document_type || params.payload?.documentType || "prescription",
          processing_status: params.payload?.processing_status || params.payload?.processingStatus || "uploaded",
          extracted_data: params.payload?.extracted_data || params.payload?.extractedData || null,
          ocr_confidence: params.payload?.ocr_confidence || params.payload?.ocrConfidence || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.documents.set(docId, docRecord as any);
        mutationSummary = { success: true, documentId: docId };
      } else if (params.action === "update") {
        const docId = params.payload?.id || params.payload?.documentId || params.payload?.document_id;
        const existingDoc = this.documents.get(docId);
        if (existingDoc) {
          if (params.payload?.extracted_data !== undefined) existingDoc.extracted_data = params.payload.extracted_data;
          if (params.payload?.extractedData !== undefined) existingDoc.extracted_data = params.payload.extractedData;
          if (params.payload?.processing_status !== undefined) existingDoc.processing_status = params.payload.processing_status;
          if (params.payload?.processingStatus !== undefined) existingDoc.processing_status = params.payload.processingStatus;
          if (params.payload?.ocr_confidence !== undefined) existingDoc.ocr_confidence = params.payload.ocr_confidence;
          if (params.payload?.ocrConfidence !== undefined) existingDoc.ocr_confidence = params.payload.ocrConfidence;
          existingDoc.updated_at = new Date().toISOString();
        }
        mutationSummary = { success: true, documentId: docId };
      }
    }

    const record = {
      id: mutationId,
      idempotency_key: params.idempotencyKey,
      user_id: params.userId,
      entity: params.entity,
      action: params.action,
      payload: params.payload,
      payload_hash: params.payloadHash,
      status: "completed",
      lease_expires_at: new Date(Date.now() + 60000).toISOString(),
      summary: mutationSummary,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };

    // Strictly user-scoped key: user A and user B can use the same idempotency key independently
    this.syncMutations.set(compositeKey, record);

    this.recordAudit(params.userId, "SYNC_MUTATION_EXECUTED", params.entity, params.idempotencyKey, {
      action: params.action,
      mutationId,
      payloadHash: params.payloadHash,
    });

    return {
      idempotencyKey: params.idempotencyKey,
      status: "completed",
      isReplay: false,
      mutationId,
      summary: mutationSummary,
    };
  }
}

const globalForMockDb = globalThis as unknown as {
  __medkit_mock_db?: MockDatabaseAdapter;
};

if (!globalForMockDb.__medkit_mock_db) {
  globalForMockDb.__medkit_mock_db = new MockDatabaseAdapter();
}

export const mockDb = globalForMockDb.__medkit_mock_db;
