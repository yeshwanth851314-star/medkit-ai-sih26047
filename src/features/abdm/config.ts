/**
 * MedKit AI — ABDM Gateway Server-Side Configuration
 *
 * SIH Problem Statement: SIH26047 — Patient Case-Taking Software
 * Lead Organization: Ministry of Ayush / All India Institute of Ayurveda (AIIA)
 *
 * Security Mandate:
 * - Server-only. ABDM Client ID and Client Secret must NEVER be exposed to browser bundles.
 * - Non-mandatory. MedKit runs fully offline/local without ABDM credentials.
 */

export interface AbdmConfig {
  gatewayBaseUrl: string;
  clientId: string;
  clientSecret: string;
  hipId: string;
  hprId: string;
  isSandboxConfigured: boolean;
}

export function getAbdmConfig(): AbdmConfig {
  if (typeof window !== "undefined") {
    throw new Error("SECURITY_ERROR: ABDM server configuration cannot be accessed from client-side code");
  }

  const gatewayBaseUrl =
    process.env.ABDM_GATEWAY_URL || "https://dev.abdm.gov.in/gateway";
  const clientId = process.env.ABDM_CLIENT_ID || "";
  const clientSecret = process.env.ABDM_CLIENT_SECRET || "";
  const hipId = process.env.ABDM_HIP_ID || "IN010000001";
  const hprId = process.env.ABDM_HPR_ID || "";

  const isSandboxConfigured = Boolean(
    clientId &&
      !clientId.includes("your-abdm-client-id") &&
      clientSecret &&
      !clientSecret.includes("your-abdm-client-secret") &&
      clientId.length > 5
  );

  return {
    gatewayBaseUrl,
    clientId,
    clientSecret,
    hipId,
    hprId,
    isSandboxConfigured,
  };
}
