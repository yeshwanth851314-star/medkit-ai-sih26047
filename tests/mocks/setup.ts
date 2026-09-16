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

