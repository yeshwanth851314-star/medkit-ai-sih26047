import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import { mockDb } from "@/lib/db/mock-adapter";
import { Patient, ClinicalCase, MedicalDocument } from "@/types/database";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  if (env.supabaseUrl && env.supabaseAnonKey) {
    try {
      supabaseClient = createClient(env.supabaseUrl, env.supabaseAnonKey);
      return supabaseClient;
    } catch (err) {
      console.warn("Failed to initialize Supabase client, falling back to mock adapter", err);
    }
  }
  return null;
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


