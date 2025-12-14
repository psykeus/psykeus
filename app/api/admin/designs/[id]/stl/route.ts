import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get signed URL for STL file viewing (admin - bypasses is_public check)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = createServiceClient();
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

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
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
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
    return NextResponse.json({ error: "No active STL file found" }, { status: 404 });
  }

  // Generate signed URL for the STL file (valid for 1 hour)
  const { data: signedUrl, error: urlError } = await supabase.storage
    .from("designs")
    .createSignedUrl(activeFile.storage_path, 3600);

  if (urlError || !signedUrl) {
    console.error("Error generating signed URL:", urlError);
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }

  return NextResponse.json({ url: signedUrl.signedUrl });
}
