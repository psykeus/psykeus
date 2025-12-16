import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getUserWithTier } from "@/lib/services/user-service";
import { unauthorizedResponse, notFoundResponse } from "@/lib/api/helpers";

export async function GET() {
  const user = await getUser();

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
