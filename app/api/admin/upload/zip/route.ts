import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import {
  isSupportedExtension,
  getFileExtension,
  generateSlug,
  isImageFile,
  isDesignFile,
  PRIMARY_FILE_PRIORITY,
  PREVIEW_FILE_PRIORITY,
  sortFilesByPriority,
  ALL_EXTENSIONS,
  type SortableFile,
} from "@/lib/file-types";
import { validateUploadedFile } from "@/lib/file-validation";
import { extractAIMetadata, extract3DModelMetadata, extractProjectMetadata, type Model3DContext, type ProjectContext } from "@/lib/ai-metadata";
import { generatePreview, supportsPreview, generateStlMultiViewPreview, generateObjMultiViewPreview, generateGltfMultiViewPreview, generate3mfMultiViewPreview } from "@/lib/preview-generator";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { analyzeGeometry, formatDimensions, formatVolume, formatSurfaceArea, estimateMaterialUsage, getComplexityDescription, type Triangle } from "@/lib/geometry-analysis";
import { parseStlBuffer, toGenericTriangles } from "@/lib/parsers/stl-parser";
import { parseObjBuffer } from "@/lib/parsers/obj-parser";
import { parseGltfBuffer } from "@/lib/parsers/gltf-parser";
import { parse3mfBuffer } from "@/lib/parsers/3mf-parser";
import { generatePhash } from "@/lib/phash";
import AdmZip from "adm-zip";
import crypto from "crypto";

export const runtime = "nodejs";

// ExtractedFile implements SortableFile for use with sortFilesByPriority
interface ExtractedFile extends SortableFile {
  buffer: Buffer;
}

