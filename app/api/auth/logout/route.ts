import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionCookie, deleteSession, clearSessionCookie } from "@/lib/session";

export async function POST() {
  try {
    // Get and delete the app session
    const sessionToken = await getSessionCookie();
    if (sessionToken) {
      await deleteSession(sessionToken);
    }

    // Clear the session cookie
    await clearSessionCookie();

    // Also sign out from Supabase
    const supabase = await createClient();
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    // Even if there's an error, try to clear the cookie
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  }
}
