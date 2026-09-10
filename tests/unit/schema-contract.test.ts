import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { validateCanonicalStoragePath, toCanonicalStoragePath, toBucketRelativePath } from "@/lib/storage/document-storage-validator";

describe("Schema & RPC Contract Invariant Tests", () => {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
  const latestRpcMigration = path.resolve(migrationsDir, "20260910000006_final_schema_rpc_consistency.sql");
  const initialSchemaMigration = path.resolve(migrationsDir, "20260906000001_initial_schema.sql");

  it("proves that cases table schema definition has clinician_id and no assigned_doctor_id or facility_id", () => {
    const initialSql = fs.readFileSync(initialSchemaMigration, "utf8");
    const casesMatch = initialSql.match(/CREATE TABLE IF NOT EXISTS public\.cases \(([\s\S]*?)\);/);
    expect(casesMatch).not.toBeNull();
    const tableBody = casesMatch![1];

    // clinician_id must exist in schema
    expect(tableBody).toMatch(/clinician_id\s+UUID\s+REFERENCES\s+public\.profiles\(id\)/i);

    // assigned_doctor_id must NOT exist in schema
    expect(tableBody).not.toMatch(/assigned_doctor_id/i);

    // facility_id must NOT exist directly on cases table
    expect(tableBody).not.toMatch(/\bfacility_id\b/i);
  });

  it("verifies latest rpc_execute_idempotent_mutation enforces strict schema & security invariants", () => {
    const rpcSql = fs.readFileSync(latestRpcMigration, "utf8");

    // 1. Must use SECURITY DEFINER with search_path pinned to public, pg_temp
    expect(rpcSql).toMatch(/SECURITY\s+DEFINER\s+SET\s+search_path\s*=\s*public,\s*pg_temp;/i);

    // 2. Must revoke execute from PUBLIC and anon, grant only to authenticated
    expect(rpcSql).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rpc_execute_idempotent_mutation[^\n]+FROM\s+PUBLIC;/i);
    expect(rpcSql).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_execute_idempotent_mutation[^\n]+FROM\s+anon;/i);
    expect(rpcSql).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_execute_idempotent_mutation[^\n]+TO\s+authenticated;/i);

    // 3. Must use clinician_id (and NEVER assigned_doctor_id) in case insert
    expect(rpcSql).toMatch(/INSERT\s+INTO\s+public\.cases\s*\([^)]*clinician_id/i);
    expect(rpcSql).not.toMatch(/assigned_doctor_id/i);

    // 4. Must NOT reference nonexistent cases.facility_id
    expect(rpcSql).not.toMatch(/v_case\.facility_id/i);
    expect(rpcSql).not.toMatch(/c\.facility_id/i);

    // 5. Case facility must be verified through parent patient
    expect(rpcSql).toMatch(/v_patient\.facility_id/i);
    expect(rpcSql).toMatch(/v_case_patient\.facility_id/i);

    // 6. Patient CREATE must validate supplied facility against caller's facility
    expect(rpcSql).toMatch(/FACILITY_ACCESS_DENIED:\s+Cannot create patient outside assigned facility/i);

    // 7. Transactional audit log must be inserted inside the transaction
    expect(rpcSql).toMatch(/INSERT\s+INTO\s+public\.audit_logs/i);
    expect(rpcSql).toMatch(/'SYNC_MUTATION_EXECUTED'/i);

    // 8. Document storage path must use canonical /private/documents/... path
    expect(rpcSql).toMatch(/\/private\/documents\//i);
  });

  it("verifies document storage validator path contracts and helpers", () => {
    const rawBucketRel = "patients/11111111-1111-4111-8111-111111111111/cases/uncategorized/doc-123/lab.pdf";
    const res = validateCanonicalStoragePath(rawBucketRel, "11111111-1111-4111-8111-111111111111");

    expect(res.canonicalPath).toBe(`/private/documents/${rawBucketRel}`);
    expect(res.bucketRelativePath).toBe(rawBucketRel);
    expect(res.patientId).toBe("11111111-1111-4111-8111-111111111111");
    expect(res.caseSegment).toBe("uncategorized");
    expect(res.caseId).toBeNull();
    expect(res.docId).toBe("doc-123");
    expect(res.fileName).toBe("lab.pdf");

    // Helper converters
    expect(toBucketRelativePath(`/private/documents/${rawBucketRel}`)).toBe(rawBucketRel);
    expect(toCanonicalStoragePath(rawBucketRel)).toBe(`/private/documents/${rawBucketRel}`);
  });
});
