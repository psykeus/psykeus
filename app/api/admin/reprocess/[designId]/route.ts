import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import { forbiddenResponse, notFoundResponse, handleDbError } from "@/lib/api/helpers";

interface RouteParams {
  params: Promise<{ designId: string }>;
}

// POST - Re-process a design (trigger AI metadata regeneration)
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { designId } = await params;
  const supabase = await createClient();
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  // Get the design
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("id, preview_path, current_version_id")
    .eq("id", designId)
    .single();

  if (designError || !design) {
    return notFoundResponse("Design");
  }

  // In a real implementation, you would:
  // 1. Get the preview image from storage
  // 2. Call the AI vision API to regenerate metadata
  // 3. Update the design with new metadata
  //
  // For now, we'll just return a placeholder response
  // The actual AI processing would be done by the ingestion script

  // Mark as needing reprocessing (could be picked up by a background job)
  const { error: updateError } = await supabase
    .from("designs")
    .update({
      metadata_json: {
        ...(design as { metadata_json?: Record<string, unknown> }).metadata_json,
        _reprocess_requested: new Date().toISOString(),
        _reprocess_requested_by: user.id,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", designId);

  if (updateError) {
    return handleDbError(updateError, "mark for reprocessing");
  }

  return NextResponse.json({
    message: "Design marked for reprocessing",
    design_id: designId,
  });
}
