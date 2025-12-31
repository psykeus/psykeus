import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getUserWithTier } from "@/lib/services/user-service";
import { unauthorizedResponse, notFoundResponse, validateRateLimit } from "@/lib/api/helpers";

export async function GET(request: NextRequest) {
  const user = await getUser();

  // Rate limiting - use user ID if authenticated, otherwise use IP
  const rateLimit = validateRateLimit(request, user?.id, "browse");
  if (!rateLimit.success) return rateLimit.response!;

  if (!user) {
    return unauthorizedResponse();
  }

  // Get full user profile with tier info
  const userWithTier = await getUserWithTier(user.id);

  if (!userWithTier) {
    return notFoundResponse("User");
  }

  return NextResponse.json({
    id: userWithTier.id,
    email: userWithTier.email,
    name: userWithTier.name,
    role: userWithTier.role,
    profile_image_url: userWithTier.profile_image_url,
    bio: userWithTier.bio,
    website: userWithTier.website,
    created_at: userWithTier.created_at,
    tier: userWithTier.access_tier,
  });
}