// Priority constants are now imported from @/lib/file-types

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Rate limiting
  const identifier = getClientIdentifier(request, user.id);
  const rateLimit = checkRateLimit(identifier, RATE_LIMITS.upload);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Upload rate limit exceeded." },
      { status: 429, headers: rateLimit.headers }
    );
  }

  const supabase = createServiceClient();

  try {
    const formData = await request.formData();
    const zipFile = formData.get("file") as File;
    const generateAiMetadata = formData.get("generateAiMetadata") === "true";
    const projectTitle = formData.get("title") as string | null;

    if (!zipFile) {
      return NextResponse.json({ error: "No ZIP file provided" }, { status: 400 });
    }

    if (!zipFile.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ error: "File must be a ZIP archive" }, { status: 400 });
    }

    // Read ZIP file
    const arrayBuffer = await zipFile.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    // Extract files from ZIP
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    // Filter and extract valid design files
    const extractedFiles: ExtractedFile[] = [];

    for (const entry of zipEntries) {
      // Skip directories and hidden files
      if (entry.isDirectory || entry.entryName.startsWith("__MACOSX") || entry.entryName.startsWith(".")) {
        continue;
      }

      const filename = entry.entryName.split("/").pop() || entry.entryName;

      // Skip hidden files
      if (filename.startsWith(".")) {
        continue;
      }

      if (isSupportedExtension(filename)) {
        const buffer = entry.getData();

        // Validate file content matches claimed extension (magic byte check)
        const contentValidation = validateUploadedFile(buffer, filename, ALL_EXTENSIONS);
        if (!contentValidation.valid) {
          console.warn(`Skipping ${filename}: ${contentValidation.error}`);
          continue;
        }

        extractedFiles.push({
          name: filename,
          buffer,
          extension: getFileExtension(filename),
        });
      }
    }

    if (extractedFiles.length === 0) {
      return NextResponse.json(
        { error: "No valid design files found in ZIP archive" },
        { status: 400 }
      );
    }

    // Separate files into categories
    const imageFiles = extractedFiles.filter(f => isImageFile(f.name));
    const designFiles = extractedFiles.filter(f => isDesignFile(f.name));

    // Sort all files by preview priority to determine preview file
    // sortFilesByPriority is imported from @/lib/file-types
    const sortedByPreview = sortFilesByPriority(extractedFiles, PREVIEW_FILE_PRIORITY);
    const previewFile = sortedByPreview[0];

    // Sort design files by primary priority to determine primary design file
    const sortedDesigns = sortFilesByPriority(designFiles, PRIMARY_FILE_PRIORITY);
    const primaryDesignFile = sortedDesigns[0] || previewFile; // Fallback to preview if no design files

    // The primary file for the database is the first design file (or image if no designs)
    const primaryFile = primaryDesignFile;

    // Collect all filenames for AI context
    const allFilenames = extractedFiles.map(f => f.name);

    // Generate title from primary file if not provided
    const baseName = projectTitle || primaryFile.name.replace(/\.[^/.]+$/, "");
    let title = baseName
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Initialize metadata
    let description = "";
    let projectType: string | null = null;
    let difficulty: string | null = null;
    let categories: string[] = [];
    let style: string | null = null;
    let approxDimensions: string | null = null;
    let tags: string[] = [];

    // Generate preview - prefer image files, otherwise generate from design file
    let previewBuffer: Buffer | undefined;
    let previewPhash: string | undefined;

    // If we have an image file, use it directly as preview
    if (isImageFile(previewFile.name)) {
      try {
        // For images, we can use them directly but may need to resize
        const sharp = (await import("sharp")).default;
        previewBuffer = await sharp(previewFile.buffer)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
        // Generate phash from preview
        previewPhash = await generatePhash(previewBuffer);
      } catch (imageError) {
        console.error("Image preview processing error:", imageError);
        previewBuffer = previewFile.buffer; // Fallback to original
      }
    } else if (supportsPreview(previewFile.extension)) {
      // Generate preview from design file
      try {
        const previewResult = await generatePreview(previewFile.buffer, previewFile.extension, previewFile.name);
        if (previewResult.success && previewResult.buffer) {
          previewBuffer = previewResult.buffer;
          previewPhash = previewResult.phash;
        }
      } catch (previewError) {
        console.error("Preview generation error:", previewError);
      }
    }

    // Extract AI metadata - use project-aware extraction for multi-file uploads
    if (generateAiMetadata) {
      try {
        const ext = primaryFile.extension.toLowerCase();
        const is3DFile = [".stl", ".obj", ".gltf", ".glb", ".3mf"].includes(ext);

        // Build project context for AI
        const projectContext: ProjectContext = {
          allFilenames: allFilenames,
          imageFilename: imageFiles.length > 0 ? imageFiles[0].name : undefined,
          primaryDesignFilename: primaryDesignFile?.name,
          fileCount: extractedFiles.length,
        };

        // For multi-file projects (more than 1 file), use project-aware extraction
        const isMultiFileProject = extractedFiles.length > 1;

        if (is3DFile && !isMultiFileProject) {
          // Single 3D file - use specialized 3D extraction
          let triangles: Triangle[] = [];

          try {
            if (ext === ".stl") {
              const stlResult = parseStlBuffer(primaryFile.buffer);
              triangles = toGenericTriangles(stlResult.triangles);
            } else if (ext === ".obj") {
              const objResult = parseObjBuffer(primaryFile.buffer);
              triangles = objResult.triangles;
            } else if (ext === ".gltf" || ext === ".glb") {
              const gltfResult = await parseGltfBuffer(primaryFile.buffer, ext === ".glb");
              triangles = gltfResult.triangles;
            } else if (ext === ".3mf") {
              const result3mf = await parse3mfBuffer(primaryFile.buffer);
              triangles = result3mf.triangles;
            }
          } catch (parseError) {
            console.error("3D parsing error:", parseError);
          }

          const geometryMetrics = analyzeGeometry(triangles);
          const materialEstimate = estimateMaterialUsage(
            geometryMetrics.volumeEstimate,
            geometryMetrics.detectedUnit
          );

          const model3DContext: Model3DContext = {
            filename: primaryFile.name,
            dimensions: formatDimensions(geometryMetrics),
            triangleCount: geometryMetrics.triangleCount,
            vertexCount: geometryMetrics.vertexCount,
            volumeEstimate: formatVolume(geometryMetrics.volumeEstimate, geometryMetrics.detectedUnit),
            surfaceArea: formatSurfaceArea(geometryMetrics.surfaceArea, geometryMetrics.detectedUnit),
            complexity: getComplexityDescription(geometryMetrics),
            detectedUnit: `${geometryMetrics.detectedUnit} (${geometryMetrics.unitConfidence} confidence)`,
            aspectRatio: geometryMetrics.aspectRatio,
            materialEstimate: `~${materialEstimate.grams}g at 20% infill (~${materialEstimate.metersFilament}m filament)`,
          };

          // Generate multi-view for AI
          let aiImageBuffer: Buffer;
          if (ext === ".stl") {
            const multiViewResult = await generateStlMultiViewPreview(primaryFile.buffer);
            aiImageBuffer = multiViewResult.success && multiViewResult.buffer ? multiViewResult.buffer : (previewBuffer || primaryFile.buffer);
          } else if (ext === ".obj") {
            const multiViewResult = await generateObjMultiViewPreview(primaryFile.buffer);
            aiImageBuffer = multiViewResult.success && multiViewResult.buffer ? multiViewResult.buffer : (previewBuffer || primaryFile.buffer);
          } else if (ext === ".gltf" || ext === ".glb") {
            const multiViewResult = await generateGltfMultiViewPreview(primaryFile.buffer, ext.slice(1));
            aiImageBuffer = multiViewResult.success && multiViewResult.buffer ? multiViewResult.buffer : (previewBuffer || primaryFile.buffer);
          } else {
            const multiViewResult = await generate3mfMultiViewPreview(primaryFile.buffer);
            aiImageBuffer = multiViewResult.success && multiViewResult.buffer ? multiViewResult.buffer : (previewBuffer || primaryFile.buffer);
          }

          const aiMetadata = await extract3DModelMetadata(aiImageBuffer, model3DContext);
          title = aiMetadata.title || title;
          description = aiMetadata.description || "";
          projectType = aiMetadata.project_type;
          difficulty = aiMetadata.difficulty;
          categories = aiMetadata.categories;
          style = aiMetadata.style;
          approxDimensions = model3DContext.dimensions;
          tags = aiMetadata.tags || [];

        } else if (isMultiFileProject) {
          // Multi-file project - use project-aware extraction with all filenames
          // Prefer image file for analysis if available, otherwise use preview buffer
          const aiImageBuffer = previewBuffer || primaryFile.buffer;
          const mimeType = previewBuffer ? "image/png" : (primaryFile.extension === ".svg" ? "image/svg+xml" : "application/octet-stream");

          const aiMetadata = await extractProjectMetadata(aiImageBuffer, projectContext, mimeType);
          title = aiMetadata.title || title;
          description = aiMetadata.description || "";
          projectType = aiMetadata.project_type;
          difficulty = aiMetadata.difficulty;
          categories = aiMetadata.categories;
          style = aiMetadata.style;
          approxDimensions = aiMetadata.approx_dimensions;
          tags = aiMetadata.tags || [];

        } else {
          // Single 2D file - use standard extraction
          const aiImageBuffer = previewBuffer || primaryFile.buffer;
          const mimeType = previewBuffer ? "image/png" : (primaryFile.extension === ".svg" ? "image/svg+xml" : "application/octet-stream");

          const aiMetadata = await extractAIMetadata(aiImageBuffer, primaryFile.name, mimeType);
          title = aiMetadata.title || title;
          description = aiMetadata.description || "";
          projectType = aiMetadata.project_type;
          difficulty = aiMetadata.difficulty;
          categories = aiMetadata.categories;
          style = aiMetadata.style;
          approxDimensions = aiMetadata.approx_dimensions;
          tags = aiMetadata.tags || [];
        }
      } catch (aiError) {
        console.error("AI metadata error:", aiError);
      }
    }

    // Generate unique slug
    let slug = generateSlug(title);
    const { data: existingSlug } = await supabase
      .from("designs")
      .select("slug")
      .eq("slug", slug)
      .single();

    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Create design record
    const { data: design, error: designError } = await supabase
      .from("designs")
      .insert({
        slug,
        title,
        description,
        preview_path: "",
        is_public: false,
        project_type: projectType,
        difficulty,
        categories,
        style,
        approx_dimensions: approxDimensions,
      })
      .select()
      .single();

    if (designError || !design) {
      return NextResponse.json(
        { error: `Failed to create design: ${designError?.message}` },
        { status: 500 }
      );
    }

    // Upload preview
    let previewPath = "";
    if (previewBuffer) {
      try {
        const contentHash = crypto.createHash("sha256").update(primaryFile.buffer).digest("hex");
        const timestamp = Date.now().toString(36);
        const previewFilename = `${slug}-${contentHash.slice(0, 8)}-${timestamp}.png`;

        const { error: previewUploadError } = await supabase.storage
          .from("previews")
          .upload(previewFilename, previewBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (!previewUploadError) {
          const { data: publicUrl } = supabase.storage
            .from("previews")
            .getPublicUrl(previewFilename);
          previewPath = publicUrl.publicUrl;
        }
      } catch (previewError) {
        console.error("Preview upload error:", previewError);
      }
    }

    // Upload all files and create design_files records
    const fileResults: Array<{
      success: boolean;
      filename: string;
      fileId?: string;
      error?: string;
    }> = [];

    let primaryFileId: string | null = null;

    // Get primary file's base name for variant detection
    const primaryBaseName = primaryFile.name.replace(/\.[^/.]+$/, "").toLowerCase();

    for (let i = 0; i < extractedFiles.length; i++) {
      const file = extractedFiles[i];
      const isPrimary = i === 0;

      // Smart role detection:
      // - If same base name as primary but different extension = variant (same design, different format)
      // - If different base name = component (different part of the project)
      const fileBaseName = file.name.replace(/\.[^/.]+$/, "").toLowerCase();
      const isVariant = !isPrimary && fileBaseName === primaryBaseName;
      const fileRole = isPrimary ? "primary" : (isVariant ? "variant" : "component");

      try {
        const contentHash = crypto.createHash("sha256").update(file.buffer).digest("hex");
        const fileId = crypto.randomUUID();
        const storagePath = `files/${design.id}/${fileId}${file.extension}`;

        // Upload file
        const { error: uploadError } = await supabase.storage
          .from("designs")
          .upload(storagePath, file.buffer, {
            contentType: "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          fileResults.push({
            success: false,
            filename: file.name,
            error: `Upload failed: ${uploadError.message}`,
          });
          continue;
        }

        // Create design_files record
        const fileBaseName = file.name.replace(/\.[^/.]+$/, "");
        const { data: newFile, error: insertError } = await supabase
          .from("design_files")
          .insert({
            id: fileId,
            design_id: design.id,
            storage_path: storagePath,
            file_type: file.extension.slice(1),
            size_bytes: file.buffer.length,
            content_hash: contentHash,
            preview_phash: isPrimary ? (previewPhash || null) : null,
            version_number: 1,
            is_active: true,
            file_role: fileRole,
            file_group: "main",
            original_filename: file.name,
            display_name: fileBaseName,
            sort_order: i,
          })
          .select()
          .single();

        if (insertError || !newFile) {
          await supabase.storage.from("designs").remove([storagePath]);
          fileResults.push({
            success: false,
            filename: file.name,
            error: `Database error: ${insertError?.message}`,
          });
          continue;
        }

        if (isPrimary) {
          primaryFileId = newFile.id;
        }

        fileResults.push({
          success: true,
          filename: file.name,
          fileId: newFile.id,
        });

      } catch (err) {
        fileResults.push({
          success: false,
          filename: file.name,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Update design with primary_file_id, current_version_id, and preview_path
    if (primaryFileId) {
      await supabase
        .from("designs")
        .update({
          current_version_id: primaryFileId,
          primary_file_id: primaryFileId,
          preview_path: previewPath || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/previews/placeholder.png`,
        })
        .eq("id", design.id);
    }

    // Save tags
    if (tags.length > 0) {
      for (const tagName of tags) {
        const normalizedTag = tagName.toLowerCase().trim();
        if (!normalizedTag) continue;

        let tagId: string;
        const { data: existingTag } = await supabase
          .from("tags")
          .select("id")
          .eq("name", normalizedTag)
          .single();

        if (existingTag) {
          tagId = existingTag.id;
        } else {
          const { data: newTag, error: tagError } = await supabase
            .from("tags")
            .insert({ name: normalizedTag })
            .select("id")
            .single();

          if (tagError || !newTag) continue;
          tagId = newTag.id;
        }

        await supabase
          .from("design_tags")
          .insert({ design_id: design.id, tag_id: tagId });
      }
    }

    const successCount = fileResults.filter(r => r.success).length;
    const failCount = fileResults.filter(r => !r.success).length;

    return NextResponse.json({
      message: `Created design with ${successCount} file(s)${failCount > 0 ? `, ${failCount} failed` : ""}`,
      designId: design.id,
      slug: design.slug,
      title,
      filesProcessed: fileResults,
      successCount,
      failCount,
    });

  } catch (error) {
    console.error("ZIP upload error:", error);
    return NextResponse.json(
      { error: "ZIP upload failed" },
      { status: 500 }
    );
  }
}
