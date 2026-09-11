import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import { mockDb } from "@/lib/db/mock-adapter";
import { Patient, ClinicalCase, MedicalDocument, IntakeSessionRecord } from "@/types/database";
import type { AuthUser } from "@/features/auth/types";
import { toBucketRelativePath } from "@/lib/storage/document-storage-validator";

/**
 * Create an ephemeral, request-bound Supabase client.
 * In a serverless/multi-user Node.js environment, persistSession MUST be false
 * to eliminate cross-request auth leakage and guarantee immutable per-request identity.
 */
export function createRequestSupabaseClient(
  accessToken?: string,
  configOverride?: { supabaseUrl?: string; supabaseAnonKey?: string }
): SupabaseClient | null {
  const url = configOverride?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || env.supabaseUrl;
  const anonKey = configOverride?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.supabaseAnonKey;

  if (!url || !anonKey) {
    return null;
  }

  try {
    return createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: accessToken
        ? {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        : undefined,
    });
  } catch (err) {
    console.warn("Failed to initialize request-bound Supabase client:", err);
    return null;
  }
}

/**
 * Server-only service role client for authoritative operations (e.g. audit logs, amendments).
 * Strictly enforces persistSession: false. Never exposes service role key to client.
 */
export function getServiceSupabaseClient(
  configOverride?: { supabaseUrl?: string; serviceKey?: string }
): SupabaseClient | null {
  const url = configOverride?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || env.supabaseUrl;
  const serviceKey =
    configOverride?.serviceKey ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env.supabaseServiceKey;

  if (!url || !serviceKey) {
    if (!env.isDemoMode) {
      console.error("CRITICAL: SUPABASE_SERVICE_ROLE_KEY is required for service-role database operations in production.");
    }
    return null;
  }

  try {
    return createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch (err) {
    console.warn("Failed to initialize service-role Supabase client:", err);
    return null;
  }
}

/**
 * Standard database client getter. Returns a fresh, unpolluted request-bound client.
 */
export function getSupabaseClient(
  accessToken?: string,
  configOverride?: { supabaseUrl?: string; supabaseAnonKey?: string }
): SupabaseClient | null {
  return createRequestSupabaseClient(accessToken, configOverride);
}

/**
 * Safely extracts access token from either a string or an AuthUser object
 */
export function extractAccessToken(actorOrToken?: AuthUser | string | null): string | undefined {
  if (!actorOrToken) return undefined;
  if (typeof actorOrToken === "string") return actorOrToken;
  return actorOrToken.supabaseToken;
}

/**
 * Returns a Supabase client scoped to the authorized user's session token
 */
export function getAuthorizedSupabaseClient(
  actorOrToken?: AuthUser | string | null,
  configOverride?: { supabaseUrl?: string; supabaseAnonKey?: string }
): SupabaseClient | null {
  const token = extractAccessToken(actorOrToken);
  if (!token || typeof token !== "string" || token.trim() === "") {
    return null;
  }
  return getSupabaseClient(token, configOverride);
}

/**
 * Revalidates the authenticated clinical profile against the live database.
 * This makes account deactivation effective immediately instead of waiting for
 * the application JWT to expire.
 */
export async function verifyActiveClinicalProfile(user: AuthUser): Promise<AuthUser | null> {
  if (env.isDemoMode) return user;

  const supabase = getAuthorizedSupabaseClient(user) || getServiceSupabaseClient();
  if (!supabase) {
    throw new Error("DATABASE_UNAVAILABLE: Supabase client unavailable for active-profile verification");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role, facility_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`DATABASE_UNAVAILABLE: Failed to verify active profile: ${error.message}`);
  }
  if (!profile || profile.is_active !== true) return null;
  if (!["doctor", "clinician", "staff", "admin"].includes(profile.role)) return null;

  return {
    ...user,
    fullName: profile.full_name || user.fullName,
    role: profile.role as AuthUser["role"],
    facilityId: profile.facility_id || null,
  };
}

