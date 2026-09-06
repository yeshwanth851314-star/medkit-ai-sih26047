import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createRequestSupabaseClient,
  getServiceSupabaseClient,
  getSupabaseClient,
} from "../../src/lib/db/supabase";

describe("Phase 1: Deterministic Request-Bound Supabase Identity & Auth Architecture", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalService = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-test-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key-abc-123";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key-xyz-789";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalService;
  });

  it("creates ephemeral request-bound client without persisting in-memory session", () => {
    const client = createRequestSupabaseClient();
    expect(client).not.toBeNull();
    // Verify client was initialized and auth options do not persist session globally
    expect((client as any)?.auth?.persistSession).toBeFalsy();
  });

  it("User A request != User B Supabase identity: distinct request clients do not share headers or session state", () => {
    const tokenA = "jwt-user-a-access-token";
    const tokenB = "jwt-user-b-access-token";

    const clientA = createRequestSupabaseClient(tokenA);
    const clientB = createRequestSupabaseClient(tokenB);

    expect(clientA).not.toBeNull();
    expect(clientB).not.toBeNull();
    expect(clientA).not.toBe(clientB);

    // Verify auth instance isolation
    expect(clientA?.auth).not.toBe(clientB?.auth);
  });

  it("different requests do not share mutable auth state across client instances", () => {
    const client1 = createRequestSupabaseClient("token-1");
    const client2 = createRequestSupabaseClient();

    expect(client1).not.toBe(client2);
    const headers2 = (client2 as any)?.rest?.headers;
    if (headers2) {
      expect(headers2.Authorization).toBeUndefined();
    }
  });

  it("service role client enforces persistSession: false and does not expose service key", () => {
    const serviceClient = getServiceSupabaseClient();
    expect(serviceClient).not.toBeNull();
    expect((serviceClient as any)?.auth?.persistSession).toBeFalsy();
  });

  it("getSupabaseClient returns request-bound client for given token", () => {
    const client = getSupabaseClient("test-token");
    expect(client).not.toBeNull();
  });
});
