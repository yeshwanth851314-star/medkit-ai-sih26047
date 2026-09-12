import { describe, it, expect } from "vitest";
import { authenticateClinician, parseSessionToken } from "../../src/features/auth/auth-service";

describe("Phase 2: Authentication & Authorization Tests", () => {
  it("authenticates valid doctor credentials successfully", async () => {
    const result = await authenticateClinician({
      email: "doctor@medkit.ai",
      password: "MedKit#Doctor!2026$SecP9",
    });

    expect(result).not.toBeNull();
    expect(result?.user.email).toBe("doctor@medkit.ai");
    expect(result?.user.role).toBe("doctor");
    expect(result?.user.fullName).toBe("Dr. Ananya Rao, MD");
    expect(result?.token).toBeDefined();
  });

  it("authenticates valid AYUSH clinician credentials successfully", async () => {
    const result = await authenticateClinician({
      email: "ayush@medkit.ai",
      password: "MedKit#Ayush!2026$Vaidya7",
    });

    expect(result).not.toBeNull();
    expect(result?.user.role).toBe("doctor");
    expect(result?.user.fullName).toContain("Vaidya Rajesh Sharma");
  });

  it("rejects revoked legacy credentials safely", async () => {
    const doctorResult = await authenticateClinician({
      email: "doctor@medkit.ai",
      password: "doctor123",
    });
    expect(doctorResult).toBeNull();

    const staffResult = await authenticateClinician({
      email: "staff@medkit.ai",
      password: "staff123",
    });
    expect(staffResult).toBeNull();
  });

  it("rejects invalid passwords safely", async () => {
    const result = await authenticateClinician({
      email: "doctor@medkit.ai",
      password: "wrongpassword",
    });

    expect(result).toBeNull();
  });

  it("rejects non-existent users safely without disclosure", async () => {
    const result = await authenticateClinician({
      email: "intruder@unknown.com",
      password: "password123",
    });

    expect(result).toBeNull();
  });

  it("parses valid session token and restores user context", async () => {
    const loginResult = await authenticateClinician({
      email: "staff@medkit.ai",
      password: "MedKit#Staff!2026$Triage3",
    });
    expect(loginResult).toBeDefined();

    const parsedUser = parseSessionToken(loginResult!.token);
    expect(parsedUser).not.toBeNull();
    expect(parsedUser?.role).toBe("staff");
    expect(parsedUser?.fullName).toBe("Kiran Reddy (Triage Nurse)");
  });

  it("fails to parse corrupted session token", () => {
    const parsedUser = parseSessionToken("demo-session-corrupted-data");
    expect(parsedUser).toBeNull();
  });
});
