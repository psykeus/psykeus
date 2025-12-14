import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { anonymizeIp } from "@/lib/utils";
import archiver from "archiver";
import { z } from "zod";
import { PassThrough } from "stream";

const paramsSchema = z.object({
  designId: z.string().uuid(),
});

interface RouteParams {
  params: Promise<{ designId: string }>;
}

/**
 * POST /api/download/[designId]/zip
 * Download all files for a design as a ZIP bundle
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
      { error: "Invalid design ID" },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const { designId } = validation.data;

  const supabase = await createClient();
  const serviceSupabase = createServiceClient();

  // Get design (must be public)
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("id, title, slug")
    .eq("id", designId)
    .eq("is_public", true)
    .single();

  if (designError || !design) {
    return NextResponse.json(
      { error: "Design not found" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  // Get all active files for this design
  const { data: files, error: filesError } = await serviceSupabase
    .from("design_files")
    .select("id, storage_path, original_filename, display_name, file_type")
    .eq("design_id", designId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (filesError || !files || files.length === 0) {
    return NextResponse.json(
      { error: "No files found" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  // Log the download (non-blocking, single entry for ZIP bundle)
  const forwarded = request.headers.get("x-forwarded-for");
  const fullIp = forwarded ? forwarded.split(",")[0].trim() : null;
  const ip_address = fullIp ? anonymizeIp(fullIp) : null;
  const user_agent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  supabase.from("downloads").insert({
    user_id: user.id,
    design_id: designId,
    design_file_id: files[0].id, // Log primary/first file
    ip_address,
    user_agent,
  }).then(({ error }) => {
    if (error) {
      console.error("Failed to log download:", error);
    }
  });

  // Create ZIP archive
  const archive = archiver("zip", {
    zlib: { level: 6 }, // Moderate compression for balance
  });

  // Track used filenames to avoid duplicates
  const usedNames = new Set<string>();

  // Fetch and add each file to the archive
  for (const file of files) {
    try {
      // Download file from storage
      const { data: fileData, error: downloadError } = await serviceSupabase.storage
        .from("designs")
        .download(file.storage_path);

      if (downloadError || !fileData) {
        console.error(`Failed to download file ${file.id}:`, downloadError);
        continue;
      }

      // Determine filename (ensure uniqueness)
      let filename = file.original_filename || file.display_name || `file.${file.file_type}`;

      // If filename already used, add suffix
      if (usedNames.has(filename)) {
        const ext = filename.includes(".") ? filename.split(".").pop() : "";
        const base = filename.replace(/\.[^/.]+$/, "");
        let counter = 1;
        do {
          filename = ext ? `${base}_${counter}.${ext}` : `${base}_${counter}`;
          counter++;
        } while (usedNames.has(filename));
      }
      usedNames.add(filename);

      // Add to archive
      const arrayBuffer = await fileData.arrayBuffer();
      archive.append(Buffer.from(arrayBuffer), { name: filename });

    } catch (err) {
      console.error(`Error processing file ${file.id}:`, err);
    }
  }

  // Finalize the archive
  archive.finalize();

  // Convert archive stream to ReadableStream for Response
  const passThrough = new PassThrough();
  archive.pipe(passThrough);

  // Convert PassThrough to Web ReadableStream
  const readableStream = new ReadableStream({
    start(controller) {
      passThrough.on("data", (chunk) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      passThrough.on("end", () => {
        controller.close();
      });
      passThrough.on("error", (err) => {
        controller.error(err);
      });
    },
  });

  // Create filename for ZIP
  const zipFilename = `${design.slug || design.title.toLowerCase().replace(/\s+/g, "-")}-files.zip`;

  return new Response(readableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFilename}"`,
      ...Object.fromEntries(Object.entries(rateLimit.headers)),
    },
  });
}

