import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "app_session_token";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make your app
  // vulnerable to session fixation attacks.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  const isAccountRoute = request.nextUrl.pathname.startsWith("/account");
  const isApiAdminRoute = request.nextUrl.pathname.startsWith("/api/admin");
  const isLoginRoute = request.nextUrl.pathname === "/login";
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth/callback");

  // If user is authenticated, validate our custom session token
  // For admin routes, we combine session validation with role check in a single query
  if (user && !isLoginRoute && !isAuthCallback) {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const needsAdminCheck = isAdminRoute || isApiAdminRoute;

    if (sessionToken) {
      // Validate session using service role client
      const serviceSupabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {
              // No-op for service client
            },
          },
        }
      );

      // Use combined RPC function for session validation + role check (single query)
      const { data: sessionData, error } = await serviceSupabase.rpc(
        "validate_session_with_role",
        {
          p_session_token: sessionToken,
          p_user_id: user.id,
        }
      );

      const validationResult = sessionData?.[0];

      // If session doesn't exist or doesn't match user, invalidate
      if (error || !validationResult?.is_valid) {
        // User was logged out (probably logged in elsewhere)
        // Clear the session cookie and redirect to login
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "session_expired");
        url.searchParams.set("redirect", request.nextUrl.pathname);

        const response = NextResponse.redirect(url);
        response.cookies.delete(SESSION_COOKIE_NAME);

        // Also sign out from Supabase
        await supabase.auth.signOut();

        return response;
      }

      // For admin routes, check role from the same query result (no extra DB call)
      if (needsAdminCheck) {
        const userRole = validationResult.user_role;
        if (!["admin", "super_admin"].includes(userRole)) {
          const url = request.nextUrl.clone();
          url.pathname = "/";
          return NextResponse.redirect(url);
        }
      }

      return supabaseResponse;
    }
    // If no session token but user is authenticated, they might be using
    // an old session before this feature was implemented - fall through
    // to legacy admin check below
  }

  if (!user && (isAccountRoute || isAdminRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Legacy admin check for users without session token (pre-migration sessions)
  if (user && (isAdminRoute || isApiAdminRoute)) {
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || !["admin", "super_admin"].includes(userData.role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
