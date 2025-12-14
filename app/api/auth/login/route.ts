import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createSession, setSessionCookie } from "@/lib/session";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid email or password format" },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;
    const supabase = await createClient();

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || "Invalid credentials" },
        { status: 401 }
      );
    }

    // Ensure user exists in our users table
    const serviceSupabase = createServiceClient();
    const { data: existingUser } = await serviceSupabase
      .from("users")
      .select("id")
      .eq("id", data.user.id)
      .single();

    if (!existingUser) {
      // Create user record
      await serviceSupabase.from("users").insert({
        id: data.user.id,
        email: data.user.email!,
        name: data.user.user_metadata?.name || null,
        role: "user",
      });
    }

    // Get client info for session
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(",")[0].trim() : null;
    const userAgent = request.headers.get("user-agent") ?? undefined;

    // Create single-session token (this invalidates all other sessions)
    const sessionToken = await createSession(
      data.user.id,
      userAgent,
      ipAddress ?? undefined
    );

    // Set the session cookie
    await setSessionCookie(sessionToken);

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
