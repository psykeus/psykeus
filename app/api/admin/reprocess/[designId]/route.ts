import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ designId: string }>;
}

// POST - Re-process a design (trigger AI metadata regeneration)
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { designId } = await params;
  const supabase = await createClient();
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get the design
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("id, preview_path, current_version_id")
    .eq("id", designId)
    .single();

  if (designError || !design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
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
    console.error("Error marking for reprocess:", updateError);
    return NextResponse.json(
      { error: "Failed to mark for reprocessing" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Design marked for reprocessing",
    design_id: designId,
  });
}
