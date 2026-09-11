import { getAbdmConfig, AbdmConfig } from "./config";
import { AbdmSessionToken, AbdmGatewayError } from "./types";

/**
 * MedKit AI — ABDM Gateway API Client
 *
 * SIH Problem Statement: SIH26047 — Patient Case-Taking Software
 * Lead Organization: Ministry of Ayush / All India Institute of Ayurveda (AIIA)
 *
 * Implements ABDM Gateway V3 communication specifications.
 * Enforces fail-closed security and audit safety.
 */
export class AbdmClient {
  private config: AbdmConfig;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(configOverride?: AbdmConfig) {
    if (typeof window !== "undefined") {
      throw new Error("SECURITY_ERROR: ABDM client cannot run in browser context");
    }
    this.config = configOverride || getAbdmConfig();
  }

  public get isConfigured(): boolean {
    return this.config.isSandboxConfigured;
  }

  public get hipId(): string {
    return this.config.hipId;
  }

  /**
   * Generates or retrieves an active Gateway Session Token via client credentials
   * Endpoint: POST /api/hiecm/gateway/v3/sessions
   */
  public async getSessionToken(): Promise<string> {
    if (!this.config.isSandboxConfigured) {
      throw new Error(
        "ABDM_SANDBOX_BLOCKED_EXTERNAL: ABDM client credentials are not configured in the host environment."
      );
    }

    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60000) {
      return this.cachedToken.token;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const sessionUrl = `${this.config.gatewayBaseUrl.replace(/\/$/, "")}/api/hiecm/gateway/v3/sessions`;

      const response = await fetch(sessionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "REQUEST-ID": crypto.randomUUID(),
          TIMESTAMP: new Date().toISOString(),
          "X-CM-ID": this.config.cmId || "sbx",
        },
        body: JSON.stringify({
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
          grantType: "client_credentials",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`ABDM_GATEWAY_AUTH_FAILURE: Authentication failed with HTTP ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(`ABDM_GATEWAY_HTTP_ERROR: Gateway session request failed with HTTP ${response.status}`);
      }

      const data = (await response.json()) as Partial<AbdmSessionToken>;
      if (!data || !data.accessToken) {
        throw new Error("ABDM Gateway returned invalid session response without accessToken");
      }

      const expiresInMs = (typeof data.expiresIn === "number" ? data.expiresIn : 1800) * 1000;
      this.cachedToken = {
        token: data.accessToken,
        expiresAt: now + expiresInMs,
      };

      return data.accessToken;
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error("ABDM_GATEWAY_TIMEOUT: Request to ABDM Gateway timed out after 8000ms");
      }
      if (err.message?.startsWith("ABDM_GATEWAY_")) {
        throw err;
      }
      throw new Error(`ABDM_GATEWAY_AUTH_FAILURE: ${err.message || "Failed to authenticate with ABDM Gateway"}`);
    }
  }

  /**
   * Helper to construct standard ABDM Gateway V3 request headers
   */
  public async buildGatewayHeaders(cmId?: string): Promise<Record<string, string>> {
    const token = await this.getSessionToken();
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "X-CM-ID": cmId || this.config.cmId || "sbx",
      "REQUEST-ID": crypto.randomUUID(),
      TIMESTAMP: new Date().toISOString(),
    };
  }
}
