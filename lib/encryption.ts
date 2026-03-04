/**
 * AES-256-GCM encryption for sensitive meeting data (transcripts).
 *
 * Key derivation:
 *   masterKey (from env) → HMAC-SHA256(userId) → 32-byte per-user key
 *   This means each user's data is encrypted with a unique key.
 *   Compromise of one user's derived key does NOT expose other users' data.
 *
 * Cipher: AES-256-GCM
 *   - Authenticated encryption: provides both confidentiality and integrity
 *   - 12-byte random IV per encryption (nonce reuse would break GCM; we never reuse)
 *   - 16-byte auth tag appended — detects any tampering
 *
 * Wire format: `enc:v1:<base64(iv[12] || tag[16] || ciphertext[n])>`
 *   The `enc:v1:` prefix lets the decrypt function detect unencrypted legacy data
 *   and return it transparently (backward compatible migration path).
 *
 * Setup: add ENCRYPTION_KEY=<64-hex-chars> to .env.local
 *   Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   IMPORTANT: back this key up — losing it makes all encrypted data unrecoverable.
 */

import { createHmac, createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENC_PREFIX = "enc:v1:";

function getMasterKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(key, "hex");
}

/**
 * Derive a stable, unique 32-byte key per user using HMAC-SHA256.
 * The master key is the HMAC secret; the user ID is the message.
 */
function deriveUserKey(userId: string): Buffer {
  return createHmac("sha256", getMasterKey()).update(userId).digest();
}

/**
 * Encrypt a UTF-8 string with the user's derived AES-256-GCM key.
 * Returns an `enc:v1:<base64>` string safe to store in a TEXT column.
 */
export function encrypt(plaintext: string, userId: string): string {
  const key = deriveUserKey(userId);
  const iv = randomBytes(12); // 96-bit IV for GCM

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertextBuf = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag(); // 16-byte auth tag

  // Pack: iv (12) | tag (16) | ciphertext (variable)
  const packed = Buffer.concat([iv, tag, ciphertextBuf]);
  return ENC_PREFIX + packed.toString("base64");
}

/**
 * Decrypt a string produced by `encrypt()`.
 * Transparently returns non-encrypted strings as-is (backward compatibility).
 * Throws if the auth tag is invalid (tampered data).
 */
export function decrypt(ciphertext: string, userId: string): string {
  // Legacy / already-plaintext data — return unchanged
  if (!ciphertext || !ciphertext.startsWith(ENC_PREFIX)) {
    return ciphertext;
  }

  const key = deriveUserKey(userId);
  const packed = Buffer.from(ciphertext.slice(ENC_PREFIX.length), "base64");

  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const encryptedBuf = packed.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encryptedBuf).toString("utf8") + decipher.final("utf8");
}

/** Convenience: returns true if a string is in encrypted format */
export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}
