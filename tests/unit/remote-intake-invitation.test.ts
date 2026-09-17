import { describe, it, expect, beforeEach } from "vitest";
import {
  createRemoteInvitation,
  validateRemoteInvitation,
  consumeRemoteInvitation,
  revokeRemoteInvitation,
  hashInvitationToken,
  clearMockInvitations,
} from "@/features/intake/remote-intake-service";
import { AuthUser } from "@/features/auth/types";

describe("Phase C: Remote Intake Invitations", () => {
  const mockClinician: AuthUser = {
    id: "88888888-8888-4888-8888-888888888881",
    fullName: "Clinician Delhi",
    email: "clinician.delhi@medkit.ai",
    role: "clinician",
    facilityId: "fac-delhi-01",
    aal: "aal2",
  };

  beforeEach(() => {
    clearMockInvitations();
  });

  it("generates an opaque random token and stores only its SHA-256 hash", async () => {
    const result = await createRemoteInvitation({
      actor: mockClinician,
      expiresInHours: 12,
      maxUses: 1,
    });

    expect(result.rawToken).toBeDefined();
    expect(result.rawToken.length).toBe(64); // 32 bytes hex
    expect(result.inviteUrl).toBe(`/intake/invite/${result.rawToken}`);

    // Invariant: The stored invitation object contains the token_hash, not the raw token
    const expectedHash = hashInvitationToken(result.rawToken);
    expect(result.invitation.token_hash).toBe(expectedHash);
    expect((result.invitation as any).token).toBeUndefined();
  });

  it("validates an active, unexpired, unconsumed invitation successfully", async () => {
    const result = await createRemoteInvitation({
      actor: mockClinician,
      expiresInHours: 24,
      maxUses: 1,
    });

    const validation = await validateRemoteInvitation(result.rawToken);
    expect(validation.valid).toBe(true);
    expect(validation.reason).toBe("VALID");
    expect(validation.facilityId).toBe("fac-delhi-01");
    expect(validation.remainingUses).toBe(1);
  });

  it("rejects an invalid, malformed, or nonexistent invitation token", async () => {
    const validation = await validateRemoteInvitation("invalid-token-1234567890abcdef");
    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe("INVITATION_NOT_FOUND");
  });

  it("rejects an expired invitation", async () => {
    const result = await createRemoteInvitation({
      actor: mockClinician,
      expiresInHours: -1, // already expired
    });

    const validation = await validateRemoteInvitation(result.rawToken);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe("INVITATION_EXPIRED");

    await expect(consumeRemoteInvitation(result.rawToken)).rejects.toThrow(/INVITATION_EXPIRED/);
  });

  it("rejects a revoked invitation", async () => {
    const result = await createRemoteInvitation({
      actor: mockClinician,
      expiresInHours: 24,
    });

    await revokeRemoteInvitation(result.invitation.id, mockClinician);

    const validation = await validateRemoteInvitation(result.rawToken);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe("INVITATION_REVOKED");

    await expect(consumeRemoteInvitation(result.rawToken)).rejects.toThrow(/INVITATION_REVOKED/);
  });

  it("enforces replay resistance: single-use invite is consumed upon use and rejects replay", async () => {
    const result = await createRemoteInvitation({
      actor: mockClinician,
      expiresInHours: 24,
      maxUses: 1,
    });

    // First consumption: success
    const firstConsume = await consumeRemoteInvitation(result.rawToken);
    expect(firstConsume.consumed).toBe(true);
    expect(firstConsume.facilityId).toBe("fac-delhi-01");

    // Second validation attempt: reports INVITATION_CONSUMED
    const validationAfterUse = await validateRemoteInvitation(result.rawToken);
    expect(validationAfterUse.valid).toBe(false);
    expect(validationAfterUse.reason).toBe("INVITATION_CONSUMED");
    expect(validationAfterUse.remainingUses).toBe(0);

    // Replay attack: second consumption throws INVITATION_CONSUMED
    await expect(consumeRemoteInvitation(result.rawToken)).rejects.toThrow(/INVITATION_CONSUMED/);
  });

  it("strictly prevents cross-facility invitation revocation", async () => {
    const mockClinicianGoa: AuthUser = {
      id: "88888888-8888-4888-8888-888888888882",
      fullName: "Clinician Goa",
      email: "clinician.goa@medkit.ai",
      role: "clinician",
      facilityId: "fac-goa-01",
      aal: "aal2",
    };

    // Delhi clinician creates invite
    const result = await createRemoteInvitation({
      actor: mockClinician,
      expiresInHours: 24,
    });

    // Goa clinician attempts to revoke Delhi invitation
    await expect(
      revokeRemoteInvitation(result.invitation.id, mockClinicianGoa)
    ).rejects.toThrow(/FORBIDDEN: Cannot revoke invitation belonging to another facility/);

    // Verify invitation remains valid
    const validation = await validateRemoteInvitation(result.rawToken);
    expect(validation.valid).toBe(true);
  });

  it("rejects revocation by unauthorized roles", async () => {
    const mockPatientUser: AuthUser = {
      id: "88888888-8888-4888-8888-888888888883",
      fullName: "Patient User",
      email: "patient@medkit.ai",
      role: "patient" as any,
      facilityId: "fac-delhi-01",
      aal: "aal2",
    };

    const result = await createRemoteInvitation({
      actor: mockClinician,
      expiresInHours: 24,
    });

    await expect(
      revokeRemoteInvitation(result.invitation.id, mockPatientUser)
    ).rejects.toThrow(/FORBIDDEN: Insufficient role/);
  });
});

