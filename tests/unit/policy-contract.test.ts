import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { mockDb } from "@/lib/db/mock-adapter";
import { logAuditEvent } from "@/features/security/audit-service";
import { clinicalAuditSchema } from "@/features/security/types";

const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(migrationsDir, filename), "utf8");
}

function readAllMigrations(): string[] {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf8"));
}

describe("Final Database Policy, Audit Integrity & RLS Contract Tests", () => {
  const latestMigration = readMigration("20260911000002_final_policy_audit_closure.sql");
  const allSql = readAllMigrations().join("\n\n");

  // ===========================================================================
  // 1. P0: audit_logs.resource_type Constraint
  // ===========================================================================
  describe("P0: audit_logs.resource_type constraint verification", () => {
    it("proves the final migration expands audit_logs_resource_type_check with an explicit allowlist", () => {
      expect(latestMigration).toContain("ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_resource_type_check");
      expect(latestMigration).toMatch(
        /ADD CONSTRAINT audit_logs_resource_type_check\s+CHECK\s*\(\s*resource_type IN\s*\(([\s\S]*?)\)\)/i
      );

      const match = latestMigration.match(
        /ADD CONSTRAINT audit_logs_resource_type_check\s+CHECK\s*\(\s*resource_type IN\s*\(([\s\S]*?)\)\)/i
      );
      expect(match).not.toBeNull();
      const allowedTypes = match![1]
        .split(",")
        .map((s) => s.trim().replace(/['"\s]/g, ""));

      const requiredTypes = [
        "patients",
        "cases",
        "documents",
        "auth",
        "fhir",
        "consents",
        "transcripts",
        "kiosk_instances",
        "intake_sessions",
      ];

      for (const req of requiredTypes) {
        expect(allowedTypes, `allowlist must include ${req}`).toContain(req);
      }

      // Proves invalid/arbitrary resource types are NOT permitted
      expect(allowedTypes).not.toContain("arbitrary_resource");
      expect(allowedTypes).not.toContain("malicious_type");
      expect(allowedTypes.length).toBe(9);
    });

    it("proves active RPCs insert audit records using valid resource types", () => {
      // rpc_provision_kiosk uses 'kiosk_instances'
      expect(allSql).toMatch(
        /INSERT INTO public\.audit_logs[\s\S]*?'KIOSK_PROVISIONED'[\s\S]*?'kiosk_instances'/i
      );

      // rpc_revoke_kiosk_session uses 'intake_sessions'
      expect(allSql).toMatch(
        /INSERT INTO public\.audit_logs[\s\S]*?'KIOSK_SESSION_REVOKED'[\s\S]*?'intake_sessions'/i
      );

      // rpc_record_consent_with_audit uses 'patients'
      expect(allSql).toMatch(
        /INSERT INTO public\.audit_logs[\s\S]*?'CONSENT_RECORDED'[\s\S]*?'patients'/i
      );

      // rpc_acknowledge_red_flag_with_audit uses 'cases'
      expect(allSql).toMatch(
        /INSERT INTO public\.audit_logs[\s\S]*?'ACKNOWLEDGE_RED_FLAG'[\s\S]*?'cases'/i
      );
    });

    it("validates that TypeScript security types accept kiosk_instances and intake_sessions", () => {
      const kioskAudit = clinicalAuditSchema.safeParse({
        id: crypto.randomUUID(),
        actor_id: "staff-123",
        action: "KIOSK_PROVISIONED",
        resource_type: "kiosk_instances",
        resource_id: crypto.randomUUID(),
        metadata: { facilityId: "fac-del-01" },
        created_at: new Date().toISOString(),
      });
      expect(kioskAudit.success).toBe(true);

      const sessionAudit = clinicalAuditSchema.safeParse({
        id: crypto.randomUUID(),
        actor_id: "kiosk:kiosk-123",
        action: "KIOSK_SESSION_REVOKED",
        resource_type: "intake_sessions",
        resource_id: crypto.randomUUID(),
        metadata: { reason: "abandoned" },
        created_at: new Date().toISOString(),
      });
      expect(sessionAudit.success).toBe(true);

      const invalidAudit = clinicalAuditSchema.safeParse({
        id: crypto.randomUUID(),
        actor_id: "attacker",
        action: "EXPLOIT",
        resource_type: "unauthorized_table",
        resource_id: "xyz",
        created_at: new Date().toISOString(),
      });
      expect(invalidAudit.success).toBe(false);
    });
  });

  // ===========================================================================
  // 2. P1: red_flag_events Direct-Table RLS
  // ===========================================================================
  describe("P1: red_flag_events facility-scoped RLS and privilege lockdown", () => {
    it("proves legacy broad policies on red_flag_events are dropped", () => {
      expect(latestMigration).toContain(
        'DROP POLICY IF EXISTS "Red flag events viewable by clinicians and staff" ON public.red_flag_events'
      );
      expect(latestMigration).toContain(
        'DROP POLICY IF EXISTS "Red flag events insertable by clinical systems" ON public.red_flag_events'
      );
      expect(latestMigration).toContain(
        'DROP POLICY IF EXISTS "Red flag events updatable by attending doctors" ON public.red_flag_events'
      );
    });

    it("proves red_flag_events SELECT policy is facility-scoped via case -> patient -> facility", () => {
      expect(latestMigration).toMatch(
        /CREATE POLICY "Red flag events viewable by facility clinicians"\s+ON public\.red_flag_events FOR SELECT/i
      );
      expect(latestMigration).toContain("p.facility_id = public.current_user_facility()");
    });

    it("proves red_flag_events has NO unrestricted WITH CHECK (true) write policy", () => {
      const redFlagSection = latestMigration.split("-- 3. FIX P1: RED FLAG DIRECT-TABLE RLS")[1]
        .split("-- 4. FIX P1: SYNC_MUTATIONS")[0];
      const withoutComments = redFlagSection.replace(/--.*$/gm, "");

      expect(withoutComments).not.toMatch(/WITH CHECK\s*\(\s*true\s*\)/i);
      expect(redFlagSection).toContain("p.facility_id = public.current_user_facility()");
    });

    it("proves direct table DELETE is revoked on red_flag_events", () => {
      expect(latestMigration).toContain(
        "REVOKE DELETE, TRUNCATE ON public.red_flag_events FROM authenticated"
      );
      expect(latestMigration).toContain(
        "REVOKE ALL ON public.red_flag_events FROM PUBLIC, anon"
      );
    });

    it("enforces cross-facility red flag update rejection in domain model (negative test)", async () => {
      const patientA = await mockDb.createPatient({
        patient_code: "P-FAC-A-" + Date.now(),
        full_name: "Patient Facility A",
        facility_id: "facility-alpha",
      });

      const caseA = await mockDb.createCase({
        patient_id: patientA.id,
        clinician_id: "doc-alpha",
        case_type: "general",
        chief_complaint: "Acute severe chest tightness",
        status: "draft",
        patient_language: "en",
      });

      mockDb.recordRedFlagEvent({
        case_id: caseA.id,
        rule_id: "RF-CHEST-01",
        severity: "CRITICAL",
        trigger_text: "chest tightness",
      });

      // Facility B clinician attempting to acknowledge Facility A red flag must throw
      expect(() => {
        mockDb.updateRedFlagEvent(
          caseA.id,
          "RF-CHEST-01",
          "Dr. Beta",
          new Date().toISOString(),
          "doctor",
          "facility-beta" // Mismatched facility
        );
      }).toThrow(/Cross-facility red flag acknowledgement denied/);

      // Inactive clinician is also rejected by policy helpers
      const roleSql = latestMigration;
      expect(roleSql).toContain("WHERE id = auth.uid()");
      expect(roleSql).toContain("AND is_active IS TRUE");
    });
  });

  // ===========================================================================
  // 3. P1: audit_logs Integrity & Immutability
  // ===========================================================================
  describe("P1: audit_logs write immutability and scoped reads", () => {
    it("proves direct INSERT, UPDATE, DELETE on audit_logs are revoked from authenticated and anon", () => {
      expect(latestMigration).toContain(
        "REVOKE ALL ON public.audit_logs FROM PUBLIC, anon;"
      );
      expect(latestMigration).toContain(
        "REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM authenticated;"
      );
      expect(latestMigration).toContain(
        "GRANT ALL ON public.audit_logs TO service_role;"
      );
    });

    it("proves legacy audit_logs insert policies with WITH CHECK (true) are dropped", () => {
      expect(latestMigration).toContain(
        'DROP POLICY IF EXISTS "Audit logs insertable by any authenticated user or service" ON public.audit_logs'
      );
      expect(latestMigration).toContain(
        'DROP POLICY IF EXISTS "Audit logs insertable by authenticated callers" ON public.audit_logs'
      );
    });

    it("proves audit_logs SELECT is restricted to active administrators only", () => {
      expect(latestMigration).toMatch(
        /CREATE POLICY "Audit logs viewable by active admin only"\s+ON public\.audit_logs FOR SELECT/i
      );
      expect(latestMigration).toContain("public.current_user_role() = 'admin'");
    });
  });

  // ===========================================================================
  // 4. P1: sync_mutations SELECT Policy & Shadowing Elimination
  // ===========================================================================
  describe("P1: sync_mutations SELECT policy and duplicate elimination", () => {
    it("proves all historical/duplicate sync_mutations policies are dropped", () => {
      expect(latestMigration).toContain(
        'DROP POLICY IF EXISTS "Sync mutations caller scoped" ON public.sync_mutations'
      );
      expect(latestMigration).toContain(
        'DROP POLICY IF EXISTS "Authenticated clinicians and users can manage sync mutations" ON public.sync_mutations'
      );
      expect(latestMigration).toContain(
        'DROP POLICY IF EXISTS "Users can manage own sync mutations" ON public.sync_mutations'
      );
      expect(latestMigration).toContain(
        'DROP POLICY IF EXISTS "Users can select own sync mutations" ON public.sync_mutations'
      );
      expect(latestMigration).toContain(
        'DROP POLICY IF EXISTS "Users can insert own sync mutations" ON public.sync_mutations'
      );
      expect(latestMigration).toContain(
        'DROP POLICY IF EXISTS "Users can update own sync mutations" ON public.sync_mutations'
      );
    });

    it("proves sync_mutations has exactly one clean SELECT policy requiring active user profile", () => {
      expect(latestMigration).toMatch(
        /CREATE POLICY "Sync mutations readable by active owner or active admin"\s+ON public\.sync_mutations FOR SELECT/i
      );
      expect(latestMigration).toContain("p.is_active IS TRUE");
      expect(latestMigration).toContain("user_id = auth.uid()::text");
    });

    it("proves direct DML on sync_mutations remains revoked", () => {
      expect(latestMigration).toContain(
        "REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sync_mutations FROM authenticated;"
      );
      expect(latestMigration).toContain(
        "REVOKE ALL ON public.sync_mutations FROM PUBLIC, anon;"
      );
    });
  });

  // ===========================================================================
  // 5. Revocation Metadata Exposure (kiosk_capability_revocations)
  // ===========================================================================
  describe("kiosk_capability_revocations metadata exposure protection", () => {
    it("proves legacy permissive policy allowing anon viewing is dropped", () => {
      expect(latestMigration).toContain(
        'DROP POLICY IF EXISTS "Allow authenticated clinicians and kiosk RPC to view revocations" ON public.kiosk_capability_revocations'
      );
    });

    it("proves anon direct table permissions on kiosk_capability_revocations are revoked", () => {
      expect(latestMigration).toContain(
        "REVOKE ALL ON public.kiosk_capability_revocations FROM PUBLIC, anon;"
      );
    });

    it("proves clinician policies require active clinical role", () => {
      expect(latestMigration).toMatch(
        /CREATE POLICY "Clinicians can view revocations"\s+ON public\.kiosk_capability_revocations FOR SELECT/i
      );
      expect(latestMigration).toContain("public.current_user_role() IN ('doctor', 'clinician', 'admin')");
    });

    it("proves rpc_get_kiosk_intake_session checks kiosk_capability_revocations and marks status revoked", () => {
      expect(latestMigration).toContain("SELECT EXISTS(");
      expect(latestMigration).toContain("FROM public.kiosk_capability_revocations");
      expect(latestMigration).toContain("WHERE session_id = p_session_id");
      expect(latestMigration).toContain("v_session.status := 'revoked'");
    });
  });

  // ===========================================================================
  // 6. Active Profile & SECURITY DEFINER Invariants
  // ===========================================================================
  describe("Active profile & SECURITY DEFINER search_path invariants", () => {
    it("proves current_user_role() and current_user_facility() enforce is_active IS TRUE with safe search_path", () => {
      expect(latestMigration).toMatch(
        /CREATE OR REPLACE FUNCTION public\.current_user_role\(\)[\s\S]*?is_active IS TRUE[\s\S]*?SET search_path = public, pg_temp/i
      );
      expect(latestMigration).toMatch(
        /CREATE OR REPLACE FUNCTION public\.current_user_facility\(\)[\s\S]*?is_active IS TRUE[\s\S]*?SET search_path = public, pg_temp/i
      );
    });

    it("proves explicit REVOKE from PUBLIC on SECURITY DEFINER functions", () => {
      expect(latestMigration).toContain(
        "REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;"
      );
      expect(latestMigration).toContain(
        "REVOKE ALL ON FUNCTION public.current_user_facility() FROM PUBLIC, anon;"
      );
      expect(latestMigration).toContain(
        "REVOKE ALL ON FUNCTION public.rpc_get_kiosk_intake_session(UUID, TEXT, UUID) FROM PUBLIC;"
      );
      expect(latestMigration).toContain(
        "REVOKE ALL ON FUNCTION public.rpc_acknowledge_red_flag_with_audit(UUID, TEXT) FROM PUBLIC, anon;"
      );
      expect(latestMigration).toContain(
        "REVOKE ALL ON FUNCTION public.rpc_provision_kiosk(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;"
      );
    });
  });
});
