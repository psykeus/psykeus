/**
 * Email Encryption Utilities
 * AES-256-GCM encryption for SMTP passwords
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // AES block size
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get encryption key from environment variable
 * Key should be 32 bytes (256 bits) base64 encoded
 */
function getEncryptionKey(): Buffer {
  const key = process.env.SMTP_ENCRYPTION_KEY;

  if (!key) {
    // If no key is set, generate a warning and use a fallback
    // This is not secure for production but allows the system to work during setup
    console.warn(
      "WARNING: SMTP_ENCRYPTION_KEY not set. Using insecure fallback. Set this in production!"
    );
    // Use a deterministic fallback based on other env vars for consistency
    const fallback = crypto
      .createHash("sha256")
      .update(process.env.NEXTAUTH_SECRET || "default-insecure-key")
      .digest();
    return fallback;
  }

  try {
    // Try to decode as base64
    const decoded = Buffer.from(key, "base64");
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // Not valid base64, try as hex
  }

  try {
    // Try to decode as hex
    const decoded = Buffer.from(key, "hex");
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // Not valid hex
  }

  // Use the key as-is and hash it to get 32 bytes
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * Encrypt a plaintext string
 * Returns: base64 encoded string containing iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return "";
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Combine iv, authTag, and encrypted data
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, "hex"),
  ]);

  return combined.toString("base64");
}

/**
 * Decrypt an encrypted string
 * Input: base64 encoded string containing iv:authTag:ciphertext
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    return "";
  }

  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, "base64");

    // Extract iv, authTag, and encrypted data
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted.toString("hex"), "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt data. The encryption key may have changed.");
  }
}

/**
 * Check if a string appears to be encrypted
 * (base64 encoded and has the expected structure)
 */
export function isEncrypted(data: string): boolean {
  if (!data) {
    return false;
  }

  try {
    const decoded = Buffer.from(data, "base64");
    // Must have at least iv + authTag + 1 byte of data
    return decoded.length > IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Generate a random encryption key (for initial setup)
 * Returns base64 encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

/**
 * Mask a password for display (show first and last char, rest as *)
 */
export function maskPassword(password: string): string {
  if (!password || password.length <= 2) {
    return "***";
  }

  const firstChar = password[0];
  const lastChar = password[password.length - 1];
  const masked = "*".repeat(Math.min(password.length - 2, 10));

  return `${firstChar}${masked}${lastChar}`;
}

/**
 * Hash a password for comparison (without storing the actual password)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512");
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [saltHex, hashHex] = storedHash.split(":");
    const salt = Buffer.from(saltHex, "hex");
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512");
    return hash.toString("hex") === hashHex;
  } catch {
    return false;
  }
}
