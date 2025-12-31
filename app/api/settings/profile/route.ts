import { NextRequest, NextResponse } from "next/server";
import { requireUser, getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validateRateLimit } from "@/lib/api/helpers";

// Schema for profile update
interface ProfileUpdate {
  name?: string | null;
  bio?: string | null;
  website?: string | null;
}

export async function PATCH(request: NextRequest) {
  // Rate limiting
  const currentUser = await getUser();
  const rateLimit = validateRateLimit(request, currentUser?.id, "browse");
  if (!rateLimit.success) return rateLimit.response!;

  try {
    const user = await requireUser();
    const supabase = await createClient();
    const body: ProfileUpdate = await request.json();

    // Validate website URL if provided
    if (body.website) {
      try {
        new URL(body.website);
      } catch {
        return NextResponse.json(
          { error: "Invalid website URL" },
          { status: 400 }
        );
      }
    }

    // Validate bio length
    if (body.bio && body.bio.length > 500) {
      return NextResponse.json(
        { error: "Bio must be 500 characters or less" },
        { status: 400 }
      );
    }

    // Validate name length
    if (body.name && body.name.length > 100) {
      return NextResponse.json(
        { error: "Name must be 100 characters or less" },
        { status: 400 }
      );
    }

    // Update user profile
    const { data, error } = await supabase
      .from("users")
      .update({
        name: body.name ?? null,
        bio: body.bio ?? null,
        website: body.website ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update profile:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
