import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/lib/session";

export async function GET() {
  try {
    // Check our app session
    const sessionUserId = await getCurrentSession();

    if (!sessionUserId) {
      return NextResponse.json({ valid: false, reason: "no_session" });
    }

    // Also verify with Supabase auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ valid: false, reason: "no_auth" });
    }

    // Verify the session belongs to the authenticated user
    if (user.id !== sessionUserId) {
      return NextResponse.json({ valid: false, reason: "session_mismatch" });
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ valid: false, reason: "error" });
  }
}
