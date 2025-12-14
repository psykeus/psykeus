import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { get3DModelType } from "@/lib/file-types";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET - Get signed URL for 3D model file viewing (STL, OBJ, GLTF, GLB)
// Accepts either design ID or slug as the parameter
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const supabase = await createClient();
  // Use service client for storage access (private bucket)
  const serviceSupabase = createServiceClient();

  // Try to find by ID first (UUID format), then by slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  let query = supabase
    .from("designs")
    .select(`
      id,
      is_public,
      design_files!design_files_design_id_fkey (
        id,
        storage_path,
        file_type,
        size_bytes,
        is_active
      )
    `);

  if (isUuid) {
    query = query.eq("id", slug);
  } else {
    query = query.eq("slug", slug);
  }

  const { data: design, error: designError } = await query.single();

  if (designError || !design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  if (!design.is_public) {
    return NextResponse.json({ error: "Design not accessible" }, { status: 403 });
  }

  // Find the active 3D file (stl, obj, gltf, glb)
  const files = design.design_files as Array<{
    id: string;
    storage_path: string;
    file_type: string;
    size_bytes: number | null;
    is_active: boolean;
  }>;

  const threeDTypes = ["stl", "obj", "gltf", "glb", "3mf"];
  const activeFile = files?.find(f => f.is_active && threeDTypes.includes(f.file_type.toLowerCase()));

  if (!activeFile) {
    return NextResponse.json({ error: "3D model file not found" }, { status: 404 });
  }

  // Determine model type from file extension
  const modelType = get3DModelType(`.${activeFile.file_type}`) || "stl";

  // Generate signed URL for the 3D file (valid for 1 hour)
  // Use service client to access private storage bucket
  const { data: signedUrl, error: urlError } = await serviceSupabase.storage
    .from("designs")
    .createSignedUrl(activeFile.storage_path, 3600);

  if (urlError || !signedUrl) {
    console.error("Error generating signed URL:", urlError);
    // Check if the file doesn't exist in storage
    if (urlError?.message?.includes("not found") || (urlError as { statusCode?: string })?.statusCode === "404") {
      return NextResponse.json({ error: "3D model file not found in storage" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }

  return NextResponse.json({
    url: signedUrl.signedUrl,
    modelType,
    fileType: activeFile.file_type,
    fileSize: activeFile.size_bytes,
  });
}
