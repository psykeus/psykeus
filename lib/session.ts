import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE_NAME = "app_session_token";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Session expiration - configurable via environment variable
// Default: 30 days (same as cookie)
const SESSION_MAX_AGE_SECONDS = parseInt(
  process.env.SESSION_MAX_AGE_SECONDS || String(60 * 60 * 24 * 30),
  10
);

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a new session for a user, invalidating any existing sessions
 * This enforces single-session login
 */
export async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<string> {
  const supabase = createServiceClient();
  const sessionToken = generateSessionToken();

  // Delete all existing sessions for this user (enforces single login)
  await supabase.from("user_sessions").delete().eq("user_id", userId);

  // Calculate expiration time
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();

  // Create new session with explicit expiration
  const { error } = await supabase.from("user_sessions").insert({
    user_id: userId,
    session_token: sessionToken,
    user_agent: userAgent?.slice(0, 500),
    ip_address: ipAddress,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("Failed to create session:", error);
    throw new Error("Failed to create session");
  }

  return sessionToken;
}

/**
 * Validate a session token and return the user_id if valid
 * Also checks for session expiration
 */
export async function validateSession(sessionToken: string): Promise<string | null> {
  if (!sessionToken) return null;

  const supabase = createServiceClient();

  const { data: session, error } = await supabase
    .from("user_sessions")
    .select("user_id, last_active_at, expires_at")
    .eq("session_token", sessionToken)
    .single();

  if (error || !session) {
    return null;
  }

  // Check if session has expired
  if (session.expires_at) {
    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date()) {
      // Session expired - delete it
      await supabase
        .from("user_sessions")
        .delete()
        .eq("session_token", sessionToken);
      return null;
    }
  }

  // Update last_active_at (but not too frequently - every 5 minutes max)
  const lastActive = new Date(session.last_active_at);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  if (lastActive < fiveMinutesAgo) {
    await supabase
      .from("user_sessions")
      .update({ last_active_at: new Date().toISOString() })
      .eq("session_token", sessionToken);
  }

  return session.user_id;
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(sessionToken: string): Promise<void> {
  const supabase = createServiceClient();

  await supabase.from("user_sessions").delete().eq("session_token", sessionToken);
}

/**
 * Delete all sessions for a user (force logout everywhere)
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  const supabase = createServiceClient();

  await supabase.from("user_sessions").delete().eq("user_id", userId);
}

/**
 * Set the session cookie
 */
export async function setSessionCookie(sessionToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * Get the session token from cookie
 */
export async function getSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Clear the session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Check if the current request has a valid session
 * Returns the user_id if valid, null otherwise
 */
export async function getCurrentSession(): Promise<string | null> {
  const sessionToken = await getSessionCookie();
  if (!sessionToken) return null;

  return validateSession(sessionToken);
}
