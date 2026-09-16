import crypto from "crypto";
import { env } from "@/config/env";
import { getAuthorizedSupabaseClient, getServiceSupabaseClient } from "@/lib/db/supabase";
import { AuthUser } from "@/features/auth/types";
import { RemoteIntakeInvitation } from "@/types/database";

export interface CreateInviteInput {
  patientId?: string | null;
  expiresInHours?: number;
  maxUses?: number;
  purpose?: string;
  actor: AuthUser;
}

export interface ValidateInviteResult {
  valid: boolean;
  reason: "VALID" | "INVITATION_NOT_FOUND" | "INVITATION_REVOKED" | "INVITATION_EXPIRED" | "INVITATION_CONSUMED" | string;
  invitationId?: string | null;
  facilityId?: string | null;
  patientId?: string | null;
  purpose?: string | null;
  expiresAt?: string | null;
  remainingUses?: number;
}

// In-memory store for mock/demo and unit test isolation
const mockInvitations = new Map<string, RemoteIntakeInvitation & { rawToken?: string }>();

export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createRemoteInvitation(input: CreateInviteInput): Promise<{
  invitation: RemoteIntakeInvitation;
  rawToken: string;
  inviteUrl: string;
}> {
  const rawToken = generateSecureToken();
  const tokenHash = hashInvitationToken(rawToken);
  const expiresInHours = input.expiresInHours || 24;
  const maxUses = input.maxUses || 1;
  const purpose = input.purpose || "patient_registration_and_intake";

  if (!env.isDemoMode) {
    const userClient = getAuthorizedSupabaseClient(input.actor);
    const client = userClient || getServiceSupabaseClient();
    if (!client) {
      throw new Error("Database unavailable: Supabase client is not configured.");
    }

    const { data, error } = await client.rpc("rpc_create_remote_intake_invitation", {
      p_patient_id: input.patientId || null,
      p_token_hash: tokenHash,
      p_expires_in_hours: expiresInHours,
      p_max_uses: maxUses,
      p_purpose: purpose,
    });

    if (error) {
      console.error("Supabase rpc_create_remote_intake_invitation error:", error);
      throw new Error(`Failed to create remote invitation: ${error.message}`);
    }

    const invitation = data as RemoteIntakeInvitation;
    return {
      invitation,
      rawToken,
      inviteUrl: `/intake/invite/${rawToken}`,
    };
  }

  // Demo / Unit test mode
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000).toISOString();
  const id = crypto.randomUUID();

  const mockInv: RemoteIntakeInvitation = {
    id,
    facility_id: input.actor.facilityId || "fac-delhi-01",
    patient_id: input.patientId || null,
    token_hash: tokenHash,
    purpose,
    expires_at: expiresAt,
    max_uses: maxUses,
    used_count: 0,
    revoked_at: null,
    created_by: input.actor.id,
    created_at: now.toISOString(),
  };

  mockInvitations.set(tokenHash, mockInv);

  return {
    invitation: mockInv,
    rawToken,
    inviteUrl: `/intake/invite/${rawToken}`,
  };
}

