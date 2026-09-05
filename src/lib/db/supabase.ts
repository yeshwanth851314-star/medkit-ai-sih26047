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
  const supabase = getSupabaseClient();
  if (supabase && !env.isDemoMode) {
    let query = supabase.from("patients").select("*").order("created_at", { ascending: false });
    if (searchQuery && searchQuery.trim()) {
      query = query.or(`full_name.ilike.%${searchQuery}%,patient_code.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
    }
    const { data, error } = await query;
    if (error) {
      console.error("Supabase getPatients error, falling back to mock", error);
      return mockDb.getPatients(searchQuery);
    }
    return data as Patient[];
  }
  return mockDb.getPatients(searchQuery);
}

export async function getPatientById(id: string): Promise<Patient | null> {
  const supabase = getSupabaseClient();
  if (supabase && !env.isDemoMode) {
    const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
    if (error) {
      console.error("Supabase getPatientById error, falling back to mock", error);
      return mockDb.getPatientById(id);
    }
    return data as Patient | null;
  }
  return mockDb.getPatientById(id);
}

export async function createPatient(payload: Omit<Patient, "id" | "created_at" | "updated_at">): Promise<Patient> {
  const supabase = getSupabaseClient();
  if (supabase && !env.isDemoMode) {
    const { data, error } = await supabase.from("patients").insert([payload]).select().single();
    if (error) {
      console.error("Supabase createPatient error, falling back to mock", error);
      return mockDb.createPatient(payload);
    }
    return data as Patient;
  }
  return mockDb.createPatient(payload);
}

// Unified Data Access Interface for Cases
export async function getCasesByPatientId(patientId: string): Promise<ClinicalCase[]> {
  const supabase = getSupabaseClient();
  if (supabase && !env.isDemoMode) {
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Supabase getCases error, falling back to mock", error);
      return mockDb.getCasesByPatientId(patientId);
    }
    return data as ClinicalCase[];
  }
  return mockDb.getCasesByPatientId(patientId);
}

export async function getCaseById(id: string): Promise<ClinicalCase | null> {
  const supabase = getSupabaseClient();
  if (supabase && !env.isDemoMode) {
    const { data, error } = await supabase.from("cases").select("*").eq("id", id).maybeSingle();
    if (error) {
      console.error("Supabase getCaseById error, falling back to mock", error);
      return mockDb.getCaseById(id);
    }
    return data as ClinicalCase | null;
  }
  return mockDb.getCaseById(id);
}

export async function createCase(payload: Omit<ClinicalCase, "id" | "created_at" | "updated_at">): Promise<ClinicalCase> {
  const supabase = getSupabaseClient();
  if (supabase && !env.isDemoMode) {
    const { data, error } = await supabase.from("cases").insert([payload]).select().single();
    if (error) {
      console.error("Supabase createCase error, falling back to mock", error);
      return mockDb.createCase(payload);
    }
    return data as ClinicalCase;
  }
  return mockDb.createCase(payload);
}

export async function updateCase(id: string, updates: Partial<ClinicalCase>): Promise<ClinicalCase | null> {
  const supabase = getSupabaseClient();
  if (supabase && !env.isDemoMode) {
    const { data, error } = await supabase
      .from("cases")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      console.error("Supabase updateCase error, falling back to mock", error);
      return mockDb.updateCase(id, updates);
    }
    return data as ClinicalCase;
  }
  return mockDb.updateCase(id, updates);
}

// Unified Data Access Interface for Documents
export async function getDocumentsByPatientId(patientId: string): Promise<MedicalDocument[]> {
  const supabase = getSupabaseClient();
  if (supabase && !env.isDemoMode) {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Supabase getDocuments error, falling back to mock", error);
      return mockDb.getDocumentsByPatientId(patientId);
    }
    return data as MedicalDocument[];
  }
  return mockDb.getDocumentsByPatientId(patientId);
}
