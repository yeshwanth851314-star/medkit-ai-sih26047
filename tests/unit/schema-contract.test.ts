import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  validateCanonicalStoragePath,
  toCanonicalStoragePath,
  toBucketRelativePath,
} from "@/lib/storage/document-storage-validator";

const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
const latestRpcMigration = path.resolve(
  migrationsDir,
  "20260911000001_production_contract_closure.sql"
);

function migrationFiles(): string[] {
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => path.join(migrationsDir, name));
}

function effectiveSchema(): Map<string, Set<string>> {
  const schema = new Map<string, Set<string>>();

  for (const file of migrationFiles()) {
    const sql = fs.readFileSync(file, "utf8");

    for (const match of sql.matchAll(
      /CREATE TABLE IF NOT EXISTS public\.([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\);/gi
    )) {
      const table = match[1];
      const columns = schema.get(table) ?? new Set<string>();
      for (const line of match[2].split("\n")) {
        const columnMatch = line.match(
          /^\s*([a-z_][a-z0-9_]*)\s+(?:UUID|TEXT|BOOLEAN|DATE|TIMESTAMPTZ|TIMESTAMP|JSONB|INTEGER|BIGINT|DOUBLE|NUMERIC|REAL|VARCHAR|CHAR)/i
        );
        if (columnMatch) columns.add(columnMatch[1].toLowerCase());
      }
      schema.set(table, columns);
    }

    for (const statement of sql.matchAll(
      /ALTER TABLE public\.([a-z_][a-z0-9_]*)\s+([\s\S]*?);/gi
    )) {
      const table = statement[1];
      const columns = schema.get(table) ?? new Set<string>();
      for (const add of statement[2].matchAll(
        /ADD COLUMN IF NOT EXISTS\s+([a-z_][a-z0-9_]*)/gi
      )) {
        columns.add(add[1].toLowerCase());
      }
      for (const drop of statement[2].matchAll(
        /DROP COLUMN IF EXISTS\s+([a-z_][a-z0-9_]*)/gi
      )) {
        columns.delete(drop[1].toLowerCase());
      }
      schema.set(table, columns);
    }
  }

  return schema;
}

function activeRpcSql(): string {
  return fs.readFileSync(latestRpcMigration, "utf8");
}

describe("Schema & RPC Contract Invariant Tests", () => {
  const schema = effectiveSchema();

  it("derives the effective profiles/cases/documents/sync/audit schema from migrations", () => {
    const profiles = schema.get("profiles")!;
    for (const column of [
      "id",
      "full_name",
      "role",
      "facility_id",
      "is_active",
      "created_at",
      "updated_at",
    ]) {
      expect(profiles.has(column), `profiles.${column} must exist`).toBe(true);
    }
    expect(profiles.has("active")).toBe(false);

    const cases = schema.get("cases")!;
    expect(cases.has("clinician_id")).toBe(true);
    expect(cases.has("assigned_doctor_id")).toBe(false);
    expect(cases.has("facility_id")).toBe(false);

    for (const table of ["patients", "documents", "sync_mutations", "audit_logs"]) {
      expect(schema.has(table)).toBe(true);
      expect(schema.get(table)!.size).toBeGreaterThan(0);
    }
  });

  it("proves every INSERT target column used by the final RPC exists in the migrated table", () => {
    const rpcSql = activeRpcSql();
    const insertMatches = [
      ...rpcSql.matchAll(
        /INSERT INTO public\.(patients|cases|documents|sync_mutations|audit_logs)\s*\(([\s\S]*?)\)\s*VALUES/gi
      ),
    ];
    expect(insertMatches.length).toBeGreaterThanOrEqual(5);

    for (const match of insertMatches) {
      const table = match[1].toLowerCase();
      const known = schema.get(table);
      expect(known, `effective schema missing table ${table}`).toBeDefined();

      const columns = match[2]
        .split(",")
        .map((value) => value.trim().replace(/["`]/g, "").toLowerCase())
        .filter(Boolean);

      for (const column of columns) {
        expect(
          known!.has(column),
          `${table}.${column} is referenced by the active RPC but is absent from the migrated schema`
        ).toBe(true);
      }
    }
  });

  it("proves UPDATE target columns used by the final RPC exist in the migrated table", () => {
    const rpcSql = activeRpcSql();
    const updates = [
      ...rpcSql.matchAll(
        /UPDATE public\.(patients|cases|documents|sync_mutations|audit_logs)\s+SET\s+([\s\S]*?)\s+WHERE/gi
      ),
    ];
    expect(updates.length).toBeGreaterThan(0);

    for (const match of updates) {
      const table = match[1].toLowerCase();
      const known = schema.get(table)!;
      const assignedColumns = [
        ...match[2].matchAll(/(?:^|,)\s*([a-z_][a-z0-9_]*)\s*=/gim),
      ].map((m) => m[1].toLowerCase());

      for (const column of assignedColumns) {
        expect(
          known.has(column),
          `${table}.${column} is updated by the active RPC but is absent from the migrated schema`
        ).toBe(true);
      }
    }
  });

  it("prevents application profile SELECT lists from drifting from the migrated profiles schema", () => {
    const profileColumns = schema.get("profiles")!;
    const srcRoot = path.resolve(process.cwd(), "src");
    const sourceFiles: string[] = [];
    const visit = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) visit(absolute);
        else if (/\.(?:ts|tsx)$/.test(entry.name)) sourceFiles.push(absolute);
      }
    };
    visit(srcRoot);

    for (const file of sourceFiles) {
      const source = fs.readFileSync(file, "utf8");
      expect(source).not.toMatch(/\bprofile\.active\b/);

      for (const match of source.matchAll(
        /\.from\(["']profiles["']\)[\s\S]{0,350}?\.select\(["']([^"']+)["']\)/g
      )) {
        for (const selected of match[1].split(",").map((value) => value.trim())) {
          if (!selected || selected === "*") continue;
          expect(
            profileColumns.has(selected),
            `${path.basename(file)} selects nonexistent profiles.${selected}`
          ).toBe(true);
        }
      }

      for (const match of source.matchAll(
        /\/rest\/v1\/profiles[^"'`\n]*[?&]select=([a-z0-9_,]+)/gi
      )) {
        for (const selected of match[1].split(",")) {
          expect(
            profileColumns.has(selected),
            `${path.basename(file)} requests nonexistent profiles.${selected} through PostgREST`
          ).toBe(true);
        }
      }
    }
  });

  it("hardens active-profile authorization and prevents self-reactivation", () => {
    const sql = activeRpcSql();

    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.current_user_role\(\)[\s\S]*?is_active IS TRUE/i
    );
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.current_user_facility\(\)[\s\S]*?is_active IS TRUE/i
    );
    expect(sql).toMatch(
      /OLD\.is_active IS DISTINCT FROM NEW\.is_active/i
    );
    expect(sql).toMatch(
      /FACILITY_REQUIRED:\s+Facility-bound clinical caller has no assigned facility/i
    );
  });

  it("binds idempotency to server-computed entity/action/payload and locks direct ledger DML", () => {
    const sql = activeRpcSql();
    const route = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/api/sync/route.ts"),
      "utf8"
    );

    expect(route).toContain("IDEMPOTENCY_KEY_REQUIRED");
    expect(sql).toMatch(/digest\(convert_to\(COALESCE\(p_payload,\s*'\{\}'::jsonb\)::text/i);
    expect(sql).toMatch(/v_existing\.entity IS DISTINCT FROM p_entity/i);
    expect(sql).toMatch(/v_existing\.action IS DISTINCT FROM p_action/i);
    expect(sql).toMatch(/v_existing\.payload_hash IS DISTINCT FROM v_payload_hash/i);
    expect(sql).not.toMatch(/payload_hash\s*=\s*p_payload_hash/i);

    expect(sql).toMatch(
      /REVOKE INSERT,\s*UPDATE,\s*DELETE ON public\.sync_mutations FROM authenticated/i
    );
    expect(sql).toMatch(/GRANT SELECT ON public\.sync_mutations TO authenticated/i);
  });

  it("validates consent ownership/lifecycle before case creation", () => {
    const sql = activeRpcSql();
    expect(sql).toMatch(/CONSENT_PATIENT_MISMATCH/i);
    expect(sql).toMatch(/v_consent\.patient_id\s*!=\s*v_target_patient_id/i);
    expect(sql).toMatch(/v_consent\.revoked IS TRUE/i);
    expect(sql).toMatch(/v_consent\.status IS DISTINCT FROM 'granted'/i);
    expect(sql).toMatch(/v_consent\.revoked_at IS NOT NULL/i);
  });

  it("keeps the elevated RPC pinned, non-anonymous, and transactionally audited", () => {
    const sql = activeRpcSql();

    expect(sql).toMatch(
      /rpc_execute_idempotent_mutation[\s\S]*?SECURITY DEFINER SET search_path = public,\s*pg_temp;/i
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.rpc_execute_idempotent_mutation[\s\S]*?FROM PUBLIC;/i
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.rpc_execute_idempotent_mutation[\s\S]*?FROM anon;/i
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.rpc_execute_idempotent_mutation[\s\S]*?TO authenticated;/i
    );
    expect(sql).toMatch(/INSERT INTO public\.audit_logs/i);
    expect(sql).toMatch(/'SYNC_MUTATION_EXECUTED'/i);
    expect(sql).toMatch(/resource_id = v_resource_id::text/i);
  });

  it("enforces one exact canonical document path and bucket-relative conversion", () => {
    const rawBucketRel =
      "patients/11111111-1111-4111-8111-111111111111/cases/uncategorized/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/lab.pdf";
    const res = validateCanonicalStoragePath(
      rawBucketRel,
      "11111111-1111-4111-8111-111111111111"
    );

    expect(res.canonicalPath).toBe(`/private/documents/${rawBucketRel}`);
    expect(res.bucketRelativePath).toBe(rawBucketRel);
    expect(res.patientId).toBe("11111111-1111-4111-8111-111111111111");
    expect(res.caseSegment).toBe("uncategorized");
    expect(res.caseId).toBeNull();
    expect(res.docId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(res.fileName).toBe("lab.pdf");

    expect(toBucketRelativePath(`/private/documents/${rawBucketRel}`)).toBe(rawBucketRel);
    expect(toCanonicalStoragePath(rawBucketRel)).toBe(`/private/documents/${rawBucketRel}`);

    expect(() =>
      validateCanonicalStoragePath(
        "patients/11111111-1111-4111-8111-111111111111/cases/uncategorized/not-a-uuid/lab.pdf",
        "11111111-1111-4111-8111-111111111111"
      )
    ).toThrow(/STORAGE_PATH_INVALID/);
  });
});
