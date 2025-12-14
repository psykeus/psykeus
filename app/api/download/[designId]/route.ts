import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { anonymizeIp } from "@/lib/utils";
import {
  canUserAccessDesign,
  checkUserDownloadLimit,
  logUserActivity,
} from "@/lib/services/user-service";
import type { DesignIdRouteParams } from "@/lib/types";
import { z } from "zod";

const paramsSchema = z.object({
  designId: z.string().uuid(),
});

export async function POST(request: NextRequest, { params }: DesignIdRouteParams) {
  const user = await getUser();

  // Rate limiting - use user ID if authenticated, otherwise IP
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

  // Check user status (suspended/banned users cannot download)
  const serviceSupabase = createServiceClient();
  const { data: userData } = await serviceSupabase
    .from("users")
    .select("status")
    .eq("id", user.id)
    .single();

  if (userData?.status !== "active") {
    return NextResponse.json(
      { error: "Your account has been suspended. Contact support for assistance." },
      { status: 403, headers: rateLimit.headers }
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

  const { designId } = validation.data;

  // Check user's download limits
  const downloadLimit = await checkUserDownloadLimit(user.id);
  if (!downloadLimit.can_download) {
    return NextResponse.json(
      {
        error: downloadLimit.reason || "Download limit reached",
        downloads_today: downloadLimit.downloads_today,
        downloads_this_month: downloadLimit.downloads_this_month,
        daily_limit: downloadLimit.daily_limit,
        monthly_limit: downloadLimit.monthly_limit,
      },
      { status: 429, headers: rateLimit.headers }
    );
  }

  // Check if user can access this design based on their tier
  const canAccess = await canUserAccessDesign(user.id, designId);
  if (!canAccess) {
    return NextResponse.json(
      { error: "This design requires a higher subscription tier. Upgrade your plan to access it." },
      { status: 403, headers: rateLimit.headers }
    );
  }

  const supabase = await createClient();

  // Get design and its current version
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("id, current_version_id, access_level")
    .eq("id", designId)
    .eq("is_public", true)
    .single();

  if (designError || !design) {
    return NextResponse.json(
      { error: "Design not found" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  if (!design.current_version_id) {
    return NextResponse.json(
      { error: "No active file version" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  // Get the active file version using service client to bypass RLS
  const { data: file, error: fileError } = await serviceSupabase
    .from("design_files")
    .select("id, storage_path")
    .eq("id", design.current_version_id)
    .eq("is_active", true)
    .single();

  if (fileError || !file) {
    return NextResponse.json(
      { error: "Active file not found" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  // Log the download (without sensitive full IP - just subnet for analytics)
  const forwarded = request.headers.get("x-forwarded-for");
  const fullIp = forwarded ? forwarded.split(",")[0].trim() : null;
  // Only store anonymized IP (first 3 octets for IPv4)
  const ip_address = fullIp ? anonymizeIp(fullIp) : null;
  const user_agent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  // Non-blocking download logging - don't fail the download if logging fails
  supabase.from("downloads").insert({
    user_id: user.id,
    design_id: design.id,
    design_file_id: file.id,
    ip_address,
    user_agent,
  }).then(({ error }) => {
    if (error) {
      console.error("Failed to log download:", error);
    }
  });

  // Log user activity (non-blocking)
  logUserActivity(
    user.id,
    "download",
    "design",
    designId,
    { access_level: design.access_level },
    ip_address || undefined,
    user_agent || undefined
  ).catch((err) => console.error("Failed to log activity:", err));

  // Generate signed URL (valid for 60 seconds) using service client to bypass storage RLS
  const filename = file.storage_path.split("/").pop() || "design";
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
    { url: signedUrlData.signedUrl },
    { headers: rateLimit.headers }
  );
}

