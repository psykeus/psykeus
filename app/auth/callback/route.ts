import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createSession, setSessionCookie } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/";

  // Use the configured site URL, falling back to x-forwarded-host, then request origin
  const forwardedHost = request.headers.get("x-forwarded-host");
  const origin = process.env.NEXT_PUBLIC_SITE_URL
    || (forwardedHost ? `https://${forwardedHost}` : null)
    || new URL(request.url).origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get the authenticated user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const serviceSupabase = createServiceClient();

        // Get request metadata
        const forwarded = request.headers.get("x-forwarded-for");
        const ipAddress = forwarded ? forwarded.split(",")[0].trim() : undefined;
        const userAgent = request.headers.get("user-agent") ?? undefined;

        // Check if user exists in our table
        const { data: existingUser } = await serviceSupabase
          .from("users")
          .select("id, login_count")
          .eq("id", user.id)
          .single();

        // Get free tier ID for new users
        const { data: freeTier } = await serviceSupabase
          .from("access_tiers")
          .select("id")
          .eq("slug", "free")
          .single();

        if (!existingUser) {
          // Create user record with default free tier
          await serviceSupabase.from("users").insert({
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.name || null,
            role: "user",
            tier_id: freeTier?.id,
            status: "active",
            login_count: 1,
            last_login_at: new Date().toISOString(),
          });
        } else {
          // Update login tracking
          await serviceSupabase
            .from("users")
            .update({
              login_count: (existingUser.login_count || 0) + 1,
              last_login_at: new Date().toISOString(),
            })
            .eq("id", user.id);
        }

        // Create single-session token (this invalidates all other sessions)
        try {
          const sessionToken = await createSession(
            user.id,
            userAgent,
            ipAddress
          );

          // Set the session cookie
          await setSessionCookie(sessionToken);

          // Log the login activity
          await serviceSupabase.from("user_activity").insert({
            user_id: user.id,
            activity_type: "login",
            ip_address: ipAddress,
            user_agent: userAgent?.slice(0, 500),
            metadata: {
              is_new_user: !existingUser,
            },
          });
        } catch (sessionError) {
          console.error("Failed to create session:", sessionError);
          // Continue anyway - the user is still authenticated via Supabase
        }
      }

      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`);
}
