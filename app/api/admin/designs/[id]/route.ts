import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { updateDesignSchema, formatZodError } from "@/lib/validations";
import type { IdRouteParams } from "@/lib/types";
import { z } from "zod";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

// GET - Get single design with all details (bypasses RLS for admins)
export async function GET(request: NextRequest, { params }: IdRouteParams) {
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Rate limiting
  const identifier = getClientIdentifier(request, user.id);
  const rateLimit = checkRateLimit(identifier, RATE_LIMITS.admin);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimit.headers }
    );
  }

  // Validate params
  const rawParams = await params;
  const validation = paramsSchema.safeParse(rawParams);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid design ID" },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const { id } = validation.data;
  const supabase = createServiceClient();

  const { data: design, error } = await supabase
    .from("designs")
    .select(
      `
      *,
      design_files!design_files_design_id_fkey (
        id,
        storage_path,
        file_type,
        size_bytes,
        content_hash,
        preview_phash,
        source_path,
        version_number,
        is_active,
        created_at
      ),
      design_tags (
        tags (
          id,
          name
        )
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !design) {
    return NextResponse.json(
      { error: "Design not found" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  return NextResponse.json({ design }, { headers: rateLimit.headers });
}

// PATCH - Update design metadata
export async function PATCH(request: NextRequest, { params }: IdRouteParams) {
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Rate limiting
  const identifier = getClientIdentifier(request, user.id);
  const rateLimit = checkRateLimit(identifier, RATE_LIMITS.admin);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimit.headers }
    );
  }

  // Validate params
  const rawParams = await params;
  const paramsValidation = paramsSchema.safeParse(rawParams);

  if (!paramsValidation.success) {
    return NextResponse.json(
      { error: "Invalid design ID" },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const { id } = paramsValidation.data;

  // Validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rateLimit.headers }
    );
  }

  // Extended schema for admin updates (includes some extra fields)
  const adminUpdateSchema = updateDesignSchema.extend({
    preview_path: z.string().optional(),
    metadata_json: z.record(z.string(), z.unknown()).optional(),
    current_version_id: z.string().uuid().optional(),
    is_public: z.boolean().optional(),
    access_level: z.enum(["free", "premium", "exclusive"]).optional(),
    publish_at: z.string().datetime().nullable().optional(),
    unpublish_at: z.string().datetime().nullable().optional(),
  });

  const validation = adminUpdateSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: `Invalid data: ${formatZodError(validation.error)}` },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const updates = validation.data;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const supabase = createServiceClient();

  const { data: design, error } = await supabase
    .from("designs")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating design:", error);
    return NextResponse.json(
      { error: "Failed to update design" },
      { status: 500, headers: rateLimit.headers }
    );
  }

  return NextResponse.json({ design }, { headers: rateLimit.headers });
}

// DELETE - Soft delete or hard delete design
export async function DELETE(request: NextRequest, { params }: IdRouteParams) {
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Rate limiting
  const identifier = getClientIdentifier(request, user.id);
  const rateLimit = checkRateLimit(identifier, RATE_LIMITS.admin);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimit.headers }
    );
  }

  // Validate params
  const rawParams = await params;
  const validation = paramsSchema.safeParse(rawParams);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid design ID" },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const { id } = validation.data;
  const supabase = createServiceClient();

  const { searchParams } = new URL(request.url);
  const hard = searchParams.get("hard") === "true";

  if (hard) {
    // Hard delete - also deletes design_files via CASCADE
    const { error } = await supabase.from("designs").delete().eq("id", id);

    if (error) {
      console.error("Error deleting design:", error);
      return NextResponse.json(
        { error: "Failed to delete design" },
        { status: 500, headers: rateLimit.headers }
      );
    }

    return NextResponse.json(
      { message: "Design deleted permanently" },
      { headers: rateLimit.headers }
    );
  } else {
    // Soft delete - just hide from public
    const { error } = await supabase
      .from("designs")
      .update({ is_public: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Error archiving design:", error);
      return NextResponse.json(
        { error: "Failed to archive design" },
        { status: 500, headers: rateLimit.headers }
      );
    }

    return NextResponse.json(
      { message: "Design archived" },
      { headers: rateLimit.headers }
    );
  }
}
