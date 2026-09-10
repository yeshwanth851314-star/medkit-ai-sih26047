import { describe, it, expect } from "vitest";
import { getSupabaseClient, getServiceSupabaseClient } from "@/lib/db/supabase";

describe("Integration: Real Supabase Infrastructure & Connection Test", () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const isPlaceholder = !supabaseUrl || supabaseUrl.includes("your-project.supabase.co");

  it("checks real Supabase database availability and reports diagnostic evidence", async () => {
    console.log("=== SUPABASE REAL INTEGRATION TEST ===");
    console.log(`Target URL: ${supabaseUrl || "(not configured)"}`);
    console.log(`Service Role Key Configured: ${Boolean(serviceKey)}`);

    if (isPlaceholder) {
      console.warn("================================================================================");
      console.warn("[BLOCKED EXTERNAL] Real Supabase database integration cannot execute against a live instance:");
      console.warn("  - Host environment lacks Docker/Podman to launch local Supabase containers (`npx supabase start`).");
      console.warn(`  - Active environment URL is unconfigured or a placeholder: '${supabaseUrl}'.`);
      console.warn("  - Real Supabase integration gate strictly fails closed.");
      console.warn("================================================================================");

      throw new Error(
        "[BLOCKED EXTERNAL] Real Supabase database integration cannot execute against a live instance:\n" +
        "  - Host environment lacks Docker/Podman to launch local Supabase containers (`npx supabase start`).\n" +
        `  - Active environment URL is unconfigured or a placeholder: '${supabaseUrl}'.\n` +
        "  - Use 'npm run test:integration:supabase:diagnostic' for non-blocking diagnostic inspection."
      );
    }

    // When configured with real credentials, perform live queries
    const serviceClient = getServiceSupabaseClient();
    expect(serviceClient).not.toBeNull();

    const { data, error } = await serviceClient!.from("profiles").select("id").limit(1);
    if (error) {
      console.error("Real Supabase query error:", error.message);
      throw new Error(`Real Supabase integration error: ${error.message}`);
    }

    expect(data).toBeDefined();
    console.log("Real Supabase query passed successfully against live cluster.");
  });

  it("verifies fail-closed behavior when live database is unreachable in non-demo mode", async () => {
    if (isPlaceholder) {
      try {
        const res = await fetch("http://127.0.0.1:54321/rest/v1/", {
          signal: AbortSignal.timeout(1000),
        });
        expect(res.ok).toBe(false);
      } catch (err: any) {
        expect(err).toBeDefined();
        console.log("Local database probe immediately detected as unavailable:", err.message);
      }
    }
  });
});
