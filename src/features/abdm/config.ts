/**
 * MedKit AI — ABDM Gateway Server-Side Configuration
 *
 * SIH Problem Statement: SIH26047 — Patient Case-Taking Software
 * Lead Organization: Ministry of Ayush / All India Institute of Ayurveda (AIIA)
 *
 * Security Mandate:
 * - Server-only. ABDM Client ID and Client Secret must NEVER be exposed to browser bundles.
 * - Non-mandatory. MedKit runs fully offline/local without ABDM credentials.
 * - No fake fallback identities: ABDM_HIP_ID must not default to fabricated government IDs.
 */

export interface AbdmConfig {
  gatewayBaseUrl: string;
  clientId: string;
  clientSecret: string;
  hipId: string;
  hprId: string;
  cmId: string;
  isSandboxConfigured: boolean;
}

export interface AbdmReadiness {
  isGatewayConfigured: boolean;
  isHipConfigured: boolean;
  isConsentExchangeConfigured: boolean;
  missingRequirements: string[];
}

export function getAbdmConfig(): AbdmConfig {
  if (typeof window !== "undefined") {
    throw new Error("SECURITY_ERROR: ABDM server configuration cannot be accessed from client-side code");
  }

  const rawGateway = process.env.ABDM_GATEWAY_URL?.trim() || "";
  const gatewayBaseUrl =
    rawGateway && !rawGateway.includes("your-")
      ? rawGateway
      : "https://dev.abdm.gov.in/gateway";

  const rawClientId = process.env.ABDM_CLIENT_ID?.trim() || "";
  const clientId = rawClientId && !rawClientId.includes("your-") ? rawClientId : "";

  const rawClientSecret = process.env.ABDM_CLIENT_SECRET?.trim() || "";
  const clientSecret =
    rawClientSecret && !rawClientSecret.includes("your-") ? rawClientSecret : "";

  // Strictly no fake default HIP ID (removed legacy "IN010000001")
  const rawHipId = process.env.ABDM_HIP_ID?.trim() || "";
  const hipId = rawHipId && !rawHipId.includes("your-") ? rawHipId : "";

  const rawHprId = process.env.ABDM_HPR_ID?.trim() || "";
  const hprId = rawHprId && !rawHprId.includes("your-") ? rawHprId : "";

  const rawCmId = process.env.ABDM_CM_ID?.trim() || "";
  const cmId = rawCmId && !rawCmId.includes("your-") ? rawCmId : "sbx";

  const isGatewayReady = Boolean(
    clientId &&
      clientId.length > 5 &&
      clientSecret &&
      clientSecret.length > 5 &&
      gatewayBaseUrl
  );

  return {
    gatewayBaseUrl,
    clientId,
    clientSecret,
    hipId,
    hprId,
    cmId,
    isSandboxConfigured: isGatewayReady,
  };
}

export function isGatewayConfigured(config: AbdmConfig = getAbdmConfig()): boolean {
  return config.isSandboxConfigured;
}

export function isHipConfigured(config: AbdmConfig = getAbdmConfig()): boolean {
  return isGatewayConfigured(config) && Boolean(config.hipId && config.hipId.length > 3);
}

export function isConsentExchangeConfigured(config: AbdmConfig = getAbdmConfig()): boolean {
  return isHipConfigured(config) && Boolean(config.cmId);
}

export function getAbdmReadiness(config: AbdmConfig = getAbdmConfig()): AbdmReadiness {
  const missing: string[] = [];
  if (!config.clientId) missing.push("ABDM_CLIENT_ID");
  if (!config.clientSecret) missing.push("ABDM_CLIENT_SECRET");
  if (!config.gatewayBaseUrl) missing.push("ABDM_GATEWAY_URL");
  if (!config.hipId) missing.push("ABDM_HIP_ID");

  return {
    isGatewayConfigured: isGatewayConfigured(config),
    isHipConfigured: isHipConfigured(config),
    isConsentExchangeConfigured: isConsentExchangeConfigured(config),
    missingRequirements: missing,
  };
}