// Unified Data Access Interface for Patients
export async function getPatients(
  searchQuery?: string,
  actorOrToken?: AuthUser | string | null
): Promise<Patient[]> {
  if (env.isDemoMode) {
    return mockDb.getPatients(searchQuery);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  let query = supabase.from("patients").select("*").order("created_at", { ascending: false });
  if (searchQuery && searchQuery.trim()) {
    query = query.or(`full_name.ilike.%${searchQuery}%,patient_code.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Supabase getPatients error:", error);
    throw new Error(`Database error fetching patients: ${error.message}`);
  }

  return (data || []) as Patient[];
}

export async function getPatientById(
  id: string,
  actorOrToken?: AuthUser | string | null
): Promise<Patient | null> {
  if (env.isDemoMode) {
    return mockDb.getPatientById(id);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("Supabase getPatientById error:", error);
    throw new Error(`Database error fetching patient ${id}: ${error.message}`);
  }

  return (data || null) as Patient | null;
}

export async function createPatient(
  payload: Omit<Patient, "id" | "created_at" | "updated_at">,
  actorOrToken?: AuthUser | string | null
): Promise<Patient> {
  if (env.isDemoMode) {
    return mockDb.createPatient(payload);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase.from("patients").insert([payload]).select().single();
  if (error) {
    console.error("Supabase createPatient error:", error);
    throw new Error(`Database error creating patient: ${error.message}`);
  }

  return data as Patient;
}

// Unified Data Access Interface for Cases
export async function getCasesByPatientId(
  patientId: string,
  actorOrToken?: AuthUser | string | null
): Promise<ClinicalCase[]> {
  if (env.isDemoMode) {
    return mockDb.getCasesByPatientId(patientId);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase getCasesByPatientId error:", error);
    throw new Error(`Database error fetching cases for patient ${patientId}: ${error.message}`);
  }

  return (data || []) as ClinicalCase[];
}

export async function getCaseById(
  id: string,
  actorOrToken?: AuthUser | string | null
): Promise<ClinicalCase | null> {
  if (env.isDemoMode) {
    return mockDb.getCaseById(id);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase.from("cases").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("Supabase getCaseById error:", error);
    throw new Error(`Database error fetching case ${id}: ${error.message}`);
  }

  if (!data) return null;

  // Dynamically attach amendments from dedicated case_amendments table
  try {
    const amendments = await getCaseAmendments(id, actorOrToken);
    if (amendments && amendments.length > 0) {
      data.amendments = amendments.map((a: any) => ({
        id: a.id,
        version: a.version,
        actor_id: a.author_id || a.actor_id,
        actor_name: a.author_name || a.actor_name,
        timestamp: a.created_at || a.timestamp,
        reason: a.reason,
        notes: a.notes,
      }));
    }
  } catch (err) {
    console.warn("Could not load case amendments for case", id, err);
  }

  return data as ClinicalCase;
}

export async function createCase(
  payload: Omit<ClinicalCase, "id" | "created_at" | "updated_at">,
  actorOrToken?: AuthUser | string | null
): Promise<ClinicalCase> {
  if (env.isDemoMode) {
    return mockDb.createCase(payload);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase.from("cases").insert([payload]).select().single();
  if (error) {
    console.error("Supabase createCase error:", error);
    throw new Error(`Database error creating case: ${error.message}`);
  }

  return data as ClinicalCase;
}

export async function updateCase(
  id: string,
  updates: Partial<ClinicalCase>,
  actorOrToken?: AuthUser | string | null
): Promise<ClinicalCase | null> {
  if (env.isDemoMode) {
    return mockDb.updateCase(id, updates);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase
    .from("cases")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Supabase updateCase error:", error);
    throw new Error(`Database error updating case ${id}: ${error.message}`);
  }

  return data as ClinicalCase;
}

// Case Amendments (Dedicated Immutable Append-Only Storage)
export async function getCaseAmendments(
  caseId: string,
  actorOrToken?: AuthUser | string | null
): Promise<any[]> {
  if (env.isDemoMode) {
    return mockDb.getCaseAmendments(caseId);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken) || getServiceSupabaseClient();
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase
    .from("case_amendments")
    .select("*")
    .eq("case_id", caseId)
    .order("version", { ascending: true });

  if (error) {
    console.error("Supabase getCaseAmendments error:", error);
    throw new Error(`Database error fetching amendments for case ${caseId}: ${error.message}`);
  }

  return data || [];
}

export async function createCaseAmendment(
  amendment: {
    id?: string;
    case_id: string;
    author_id: string;
    author_name?: string | null;
    reason: string;
    notes: string;
    version: number;
    created_at?: string;
  },
  actorOrToken?: AuthUser | string | null
): Promise<any> {
  if (env.isDemoMode) {
    return mockDb.createCaseAmendment(amendment);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken) || getServiceSupabaseClient();
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase
    .from("case_amendments")
    .insert([amendment])
    .select()
    .single();

  if (error) {
    console.error("Supabase createCaseAmendment error:", error);
    throw new Error(`Database error recording amendment for case ${amendment.case_id}: ${error.message}`);
  }

  return data;
}

// Unified Data Access Interface for Documents
export async function getDocumentsByPatientId(
  patientId: string,
  actorOrToken?: AuthUser | string | null
): Promise<MedicalDocument[]> {
  if (env.isDemoMode) {
    return mockDb.getDocumentsByPatientId(patientId);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase getDocumentsByPatientId error:", error);
    throw new Error(`Database error fetching documents for patient ${patientId}: ${error.message}`);
  }

  return (data || []) as MedicalDocument[];
}

export async function getDocumentById(
  id: string,
  actorOrToken?: AuthUser | string | null
): Promise<MedicalDocument | null> {
  if (env.isDemoMode) {
    return mockDb.getDocumentById(id);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Supabase getDocumentById error:", error);
    throw new Error(`Database error fetching document ${id}: ${error.message}`);
  }

  return (data || null) as MedicalDocument | null;
}

export async function createDocument(
  payload: Omit<MedicalDocument, "created_at">,
  actorOrToken?: AuthUser | string | null
): Promise<MedicalDocument> {
  if (env.isDemoMode) {
    return mockDb.createDocument(payload);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase.from("documents").insert([payload]).select().single();
  if (error) {
    console.error("Supabase createDocument error:", error);
    throw new Error(`Database error creating document: ${error.message}`);
  }

  return data as MedicalDocument;
}

export async function updateDocument(
  id: string,
  updates: Partial<MedicalDocument>,
  actorOrToken?: AuthUser | string | null
): Promise<MedicalDocument | null> {
  if (env.isDemoMode) {
    return mockDb.updateDocument(id, updates);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Supabase updateDocument error:", error);
    throw new Error(`Database error updating document ${id}: ${error.message}`);
  }

  return data as MedicalDocument;
}

export async function uploadDocumentToStorage(
  patientId: string,
  caseId: string | null,
  docId: string,
  fileName: string,
  fileBytes: Uint8Array | ArrayBuffer,
  mimeType: string,
  actorOrToken?: AuthUser | string | null
): Promise<{ storagePath: string }> {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const caseFolder = caseId || "uncategorized";
  const storagePath = `patients/${patientId}/cases/${caseFolder}/${docId}/${safeFileName}`;

  const fullStoragePath = `/private/documents/${storagePath}`;

  if (env.isDemoMode) {
    const buf = fileBytes instanceof Uint8Array
      ? Buffer.from(fileBytes.buffer, fileBytes.byteOffset, fileBytes.byteLength)
      : Buffer.from(fileBytes);
    mockDb.saveStorageFile(fullStoragePath, buf, mimeType);
    return { storagePath: fullStoragePath };
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) {
    throw new Error("Storage unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  try {
    const { error } = await supabase.storage
      .from("clinical-documents")
      .upload(storagePath, fileBytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error(`Supabase Storage upload error for ${storagePath}:`, error.message);
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }
  } catch (storageErr: any) {
    console.error("Storage upload exception:", storageErr);
    throw new Error(`Failed to persist document to private storage: ${storageErr.message}`);
  }

  return { storagePath: fullStoragePath };
}

export async function downloadDocumentFromStorage(
  storagePath: string,
  actorOrToken?: AuthUser | string | null
): Promise<{ buffer: Buffer; mimeType?: string } | null> {
  // Enforce cross-facility isolation on document downloads
  if (actorOrToken && typeof actorOrToken === "object" && actorOrToken.role !== "admin" && actorOrToken.facilityId) {
    const match = storagePath.match(/patients\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const patient = await getPatientById(match[1], actorOrToken);
      if (patient && patient.facility_id && patient.facility_id !== actorOrToken.facilityId) {
        console.warn(`[Security Alert] Denied cross-facility document download attempt: actor facility '${actorOrToken.facilityId}' vs patient facility '${patient.facility_id}'`);
        return null;
      }
    }
  }

  if (env.isDemoMode) {
    const file = mockDb.getStorageFile(storagePath);
    if (!file) return null;
    return { buffer: file.bytes, mimeType: file.mimeType };
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) return null;

  const cleanPath = storagePath.replace(/^\/private\/documents\//, "");
  const { data, error } = await supabase.storage
    .from("clinical-documents")
    .download(cleanPath);

  if (error || !data) {
    console.error("Failed to download document from storage:", error);
    return null;
  }

  const arrayBuffer = await data.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: data.type };
}

export async function deleteDocumentFromStorage(
  storagePath: string,
  actorOrToken?: AuthUser | string | null
): Promise<void> {
  if (env.isDemoMode) {
    mockDb.deleteStorageFile(storagePath);
    return;
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) return;

  const cleanPath = storagePath.replace(/^\/private\/documents\//, "");
  const { error } = await supabase.storage
    .from("clinical-documents")
    .remove([cleanPath]);

  if (error) {
    console.error("Failed to delete document from storage:", error.message);
  }
}

/**
 * Generate a private, short-lived signed URL for an authorized clinician to view or download a document.
 * Unrestricted public URLs are strictly prohibited.
 */
export async function getDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds: number = 300,
  actorOrToken?: AuthUser | string | null
): Promise<string | null> {
  if (env.isDemoMode) {
    return `/api/documents/mock-file?path=${encodeURIComponent(storagePath)}`;
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) return null;

  const cleanPath = storagePath.replace(/^\/private\/documents\//, "");
  const { data, error } = await supabase.storage
    .from("clinical-documents")
    .createSignedUrl(cleanPath, expiresInSeconds);

  if (error) {
    console.error("Failed to create signed document URL:", error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Verify that a referenced Supabase Storage object actually exists in the clinical-documents bucket.
 * Uses caller auth to enforce Storage RLS policies.
 */
export async function verifyStorageObjectExists(
  storagePath: string,
  actorOrToken?: AuthUser | string | null
): Promise<boolean> {
  if (env.isDemoMode) {
    const exists = mockDb.hasStorageFile(storagePath);
    if (!exists) {
      throw new Error(`STORAGE_OBJECT_NOT_FOUND: Storage object does not exist at '${storagePath}'`);
    }
    return true;
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) {
    throw new Error("STORAGE_VERIFICATION_FAILED: Supabase client unavailable to verify storage object");
  }

  const cleanPath = toBucketRelativePath(storagePath);
  const lastSlash = cleanPath.lastIndexOf("/");
  const parentFolder = lastSlash >= 0 ? cleanPath.substring(0, lastSlash) : "";
  const fileName = lastSlash >= 0 ? cleanPath.substring(lastSlash + 1) : cleanPath;

  const { data, error } = await supabase.storage
    .from("clinical-documents")
    .list(parentFolder, { search: fileName, limit: 10 });

  if (error) {
    console.error(`Supabase storage list error for ${parentFolder}:`, error.message);
    throw new Error(`STORAGE_VERIFICATION_FAILED: Database error inspecting storage: ${error.message}`);
  }

  const found = data?.some((item) => item.name === fileName);
  if (!found) {
    throw new Error(`STORAGE_OBJECT_NOT_FOUND: Storage object does not exist at '${storagePath}'`);
  }

  return true;
}

/**
 * Server-Side Idempotency Helpers (Sync Mutations)
 * Guarantees duplicate mutations replayed across restarts or workers are never executed more than once.
 */
export async function isIdempotencyKeyProcessed(
  key: string,
  actorOrToken?: AuthUser | string | null
): Promise<boolean> {
  if (env.isDemoMode) {
    return mockDb.isIdempotencyKeyProcessed(key);
  }
  void actorOrToken;
  throw new Error(
    "ATOMIC_SYNC_REQUIRED: Production idempotency state is controlled exclusively by rpc_execute_idempotent_mutation"
  );
}

export async function reserveIdempotencyKey(params: {
  key: string;
  userId: string;
  entity: string;
  action: string;
  payloadHash?: string;
  actorOrToken?: AuthUser | string | null;
}): Promise<{ claimed: boolean; status?: "in_progress" | "completed" | "failed" | "conflict"; resourceId?: string }> {
  if (env.isDemoMode) {
    return mockDb.reserveIdempotencyKey(params);
  }
  throw new Error(
    "ATOMIC_SYNC_REQUIRED: Production idempotency reservations must use rpc_execute_idempotent_mutation"
  );
}

export async function executeIdempotentMutation(params: {
  idempotencyKey: string;
  userId: string;
  entity: string;
  action: string;
  payloadHash?: string;
  payload?: any;
  actorOrToken?: AuthUser | string | null;
}): Promise<{
  idempotencyKey: string;
  status: "completed" | "in_progress" | "failed";
  isReplay: boolean;
  mutationId?: string;
  resourceId?: string | null;
  summary?: any;
}> {
  if (env.isDemoMode) {
    return mockDb.executeIdempotentMutation(params);
  }

  const supabase = getAuthorizedSupabaseClient(params.actorOrToken);
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase.rpc("rpc_execute_idempotent_mutation", {
    p_idempotency_key: params.idempotencyKey,
    p_entity: params.entity,
    p_action: params.action,
    p_payload_hash: params.payloadHash || null,
    p_payload: params.payload || {},
  });

  if (error) {
    console.error("Supabase rpc_execute_idempotent_mutation error:", error.message);
    throw new Error(`Database error executing idempotent mutation: ${error.message}`);
  }

  return data as any;
}

export async function registerKioskInstance(instance: {
  id?: string;
  facility_id?: string;
  name: string;
  secretHash: string;
  status?: "active" | "disabled" | "revoked";
  expiresAt?: string | null;
  actorOrToken?: AuthUser | string | null;
}): Promise<any> {
  if (env.isDemoMode) {
    return mockDb.registerKioskInstance({
      id: instance.id,
      facility_id: instance.facility_id,
      name: instance.name,
      secretHash: instance.secretHash,
      status: instance.status,
      expiresAt: instance.expiresAt,
      actorOrToken: instance.actorOrToken,
    });
  }

  const supabase = getAuthorizedSupabaseClient(instance.actorOrToken) || getServiceSupabaseClient();
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase.rpc("rpc_provision_kiosk", {
    p_name: instance.name,
    p_secret_hash: instance.secretHash,
    p_expires_at: instance.expiresAt || null,
  });

  if (error) {
    console.error("Supabase rpc_provision_kiosk error:", error.message);
    throw new Error(`Failed to provision kiosk: ${error.message}`);
  }
  return data;
}

export async function submitIntakeToCase(params: {
  sessionId: string;
  kioskId: string;
  kioskSecret: string;
  redFlags?: any[];
}): Promise<ClinicalCase> {
  if (env.isDemoMode) {
    return mockDb.submitIntakeToCase(params);
  }

  const supabase = getServiceSupabaseClient() || getSupabaseClient();
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase.rpc("rpc_submit_intake_to_case", {
    p_session_id: params.sessionId,
    p_kiosk_id: params.kioskId,
    p_kiosk_secret: params.kioskSecret,
    p_red_flags: params.redFlags || [],
  });

  if (error) {
    console.error("Supabase rpc_submit_intake_to_case error:", error.message);
    throw new Error(`Database error compiling kiosk intake to case: ${error.message}`);
  }

  return data as ClinicalCase;
}

export async function getKioskIntakeSession(params: {
  kioskId: string;
  kioskSecret: string;
  sessionId: string;
}): Promise<IntakeSessionRecord | null> {
  if (env.isDemoMode) {
    return mockDb.getKioskIntakeSession(params);
  }

  const supabase = getSupabaseClient() || getServiceSupabaseClient();
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured.");
  }

  const { data, error } = await supabase.rpc("rpc_get_kiosk_intake_session", {
    p_kiosk_id: params.kioskId,
    p_kiosk_secret: params.kioskSecret,
    p_session_id: params.sessionId,
  });

  if (error) {
    console.error("Supabase rpc_get_kiosk_intake_session error:", error.message);
    throw new Error(`Database error fetching kiosk intake session: ${error.message}`);
  }

  return (data || null) as IntakeSessionRecord | null;
}

export async function submitKioskAnswer(params: {
  kioskId: string;
  kioskSecret: string;
  sessionId: string;
  questionKey: string;
  rawAnswer: string;
  inputMode?: string;
  nextQuestionId?: string | null;
}): Promise<IntakeSessionRecord> {
  if (env.isDemoMode) {
    return mockDb.submitKioskAnswer(params) as any;
  }

  const supabase = getSupabaseClient() || getServiceSupabaseClient();
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured.");
  }

  const { data, error } = await supabase.rpc("rpc_submit_kiosk_answer", {
    p_kiosk_id: params.kioskId,
    p_kiosk_secret: params.kioskSecret,
    p_session_id: params.sessionId,
    p_question_key: params.questionKey,
    p_raw_answer: params.rawAnswer,
    p_input_mode: params.inputMode || "touch",
    p_next_question_id: params.nextQuestionId || null,
  });

  if (error) {
    console.error("Supabase rpc_submit_kiosk_answer error:", error.message);
    throw new Error(`Database error submitting kiosk answer: ${error.message}`);
  }

  return data as IntakeSessionRecord;
}

export async function revokeKioskSession(params: {
  kioskId: string;
  kioskSecret: string;
  sessionId: string;
  reason?: string;
  targetStatus?: "abandoned" | "submitted";
}): Promise<void> {
  if (env.isDemoMode) {
    await mockDb.revokeKioskSession(params);
    return;
  }

  const supabase = getSupabaseClient() || getServiceSupabaseClient();
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured.");
  }

  const { error } = await supabase.rpc("rpc_revoke_kiosk_session", {
    p_kiosk_id: params.kioskId,
    p_kiosk_secret: params.kioskSecret,
    p_session_id: params.sessionId,
    p_reason: params.reason || "abandoned_or_revoked",
    p_target_status: params.targetStatus || "abandoned",
  });

  if (error) {
    console.error("Supabase rpc_revoke_kiosk_session error:", error.message);
    throw new Error(`Database error revoking kiosk session: ${error.message}`);
  }
}

export async function revokeKioskSessionDurable(
  sessionId: string,
  options?: {
    targetStatus?: "abandoned" | "submitted";
    reason?: string;
    kioskId?: string;
    kioskSecret?: string;
    actorOrToken?: AuthUser | string | null;
  }
): Promise<void> {
  const targetStatus = options?.targetStatus || "abandoned";
  if (!["abandoned", "submitted"].includes(targetStatus)) {
    throw new Error(`INVALID_TARGET_STATUS: Target status must be abandoned or submitted, received ${targetStatus}`);
  }
  const reason = options?.reason || "kiosk_session_revoked";

  if (env.isDemoMode) {
    const session = await mockDb.getIntakeSessionById(sessionId);
    if (session && session.status !== targetStatus) {
      if (session.status !== "active") {
        throw new Error(`INVALID_STATE_TRANSITION: Cannot transition session ${sessionId} from ${session.status} to ${targetStatus}`);
      }
    }

    if (options?.kioskId && options?.kioskSecret) {
      await mockDb.revokeKioskSession({
        kioskId: options.kioskId,
        kioskSecret: options.kioskSecret,
        sessionId,
        reason,
        targetStatus,
      });
      return;
    }
    if (options?.actorOrToken) {
      const user = typeof options.actorOrToken === "object" ? options.actorOrToken : null;
      if (user && user.role !== "admin" && user.facilityId && session) {
        if (session.facility_id && session.facility_id !== user.facilityId) {
          throw new Error(`FORBIDDEN: Clinician facility ${user.facilityId} does not match session facility ${session.facility_id}`);
        }
      }
    }
    await mockDb.updateIntakeSession(sessionId, { status: targetStatus, completed_at: new Date().toISOString() });
    mockDb.recordRevocation(sessionId, reason, targetStatus);
    return;
  }

  if (options?.kioskId && options?.kioskSecret) {
    const supabase = getSupabaseClient() || getServiceSupabaseClient();
    if (!supabase) {
      throw new Error("Database unavailable: Supabase client is not configured to record session revocation.");
    }
    const { error } = await supabase.rpc("rpc_revoke_kiosk_session", {
      p_kiosk_id: options.kioskId,
      p_kiosk_secret: options.kioskSecret,
      p_session_id: sessionId,
      p_reason: reason,
      p_target_status: targetStatus,
    });
    if (error) {
      console.error("Supabase rpc_revoke_kiosk_session error:", error.message);
      throw new Error(`Failed to durably revoke kiosk session: ${error.message}`);
    }
    return;
  }

  if (options?.actorOrToken) {
    const supabase = getAuthorizedSupabaseClient(options.actorOrToken);
    if (!supabase) {
      throw new Error("Database unavailable: Supabase client is not configured to record session revocation.");
    }
    // Clinician-authenticated durable revocation via atomic facility-checked RPC
    const { error: revErr } = await supabase.rpc("rpc_clinician_revoke_session", {
      p_session_id: sessionId,
      p_reason: reason,
      p_target_status: targetStatus,
    });
    if (revErr) {
      console.error("Failed to revoke kiosk session via rpc_clinician_revoke_session:", revErr.message);
      throw new Error(`Database error recording capability revocation: ${revErr.message}`);
    }
    return;
  }

  // In production without kiosk credentials and without clinician auth: FAIL CLOSED!
  throw new Error("UNAUTHORIZED: Kiosk credentials or clinician authorization required for durable session revocation");
}

export type DurableSessionState =
  | { status: "active"; session: IntakeSessionRecord }
  | { status: "revoked"; reason?: string }
  | { status: "expired" }
  | { status: "submitted" }
  | { status: "abandoned" };

export async function verifyDurableSessionState(params: {
  sessionId: string;
  kioskId?: string;
  kioskSecret?: string;
}): Promise<DurableSessionState> {
  if (env.isDemoMode) {
    if (mockDb.isSessionRevoked(params.sessionId)) {
      return { status: "revoked" };
    }
    const session = await mockDb.getIntakeSessionById(params.sessionId);
    if (!session) {
      // In demo mode, if session is not explicitly stored in mockDb, treat unrevoked token as active
      return {
        status: "active",
        session: {
          id: params.sessionId,
          patient_id: "",
          facility_id: "",
          status: "active",
          language: "en",
          current_question_id: "Q_CHIEF_COMPLAINT",
          answers: {},
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          started_at: new Date().toISOString(),
        },
      };
    }
    if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
      return { status: "expired" };
    }
    switch (session.status) {
      case "active":
        return { status: "active", session };
      case "submitted":
        return { status: "submitted" };
      case "abandoned":
        return { status: "abandoned" };
      case "revoked":
        return { status: "revoked" };
      default:
        // Any unrecognized or unknown status fails closed as revoked
        return { status: "revoked" };
    }
  }

  const supabase = getSupabaseClient() || getServiceSupabaseClient();
  if (!supabase) {
    throw new Error("DATABASE_UNAVAILABLE: Supabase client is not configured to verify session state (fail-closed).");
  }

  // If kiosk credentials provided, use the secure RPC as the authoritative session lookup
  if (params.kioskId && params.kioskSecret) {
    const { data, error } = await supabase.rpc("rpc_get_kiosk_intake_session", {
      p_kiosk_id: params.kioskId,
      p_kiosk_secret: params.kioskSecret,
      p_session_id: params.sessionId,
    });
    if (error) {
      if (error.message?.includes("SESSION_NOT_FOUND")) {
        return { status: "revoked" };
      }
      throw new Error(`Database error verifying kiosk session: ${error.message}`);
    }
    if (!data) return { status: "revoked" };
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return { status: "expired" };
    }
    switch (data.status) {
      case "active":
        return { status: "active", session: data };
      case "submitted":
        return { status: "submitted" };
      case "abandoned":
        return { status: "abandoned" };
      case "revoked":
        return { status: "revoked" };
      default:
        // Fail-closed on any unrecognized status
        return { status: "revoked" };
    }
  }

  // Check revocation table
  const { data: revData, error: revErr } = await supabase
    .from("kiosk_capability_revocations")
    .select("session_id, reason")
    .eq("session_id", params.sessionId)
    .maybeSingle();

  if (revErr) {
    throw new Error(`Database error querying revocations: ${revErr.message}`);
  }
  if (revData) return { status: "revoked", reason: revData.reason };

  // Check intake_sessions table status
  const { data: sessionData, error: sessErr } = await supabase
    .from("intake_sessions")
    .select("*")
    .eq("id", params.sessionId)
    .maybeSingle();

  if (sessErr) {
    throw new Error(`Database error querying intake_sessions: ${sessErr.message}`);
  }
  if (!sessionData) return { status: "revoked" };
  if (sessionData.expires_at && new Date(sessionData.expires_at).getTime() < Date.now()) {
    return { status: "expired" };
  }

  switch (sessionData.status) {
    case "active":
      return { status: "active", session: sessionData };
    case "submitted":
      return { status: "submitted" };
    case "abandoned":
      return { status: "abandoned" };
    case "revoked":
      return { status: "revoked" };
    default:
      // Fail-closed on any unrecognized status
      return { status: "revoked" };
  }
}

export async function isSessionDurableRevoked(
  sessionId: string,
  options?: { kioskId?: string; kioskSecret?: string }
): Promise<boolean> {
  const state = await verifyDurableSessionState({ sessionId, ...options });
  return state.status !== "active";
}

export async function updateSyncMutationStatus(params: {
  key: string;
  status: "completed" | "failed";
  resourceId?: string;
  errorMessage?: string;
  actorOrToken?: AuthUser | string | null;
}): Promise<void> {
  if (env.isDemoMode) {
    mockDb.updateSyncMutationStatus(params);
    return;
  }
  throw new Error(
    "ATOMIC_SYNC_REQUIRED: Production sync ledger updates are internal to rpc_execute_idempotent_mutation"
  );
}

export async function recordProcessedIdempotencyKey(params: {
  key: string;
  userId: string;
  entity: string;
  action: string;
  resourceId?: string;
  status?: "completed" | "failed";
  errorMessage?: string;
  actorOrToken?: AuthUser | string | null;
}): Promise<void> {
  if (env.isDemoMode) {
    mockDb.recordSyncMutation({
      idempotency_key: params.key,
      user_id: params.userId,
      entity: params.entity,
      action: params.action,
      resource_id: params.resourceId,
      status: params.status || "completed",
      error_message: params.errorMessage,
    });
    return;
  }
  throw new Error(
    "ATOMIC_SYNC_REQUIRED: Production sync ledger writes are internal to rpc_execute_idempotent_mutation"
  );
}

export async function createRedFlagEvent(
  event: {
    caseId: string;
    ruleId: string;
    severity: string;
    triggerText: string;
    acknowledgedBy?: string | null;
    acknowledgedAt?: string | null;
  },
  actorOrToken?: AuthUser | string | null
): Promise<any> {
  if (env.isDemoMode) {
    return mockDb.recordRedFlagEvent({
      case_id: event.caseId,
      rule_id: event.ruleId,
      severity: event.severity.toUpperCase(),
      trigger_text: event.triggerText,
      acknowledged_by: event.acknowledgedBy,
      acknowledged_at: event.acknowledgedAt,
    });
  }

  // Red flag events are clinical evidence generated by the rules engine
  // Direct insert from authenticated/anon is locked down; trusted internal workflow uses service role
  const supabase = getServiceSupabaseClient() || getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase
    .from("red_flag_events")
    .insert([
      {
        case_id: event.caseId,
        rule_id: event.ruleId,
        severity: event.severity.toUpperCase(),
        trigger_text: event.triggerText,
        acknowledged_by: event.acknowledgedBy || null,
        acknowledged_at: event.acknowledgedAt || null,
        created_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Supabase createRedFlagEvent error:", error.message);
    throw new Error(`Failed to persist red flag event for rule ${event.ruleId}: ${error.message}`);
  }
  return data;
}

export async function getRedFlagEventsByCaseId(
  caseId: string,
  actorOrToken?: AuthUser | string | null
): Promise<any[]> {
  if (env.isDemoMode) {
    return mockDb.getRedFlagEvents(caseId);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken);
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("red_flag_events")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error fetching red flag events:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("Exception fetching red flag events:", err);
    return [];
  }
}

// Durable Kiosk Intake Sessions (Database-backed)
export async function createIntakeSession(
  session: Omit<IntakeSessionRecord, "id" | "started_at"> & { id?: string },
  actorOrToken?: AuthUser | string | null
): Promise<IntakeSessionRecord> {
  if (env.isDemoMode) {
    return mockDb.createIntakeSession(session);
  }

  const supabase = actorOrToken
    ? getAuthorizedSupabaseClient(actorOrToken)
    : getServiceSupabaseClient();
  if (!supabase) {
    if (actorOrToken) {
      throw new Error("UNAUTHORIZED: Valid clinician session token required to create intake session");
    }
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase
    .from("intake_sessions")
    .insert([session])
    .select()
    .single();

  if (error) {
    console.error("Supabase createIntakeSession error:", error);
    throw new Error(`Database error creating intake session: ${error.message}`);
  }

  return data as IntakeSessionRecord;
}

export async function getIntakeSessionById(
  id: string,
  actorOrToken?: AuthUser | string | null
): Promise<IntakeSessionRecord | null> {
  if (env.isDemoMode) {
    return mockDb.getIntakeSessionById(id);
  }

  const supabase = actorOrToken
    ? getAuthorizedSupabaseClient(actorOrToken)
    : getServiceSupabaseClient();
  if (!supabase) {
    if (actorOrToken) {
      throw new Error("UNAUTHORIZED: Valid clinician session token required to load intake session");
    }
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase
    .from("intake_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Supabase getIntakeSessionById error:", error);
    throw new Error(`Database error fetching intake session ${id}: ${error.message}`);
  }

  return (data || null) as IntakeSessionRecord | null;
}

export async function updateIntakeSession(
  id: string,
  updates: Partial<IntakeSessionRecord>,
  actorOrToken?: AuthUser | string | null
): Promise<IntakeSessionRecord | null> {
  if (env.isDemoMode) {
    return mockDb.updateIntakeSession(id, updates);
  }

  const supabase = actorOrToken
    ? getAuthorizedSupabaseClient(actorOrToken)
    : getServiceSupabaseClient();
  if (!supabase) {
    if (actorOrToken) {
      throw new Error("UNAUTHORIZED: Valid clinician session token required to update intake session");
    }
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase
    .from("intake_sessions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Supabase updateIntakeSession error:", error);
    throw new Error(`Database error updating intake session ${id}: ${error.message}`);
  }

  return (data || null) as IntakeSessionRecord | null;
}

export async function deleteIntakeSession(
  id: string,
  actorOrToken?: AuthUser | string | null
): Promise<boolean> {
  if (env.isDemoMode) {
    return mockDb.deleteIntakeSession(id);
  }

  const supabase = getAuthorizedSupabaseClient(actorOrToken) || getServiceSupabaseClient();
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { error } = await supabase
    .from("intake_sessions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Supabase deleteIntakeSession error:", error);
    return false;
  }

  return true;
}