export async function validateRemoteInvitation(rawToken: string): Promise<ValidateInviteResult> {
  if (!rawToken || !rawToken.trim()) {
    return { valid: false, reason: "INVITATION_NOT_FOUND" };
  }

  const tokenHash = hashInvitationToken(rawToken);

  if (!env.isDemoMode) {
    const client = getServiceSupabaseClient();
    if (!client) {
      throw new Error("Database unavailable: Supabase client is not configured.");
    }

    const { data, error } = await client.rpc("rpc_validate_remote_intake_invitation", {
      p_token_hash: tokenHash,
    });

    if (error) {
      console.error("Supabase rpc_validate_remote_intake_invitation error:", error);
      return { valid: false, reason: "INVITATION_NOT_FOUND" };
    }

    const rows = data as any[];
    if (!rows || rows.length === 0) {
      return { valid: false, reason: "INVITATION_NOT_FOUND" };
    }

    const row = rows[0];
    return {
      valid: row.valid,
      reason: row.reason,
      invitationId: row.invitation_id,
      facilityId: row.facility_id,
      patientId: row.patient_id,
      purpose: row.purpose,
      expiresAt: row.expires_at,
      remainingUses: row.remaining_uses,
    };
  }

  // Demo mode
  const inv = mockInvitations.get(tokenHash);
  if (!inv) {
    return { valid: false, reason: "INVITATION_NOT_FOUND" };
  }

  if (inv.revoked_at) {
    return {
      valid: false,
      reason: "INVITATION_REVOKED",
      invitationId: inv.id,
      facilityId: inv.facility_id,
      remainingUses: Math.max(0, inv.max_uses - inv.used_count),
    };
  }

  if (new Date(inv.expires_at).getTime() < Date.now()) {
    return {
      valid: false,
      reason: "INVITATION_EXPIRED",
      invitationId: inv.id,
      facilityId: inv.facility_id,
      remainingUses: Math.max(0, inv.max_uses - inv.used_count),
    };
  }

  if (inv.used_count >= inv.max_uses) {
    return {
      valid: false,
      reason: "INVITATION_CONSUMED",
      invitationId: inv.id,
      facilityId: inv.facility_id,
      remainingUses: 0,
    };
  }

  return {
    valid: true,
    reason: "VALID",
    invitationId: inv.id,
    facilityId: inv.facility_id,
    patientId: inv.patient_id,
    purpose: inv.purpose,
    expiresAt: inv.expires_at,
    remainingUses: inv.max_uses - inv.used_count,
  };
}

export async function consumeRemoteInvitation(rawToken: string): Promise<{
  consumed: boolean;
  facilityId: string;
  patientId?: string | null;
  invitationId?: string;
}> {
  const tokenHash = hashInvitationToken(rawToken);

  if (!env.isDemoMode) {
    const client = getServiceSupabaseClient();
    if (!client) {
      throw new Error("Database unavailable: Supabase client is not configured.");
    }

    const { data, error } = await client.rpc("rpc_consume_remote_intake_invitation", {
      p_token_hash: tokenHash,
    });

    if (error) {
      console.error("Supabase rpc_consume_remote_intake_invitation error:", error);
      throw new Error(`Failed to consume invitation: ${error.message}`);
    }

    const rows = data as any[];
    if (!rows || rows.length === 0) {
      throw new Error("INVITATION_NOT_FOUND: Remote invitation not found");
    }

    const row = rows[0];
    return {
      consumed: row.consumed,
      facilityId: row.facility_id,
      patientId: row.patient_id,
      invitationId: row.invitation_id,
    };
  }

  // Demo mode
  const inv = mockInvitations.get(tokenHash);
  if (!inv) {
    throw new Error("INVITATION_NOT_FOUND: Remote invitation not found");
  }
  if (inv.revoked_at) {
    throw new Error("INVITATION_REVOKED: Remote invitation has been revoked");
  }
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    throw new Error(`INVITATION_EXPIRED: Remote invitation expired at ${inv.expires_at}`);
  }
  if (inv.used_count >= inv.max_uses) {
    throw new Error(`INVITATION_CONSUMED: Remote invitation usage limit reached (${inv.used_count} of ${inv.max_uses})`);
  }

  inv.used_count += 1;
  return {
    consumed: true,
    facilityId: inv.facility_id,
    patientId: inv.patient_id,
    invitationId: inv.id,
  };
}

export async function revokeRemoteInvitation(
  invitationId: string,
  actor: AuthUser
): Promise<void> {
  if (!env.isDemoMode) {
    const userClient = getAuthorizedSupabaseClient(actor) || getServiceSupabaseClient();
    if (!userClient) {
      throw new Error("Database unavailable");
    }

    const { error } = await userClient
      .from("remote_intake_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invitationId);

    if (error) {
      throw new Error(`Failed to revoke invitation: ${error.message}`);
    }
    return;
  }

  for (const inv of mockInvitations.values()) {
    if (inv.id === invitationId) {
      inv.revoked_at = new Date().toISOString();
      break;
    }
  }
}

export function clearMockInvitations(): void {
  mockInvitations.clear();
}
