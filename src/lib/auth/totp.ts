/**
 * Cross-runtime RFC 6238 TOTP generator and utilities.
 * Uses Web Crypto API (globalThis.crypto.subtle), compatible with Node.js 16+ and modern browsers.
 */

export function base32ToBytes(base32: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (let i = 0; i < base32.length; i++) {
    const val = alphabet.indexOf(base32.charAt(i).toUpperCase());
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

export async function generateTotpCode(
  secretBase32: string,
  timeStepSec = 30
): Promise<string> {
  const counter = Math.floor(Date.now() / 1000 / timeStepSec);
  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  view.setBigUint64(0, BigInt(counter));

  const keyBytes = base32ToBytes(secretBase32);

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto subtle is not available in current runtime");
  }

  const cryptoKey = await subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const signature = await subtle.sign("HMAC", cryptoKey, counterBuffer);
  const sigBytes = new Uint8Array(signature);
  const offset = sigBytes[sigBytes.length - 1] & 0x0f;
  const binary =
    ((sigBytes[offset] & 0x7f) << 24) |
    ((sigBytes[offset + 1] & 0xff) << 16) |
    ((sigBytes[offset + 2] & 0xff) << 8) |
    (sigBytes[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, "0");
}

export function getTotpRemainingSeconds(timeStepSec = 30): number {
  const epoch = Math.floor(Date.now() / 1000);
  return timeStepSec - (epoch % timeStepSec);
}
