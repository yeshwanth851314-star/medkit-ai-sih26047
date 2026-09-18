import { setTestMockUsers } from "@/features/auth/auth-service";
import { setTestTotpMocks } from "@/features/onboarding/clinician-onboarding-service";
import { generateTotpSecret, generateTotpUri, verifyTotpCode } from "@/features/onboarding/totp-service";
import { TEST_MOCK_USERS } from "./auth";

setTestMockUsers(TEST_MOCK_USERS);
setTestTotpMocks(
  () => {
    const secret = generateTotpSecret(20);
    const uri = generateTotpUri(secret, "practitioner@medkit.ai");
    return { secret, uri };
  },
  (secret, code) => verifyTotpCode(secret, code)
);

if (typeof globalThis.WebSocket === "undefined") {
  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;
    readyState = 1;
    binaryType = "blob";
    url = "";
    bufferedAmount = 0;
    extensions = "";
    protocol = "";
    onopen = null;
    onclose = null;
    onerror = null;
    onmessage = null;
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
  }
  (globalThis as any).WebSocket = MockWebSocket;
}

