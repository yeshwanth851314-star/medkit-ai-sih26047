import { Patient, ClinicalCase, MedicalDocument, AuditLogEntry } from "@/types/database";

// In-memory data store seeded from synthetic fixtures
class MockDatabaseAdapter {
  private patients: Map<string, Patient> = new Map();
  private cases: Map<string, ClinicalCase> = new Map();
  private documents: Map<string, MedicalDocument> = new Map();
  private consents: Map<string, any> = new Map();
  private auditLogs: AuditLogEntry[] = [];
  private isInitialized = false;

  constructor() {
    this.initializeFromFixtures();
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
    return Array.from(this.cases.values())
      .filter((c) => c.patient_id === patientId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getCaseById(id: string): Promise<ClinicalCase | null> {
    return this.cases.get(id) || null;
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

  // Documents
  async getDocumentsByPatientId(patientId: string): Promise<MedicalDocument[]> {
    return Array.from(this.documents.values()).filter((d) => d.patient_id === patientId);
  }

  async getDocumentById(id: string): Promise<MedicalDocument | null> {
    return this.documents.get(id) || null;
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

  async revokeConsent(id: string): Promise<any | null> {
    const existing = this.consents.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      revoked: true,
      revoked_at: new Date().toISOString(),
    };
    this.consents.set(id, updated);
    return updated;
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

  getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }
}

const globalForMockDb = globalThis as unknown as {
  __medkit_mock_db?: MockDatabaseAdapter;
};

if (!globalForMockDb.__medkit_mock_db) {
  globalForMockDb.__medkit_mock_db = new MockDatabaseAdapter();
}

export const mockDb = globalForMockDb.__medkit_mock_db;
