import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import { mockDb } from "@/lib/db/mock-adapter";
import { Patient, ClinicalCase, MedicalDocument } from "@/types/database";

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
    env.supabaseServiceKey ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.supabaseAnonKey;

  if (!url || !serviceKey) {
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

// Unified Data Access Interface for Patients
export async function getPatients(searchQuery?: string): Promise<Patient[]> {
  if (env.isDemoMode) {
    return mockDb.getPatients(searchQuery);
  }

  const supabase = getSupabaseClient();
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

export async function getPatientById(id: string): Promise<Patient | null> {
  if (env.isDemoMode) {
    return mockDb.getPatientById(id);
  }

  const supabase = getSupabaseClient();
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

export async function createPatient(payload: Omit<Patient, "id" | "created_at" | "updated_at">): Promise<Patient> {
  if (env.isDemoMode) {
    return mockDb.createPatient(payload);
  }

  const supabase = getSupabaseClient();
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
export async function getCasesByPatientId(patientId: string): Promise<ClinicalCase[]> {
  if (env.isDemoMode) {
    return mockDb.getCasesByPatientId(patientId);
  }

  const supabase = getSupabaseClient();
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

export async function getCaseById(id: string): Promise<ClinicalCase | null> {
  if (env.isDemoMode) {
    return mockDb.getCaseById(id);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Database unavailable: Supabase client is not configured and system is not in demo mode.");
  }

  const { data, error } = await supabase.from("cases").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("Supabase getCaseById error:", error);
    throw new Error(`Database error fetching case ${id}: ${error.message}`);
  }

  return (data || null) as ClinicalCase | null;
}

export async function createCase(payload: Omit<ClinicalCase, "id" | "created_at" | "updated_at">): Promise<ClinicalCase> {
  if (env.isDemoMode) {
    return mockDb.createCase(payload);
  }

  const supabase = getSupabaseClient();
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

export async function updateCase(id: string, updates: Partial<ClinicalCase>): Promise<ClinicalCase | null> {
  if (env.isDemoMode) {
    return mockDb.updateCase(id, updates);
  }

  const supabase = getSupabaseClient();
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

// Unified Data Access Interface for Documents
export async function getDocumentsByPatientId(patientId: string): Promise<MedicalDocument[]> {
  if (env.isDemoMode) {
    return mockDb.getDocumentsByPatientId(patientId);
  }

  const supabase = getSupabaseClient();
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

export async function getDocumentById(id: string): Promise<MedicalDocument | null> {
  if (env.isDemoMode) {
    return mockDb.getDocumentById(id);
  }

  const supabase = getSupabaseClient();
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

export async function createDocument(payload: Omit<MedicalDocument, "created_at">): Promise<MedicalDocument> {
  if (env.isDemoMode) {
    return mockDb.createDocument(payload);
  }

  const supabase = getSupabaseClient();
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

export async function updateDocument(id: string, updates: Partial<MedicalDocument>): Promise<MedicalDocument | null> {
  if (env.isDemoMode) {
    return mockDb.updateDocument(id, updates);
  }

  const supabase = getSupabaseClient();
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
  mimeType: string
): Promise<{ storagePath: string }> {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const caseFolder = caseId || "uncategorized";
  const storagePath = `patients/${patientId}/cases/${caseFolder}/${docId}/${safeFileName}`;

  const supabase = getSupabaseClient();
  if (supabase && !env.isDemoMode) {
    try {
      const { error } = await supabase.storage
        .from("clinical-documents")
        .upload(storagePath, fileBytes, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        console.warn(`Supabase Storage upload warning for ${storagePath}:`, error.message);
      }
    } catch (storageErr) {
      console.warn("Storage upload exception (falling back to relative path):", storageErr);
    }
  }

  return { storagePath: `/private/documents/${storagePath}` };
}


