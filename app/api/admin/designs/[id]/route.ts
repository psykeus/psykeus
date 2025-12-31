import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { updateDesignSchema, formatZodError } from "@/lib/validations";
import type { IdRouteParams } from "@/lib/types";
import { z } from "zod";
import {
  validateRateLimit,
  validateParams,
  parseJsonBody,
  requireAdminApi,
  notFoundResponse,
  handleDbError,
} from "@/lib/api/helpers";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

// GET - Get single design with all details (bypasses RLS for admins)
export async function GET(request: NextRequest, { params }: IdRouteParams) {
  const adminResult = await requireAdminApi();
  if (adminResult.response) return adminResult.response;
  const user = adminResult.user;

  const rateLimit = validateRateLimit(request, user.id, "admin");
  if (!rateLimit.success) return rateLimit.response!;

  const paramsResult = await validateParams(params, paramsSchema, rateLimit.headers);
  if (!paramsResult.success) return paramsResult.response!;

  const { id } = paramsResult.data!;
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
    return notFoundResponse("Design", rateLimit.headers);
  }

  return NextResponse.json({ design }, { headers: rateLimit.headers });
}

// PATCH - Update design metadata
export async function PATCH(request: NextRequest, { params }: IdRouteParams) {
  const adminResult = await requireAdminApi();
  if (adminResult.response) return adminResult.response;
  const user = adminResult.user;

  const rateLimit = validateRateLimit(request, user.id, "admin");
  if (!rateLimit.success) return rateLimit.response!;

  const paramsResult = await validateParams(params, paramsSchema, rateLimit.headers);
  if (!paramsResult.success) return paramsResult.response!;

  const { id } = paramsResult.data!;

  const bodyResult = await parseJsonBody(request, rateLimit.headers);
  if (!bodyResult.success) return bodyResult.response!;

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

  const validation = adminUpdateSchema.safeParse(bodyResult.data);

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
    return handleDbError(error, "update design", rateLimit.headers);
  }

  return NextResponse.json({ design }, { headers: rateLimit.headers });
}

// DELETE - Soft delete or hard delete design
export async function DELETE(request: NextRequest, { params }: IdRouteParams) {
  const adminResult = await requireAdminApi();
  if (adminResult.response) return adminResult.response;
  const user = adminResult.user;

  const rateLimit = validateRateLimit(request, user.id, "admin");
  if (!rateLimit.success) return rateLimit.response!;

  const paramsResult = await validateParams(params, paramsSchema, rateLimit.headers);
  if (!paramsResult.success) return paramsResult.response!;

  const { id } = paramsResult.data!;
  const supabase = createServiceClient();

  const { searchParams } = new URL(request.url);
  const hard = searchParams.get("hard") === "true";

  if (hard) {
    // Hard delete - also deletes design_files via CASCADE
    const { error } = await supabase.from("designs").delete().eq("id", id);

    if (error) {
      return handleDbError(error, "delete design", rateLimit.headers);
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
      return handleDbError(error, "archive design", rateLimit.headers);
    }

    return NextResponse.json(
      { message: "Design archived" },
      { headers: rateLimit.headers }
    );
  }
}
