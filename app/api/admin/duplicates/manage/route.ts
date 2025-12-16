import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import { forbiddenResponse, handleDbError } from "@/lib/api/helpers";

export async function POST(request: NextRequest) {
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const supabase = createServiceClient();

  try {
    const body = await request.json();
    const { action, designId, designId1, designId2 } = body;

    switch (action) {
      case "dismiss": {
        // Mark this pair as dismissed by storing in a dismissals table
        // For now, we'll just return success - dismissals are client-side only
        // In the future, could add a duplicate_dismissals table
        if (!designId1 || !designId2) {
          return NextResponse.json(
            { error: "Both design IDs required for dismiss" },
            { status: 400 }
          );
        }
        return NextResponse.json({ success: true, action: "dismissed" });
      }

      case "delete": {
        if (!designId) {
          return NextResponse.json(
            { error: "Design ID required for delete" },
            { status: 400 }
          );
        }

        // Get design files to delete from storage
        const { data: files } = await supabase
          .from("design_files")
          .select("storage_path")
          .eq("design_id", designId);

        // Delete files from storage
        if (files && files.length > 0) {
          const paths = files.map((f) => f.storage_path);
          await supabase.storage.from("designs").remove(paths);
        }

        // Get design preview path
        const { data: design } = await supabase
          .from("designs")
          .select("preview_path")
          .eq("id", designId)
          .single();

        // Delete preview from storage if it exists
        if (design?.preview_path) {
          try {
            const previewUrl = new URL(design.preview_path);
            const previewPath = previewUrl.pathname.split("/previews/")[1];
            // Validate path to prevent path traversal attacks
            if (previewPath && !previewPath.includes("..") && !previewPath.startsWith("/")) {
              await supabase.storage.from("previews").remove([previewPath]);
            }
          } catch {
            // Preview path might not be a URL, skip deletion
          }
        }

        // Delete design tags
        await supabase.from("design_tags").delete().eq("design_id", designId);

        // Delete design files records
        await supabase.from("design_files").delete().eq("design_id", designId);

        // Delete design record
        const { error: deleteError } = await supabase
          .from("designs")
          .delete()
          .eq("id", designId);

        if (deleteError) {
          return handleDbError(deleteError, "delete design");
        }

        return NextResponse.json({ success: true, action: "deleted", designId });
      }

      case "merge": {
        // Merge design2 into design1 (keep design1, delete design2)
        if (!designId1 || !designId2) {
          return NextResponse.json(
            { error: "Both design IDs required for merge" },
            { status: 400 }
          );
        }

        // Move files from design2 to design1
        const { data: filesToMove } = await supabase
          .from("design_files")
          .select("*")
          .eq("design_id", designId2);

        if (filesToMove && filesToMove.length > 0) {
          // Bulk update all files to belong to design1 and set as variants
          const fileIds = filesToMove.map((f) => f.id);
          await supabase
            .from("design_files")
            .update({
              design_id: designId1,
              file_role: "variant",
              file_group: "merged",
            })
            .in("id", fileIds);
        }

        // Delete design2 tags
        await supabase.from("design_tags").delete().eq("design_id", designId2);

        // Delete design2 record (files were already moved)
        const { error: deleteError } = await supabase
          .from("designs")
          .delete()
          .eq("id", designId2);

        if (deleteError) {
          return handleDbError(deleteError, "complete merge");
        }

        return NextResponse.json({
          success: true,
          action: "merged",
          keptDesignId: designId1,
          mergedDesignId: designId2,
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    return handleDbError(error, "process duplicate management request");
  }
}
