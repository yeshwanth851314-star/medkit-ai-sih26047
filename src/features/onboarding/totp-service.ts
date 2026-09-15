import crypto from "crypto";

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encodes a buffer to RFC 3548 Base32 string
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes an RFC 3548 Base32 string to Buffer
 */
export function base32Decode(base32: string): Buffer {
  const cleaned = base32.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_CHARS.indexOf(cleaned[i]);
    if (idx === -1) continue; // Skip invalid chars

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates a high-entropy Base32-encoded TOTP shared secret (160-bit standard)
 */
export function generateTotpSecret(numBytes = 20): string {
  const randomBytes = crypto.randomBytes(numBytes);
  return base32Encode(randomBytes);
}

/**
 * Constructs the standard otpauth URI for mobile authenticator apps (Google Authenticator, Aegis, 1Password)
 */
export function generateTotpUri(secret: string, accountName: string, issuer = "MedKit AI"): string {
  const cleanIssuer = encodeURIComponent(issuer.trim());
  const cleanAccount = encodeURIComponent(accountName.trim());
  return `otpauth://totp/${cleanIssuer}:${cleanAccount}?secret=${secret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Computes RFC 6238 TOTP code for a given timestamp and secret
 */
export function computeTotpCode(secret: string, timestampMs = Date.now()): string {
  const key = base32Decode(secret);
  const timeStep = Math.floor(timestampMs / 1000 / 30);

  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac("sha1", key);
  hmac.update(timeBuffer);
  const digest = hmac.digest();

  // Dynamic truncation (RFC 4226)
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = (binary % 1000000).toString().padStart(6, "0");
  return otp;
}

/**
 * Verifies user-submitted TOTP code against the shared secret with drift window (+-1 step)
 */
export function verifyTotpCode(secret: string, submittedCode: string, windowSteps = 1): boolean {
  if (!secret || !submittedCode) return false;
  const cleanCode = submittedCode.trim();
  if (!/^\d{6}$/.test(cleanCode)) return false;

  const now = Date.now();
  const stepMs = 30 * 1000;

  for (let offset = -windowSteps; offset <= windowSteps; offset++) {
    const testTime = now + offset * stepMs;
    const expected = computeTotpCode(secret, testTime);
    if (crypto.timingSafeEqual(Buffer.from(cleanCode), Buffer.from(expected))) {
      return true;
    }
  }

  return false;
}
