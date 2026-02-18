/**
 * Server-only AES-256-GCM encryption for API key storage.
 * Only imported from server actions ("use server" files).
 */
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getKey(): Buffer {
  const hex = process.env.API_KEY_ENC_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "API_KEY_ENC_KEY env var must be a 64-char hex string (32 bytes)",
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns `iv:authTag:ciphertext` (all base64).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Safe wrapper: returns encrypted string or null if encryption is unavailable.
 */
export function tryEncrypt(plaintext: string): string | null {
  try {
    return encrypt(plaintext);
  } catch {
    return null;
  }
}

/**
 * Decrypt a string produced by `encrypt()`.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format (expected iv:tag:data)");
  }
  const iv = Buffer.from(parts[0], "base64");
  const tag = Buffer.from(parts[1], "base64");
  const data = Buffer.from(parts[2], "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}
