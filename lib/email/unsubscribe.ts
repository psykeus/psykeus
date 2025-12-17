/**
 * Unsubscribe token generation and verification
 * Uses HMAC for secure, stateless unsubscribe links
 */

import crypto from "crypto";

const UNSUBSCRIBE_SECRET =
  process.env.EMAIL_UNSUBSCRIBE_SECRET || "default-secret-change-me";

/**
 * Generate a secure unsubscribe token for a user
 */
export function generateUnsubscribeToken(userId: string): string {
  const timestamp = Date.now().toString();
  const data = `${userId}:${timestamp}`;
  const hmac = crypto.createHmac("sha256", UNSUBSCRIBE_SECRET);
  hmac.update(data);
  const signature = hmac.digest("hex");

  // Encode as base64url: userId:timestamp:signature
  const token = Buffer.from(`${data}:${signature}`).toString("base64url");
  return token;
}

/**
 * Verify and decode an unsubscribe token
 * Returns userId if valid, null if invalid or expired
 */
export function verifyUnsubscribeToken(
  token: string,
  maxAgeMs: number = 30 * 24 * 60 * 60 * 1000 // 30 days
): { userId: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");

    if (parts.length !== 3) {
      return null;
    }

    const [userId, timestampStr, providedSignature] = parts;
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) {
      return null;
    }

    // Check if token is expired
    if (Date.now() - timestamp > maxAgeMs) {
      return null;
    }

    // Verify HMAC signature
    const data = `${userId}:${timestampStr}`;
    const hmac = crypto.createHmac("sha256", UNSUBSCRIBE_SECRET);
    hmac.update(data);
    const expectedSignature = hmac.digest("hex");

    if (!crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    )) {
      return null;
    }

    return { userId, timestamp };
  } catch {
    return null;
  }
}

/**
 * Generate the full unsubscribe URL
 */
export function getUnsubscribeUrl(userId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const token = generateUnsubscribeToken(userId);
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}
