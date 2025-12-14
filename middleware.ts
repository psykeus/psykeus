import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { applySecurityHeaders } from "@/lib/security-headers";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  // Apply security headers to all responses
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - api/admin/upload (large file uploads)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/admin/upload|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
