import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { anonymizeIp } from "@/lib/utils";
import { z } from "zod";

const paramsSchema = z.object({
  designId: z.string().uuid(),
  fileId: z.string().uuid(),
});

interface RouteParams {
  params: Promise<{ designId: string; fileId: string }>;
}

/**
 * POST /api/download/[designId]/file/[fileId]
 * Download a specific file from a design
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();

  // Rate limiting
  const identifier = getClientIdentifier(request, user?.id);
  const rateLimit = checkRateLimit(identifier, RATE_LIMITS.download);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Download limit exceeded. Please wait before downloading more files." },
      { status: 429, headers: rateLimit.headers }
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: rateLimit.headers }
    );
  }

  // Validate params
  const rawParams = await params;
  const validation = paramsSchema.safeParse(rawParams);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid parameters" },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const { designId, fileId } = validation.data;

  const supabase = await createClient();
  const serviceSupabase = createServiceClient();

  // Get design (must be public)
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("id")
    .eq("id", designId)
    .eq("is_public", true)
    .single();

  if (designError || !design) {
    return NextResponse.json(
      { error: "Design not found" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  // Get the specific file (must belong to this design)
  const { data: file, error: fileError } = await serviceSupabase
    .from("design_files")
    .select("id, storage_path, original_filename, display_name, file_type")
    .eq("id", fileId)
    .eq("design_id", designId)
    .eq("is_active", true)
    .single();

  if (fileError || !file) {
    return NextResponse.json(
      { error: "File not found" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  // Log the download (non-blocking)
  const forwarded = request.headers.get("x-forwarded-for");
  const fullIp = forwarded ? forwarded.split(",")[0].trim() : null;
  const ip_address = fullIp ? anonymizeIp(fullIp) : null;
  const user_agent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  supabase.from("downloads").insert({
    user_id: user.id,
    design_id: designId,
    design_file_id: file.id,
    ip_address,
    user_agent,
  }).then(({ error }) => {
    if (error) {
      console.error("Failed to log download:", error);
    }
  });

  // Generate signed URL
  const filename = file.original_filename || file.display_name || `design.${file.file_type}`;
  const { data: signedUrlData, error: signedError } = await serviceSupabase.storage
    .from("designs")
    .createSignedUrl(file.storage_path, 60, {
      download: filename,
    });

  if (signedError || !signedUrlData?.signedUrl) {
    console.error("Error generating signed URL:", signedError);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500, headers: rateLimit.headers }
    );
  }

  return NextResponse.json(
    {
      url: signedUrlData.signedUrl,
      filename,
      fileType: file.file_type,
    },
    { headers: rateLimit.headers }
  );
}

