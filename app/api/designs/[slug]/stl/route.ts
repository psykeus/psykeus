import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET - Get signed URL for STL file viewing
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

  // Find the active STL file
  const files = design.design_files as Array<{
    id: string;
    storage_path: string;
    file_type: string;
    is_active: boolean;
  }>;

  const activeFile = files?.find(f => f.is_active && f.file_type === "stl");

  if (!activeFile) {
    return NextResponse.json({ error: "STL file not found" }, { status: 404 });
  }

  // Generate signed URL for the STL file (valid for 1 hour)
  // Use service client to access private storage bucket
  const { data: signedUrl, error: urlError } = await serviceSupabase.storage
    .from("designs")
    .createSignedUrl(activeFile.storage_path, 3600);

  if (urlError || !signedUrl) {
    console.error("Error generating signed URL:", urlError);
    // Check if the file doesn't exist in storage
    if (urlError?.message?.includes("not found") || (urlError as { statusCode?: string })?.statusCode === "404") {
      return NextResponse.json({ error: "STL file not found in storage" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }

  return NextResponse.json({ url: signedUrl.signedUrl });
}
