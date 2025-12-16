import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import { forbiddenResponse, notFoundResponse, handleDbError } from "@/lib/api/helpers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get signed URL for STL file viewing (admin - bypasses is_public check)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  const supabase = createServiceClient();

  // Get the design with its active file
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select(`
      id,
      design_files!design_files_design_id_fkey (
        id,
        storage_path,
        file_type,
        is_active
      )
    `)
    .eq("id", id)
    .single();

  if (designError || !design) {
    return notFoundResponse("Design");
  }

  // Find the active STL file
  const files = design.design_files as Array<{
    id: string;
    storage_path: string;
    file_type: string;
    is_active: boolean;
  }>;

  const activeFile = files.find(f => f.is_active && f.file_type === "stl");

  if (!activeFile) {
    return notFoundResponse("Active STL file");
  }

  // Generate signed URL for the STL file (valid for 1 hour)
  const { data: signedUrl, error: urlError } = await supabase.storage
    .from("designs")
    .createSignedUrl(activeFile.storage_path, 3600);

  if (urlError || !signedUrl) {
    return handleDbError(urlError, "generate signed URL");
  }

  return NextResponse.json({ url: signedUrl.signedUrl });
}
