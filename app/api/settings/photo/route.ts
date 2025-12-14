import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const formData = await request.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${user.id}/profile.${ext}`;
    const storagePath = `profile-photos/${filename}`;

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("public")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload photo" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("public")
      .getPublicUrl(storagePath);

    // Add cache-busting query param
    const profileImageUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update user profile with new photo URL
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        profile_image_url: profileImageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    // Get current user to find existing photo path
    const { data: currentUser } = await supabase
      .from("users")
      .select("profile_image_url")
      .eq("id", user.id)
      .single();

    // Delete from storage if photo exists
    if (currentUser?.profile_image_url) {
      // Extract path from URL
      const url = new URL(currentUser.profile_image_url);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/(.+)/);
      if (pathMatch) {
        const storagePath = pathMatch[1].replace("public/", "").split("?")[0];
        await supabase.storage.from("public").remove([storagePath]);
      }
    }

    // Update user profile to remove photo URL
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        profile_image_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Photo delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
