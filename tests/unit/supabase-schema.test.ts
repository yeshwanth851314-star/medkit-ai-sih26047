import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Phase 2: Supabase Schema, Migrations & RLS Integrity", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../supabase/migrations/20260906000001_initial_schema.sql"
  );

  it("ensures initial SQL migration file exists and is populated", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql.length).toBeGreaterThan(500);
  });

  it("verifies all 7 required core clinical tables are defined", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    const requiredTables = [
      "profiles",
      "patients",
      "consents",
      "cases",
      "documents",
      "audit_logs",
      "red_flag_events",
    ];

    for (const table of requiredTables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it("verifies Row Level Security (RLS) is enabled on all tables", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    const tables = [
      "profiles",
      "patients",
      "consents",
      "cases",
      "documents",
      "audit_logs",
      "red_flag_events",
    ];

    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it("verifies high-performance query indexes are created", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("idx_patients_code");
    expect(sql).toContain("idx_patients_created_at");
    expect(sql).toContain("idx_cases_patient_id");
    expect(sql).toContain("idx_cases_status");
    expect(sql).toContain("idx_cases_created_at");
    expect(sql).toContain("idx_consents_patient_id");
    expect(sql).toContain("idx_documents_patient_id");
    expect(sql).toContain("idx_audit_resource");
    expect(sql).toContain("idx_audit_actor");
    expect(sql).toContain("idx_red_flags_case_id");
  });

  it("verifies audit logs table enforces strict append-only immutability policies", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("Audit logs insertable by any authenticated user or service");
    expect(sql).toContain("Audit logs viewable only by doctors or administrators");
    // No UPDATE or DELETE policies should be created for audit_logs
    expect(sql).not.toContain("ON public.audit_logs FOR UPDATE");
    expect(sql).not.toContain("ON public.audit_logs FOR DELETE");
  });
});
