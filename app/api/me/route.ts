import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getUserWithTier } from "@/lib/services/user-service";

export async function GET() {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get full user profile with tier info
  const userWithTier = await getUserWithTier(user.id);

  if (!userWithTier) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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
