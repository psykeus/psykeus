import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import { isSupportedExtension, getFileExtension, generateSlug, ALL_EXTENSIONS } from "@/lib/file-types";
import { forbiddenResponse, handleDbError } from "@/lib/api/helpers";
import { validateUploadedFile } from "@/lib/file-validation";
import { extractAIMetadata, extract3DModelMetadata, type Model3DContext } from "@/lib/ai-metadata";
import { generatePreview, supportsPreview, generateStlMultiViewPreview, generateObjMultiViewPreview, generateGltfMultiViewPreview, generate3mfMultiViewPreview } from "@/lib/preview-generator";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { analyzeGeometry, formatDimensions, formatVolume, formatSurfaceArea, estimateMaterialUsage, getComplexityDescription, type Triangle } from "@/lib/geometry-analysis";
import { parseStlBuffer, toGenericTriangles } from "@/lib/parsers/stl-parser";
import { parseObjBuffer } from "@/lib/parsers/obj-parser";
import { parseGltfBuffer } from "@/lib/parsers/gltf-parser";
import { parse3mfBuffer } from "@/lib/parsers/3mf-parser";
import { findSimilarHashes } from "@/lib/phash";
import crypto from "crypto";

export const runtime = "nodejs";

interface UploadResult {
  success: boolean;
  filename: string;
  designId?: string;
  error?: string;
  nearDuplicates?: Array<{ designId: string; title: string; similarity: number }>;
}

export async function POST(request: NextRequest) {
  // Verify admin access
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  // Rate limiting for uploads
  const identifier = getClientIdentifier(request, user.id);
  const rateLimit = checkRateLimit(identifier, RATE_LIMITS.upload);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Upload rate limit exceeded. Please wait before uploading more files." },
      { status: 429, headers: rateLimit.headers }
    );
  }

  const supabase = createServiceClient();

  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const generateAiMetadata = formData.get("generateAiMetadata") === "true";

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const results: UploadResult[] = [];

    for (const file of files) {
      try {
        // Validate file type by extension
        if (!isSupportedExtension(file.name)) {
          results.push({
            success: false,
            filename: file.name,
            error: `Unsupported file type: ${getFileExtension(file.name)}`,
          });
          continue;
        }

        // Read file content
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Validate file content matches claimed extension (magic byte check)
        const contentValidation = validateUploadedFile(buffer, file.name, ALL_EXTENSIONS);
        if (!contentValidation.valid) {
          results.push({
            success: false,
            filename: file.name,
            error: contentValidation.error || "Invalid file content",
          });
          continue;
        }

        // Calculate content hash for duplicate detection
        const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

        // Check for exact duplicate
        const { data: existingFile } = await supabase
          .from("design_files")
          .select("id, design_id")
          .eq("content_hash", contentHash)
          .single();

        if (existingFile) {
          results.push({
            success: false,
            filename: file.name,
            error: "Duplicate file already exists in the library",
          });
          continue;
        }

        // Get file extension early (needed for preview and AI metadata)
        const fileExt = getFileExtension(file.name);

        // Generate title from filename (fallback)
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        let title = baseName
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        // Initialize metadata fields
        let description = "";
        let projectType: string | null = null;
        let difficulty: string | null = null;
        let categories: string[] = [];
        let style: string | null = null;
        let approxDimensions: string | null = null;
        let tags: string[] = [];

        // Generate preview FIRST (so we can use it for AI metadata and duplicate detection)
        let previewBuffer: Buffer | undefined;
        let previewPhash: string | undefined;
        let nearDuplicates: Array<{ designId: string; title: string; similarity: number }> = [];

        if (supportsPreview(fileExt)) {
          try {
            const previewResult = await generatePreview(buffer, fileExt, file.name);
            if (previewResult.success && previewResult.buffer) {
              previewBuffer = previewResult.buffer;
              previewPhash = previewResult.phash;
              console.log(`Preview generated for ${file.name}${previewPhash ? ` (phash: ${previewPhash})` : ""}`);

              // Check for near-duplicates using phash
              if (previewPhash) {
                const { data: existingHashes } = await supabase
                  .from("design_files")
                  .select("id, design_id, preview_phash, designs(id, title)")
                  .not("preview_phash", "is", null)
                  .eq("is_active", true);

                if (existingHashes && existingHashes.length > 0) {
                  const hashList = existingHashes.map(f => ({
                    id: f.design_id,
                    hash: f.preview_phash || "",
                  }));
                  const similar = findSimilarHashes(previewPhash, hashList, 10);

                  if (similar.length > 0) {
                    // Get titles for similar designs
                    const similarDesignIds = similar.map(s => s.id);
                    const { data: similarDesigns } = await supabase
                      .from("designs")
                      .select("id, title")
                      .in("id", similarDesignIds);

                    const titleMap = new Map(similarDesigns?.map(d => [d.id, d.title]) || []);
                    nearDuplicates = similar.map(s => ({
                      designId: s.id,
                      title: titleMap.get(s.id) || "Unknown",
                      similarity: s.similarity,
                    }));

                    console.log(`Found ${nearDuplicates.length} near-duplicate(s) for ${file.name}`);
                  }
                }
              }
            } else {
              console.warn(`Preview generation failed for ${file.name}: ${previewResult.error}`);
            }
          } catch (previewError) {
            console.error(`Preview generation error for ${file.name}:`, previewError);
          }
        }

        // Extract AI metadata if requested (use preview if available)
        if (generateAiMetadata) {
          try {
            const ext = fileExt.toLowerCase();
            const is3DFile = [".stl", ".obj", ".gltf", ".glb", ".3mf"].includes(ext);

            if (is3DFile) {
              // Parse 3D file and compute geometry metrics
              let triangles: Triangle[] = [];

              try {
                if (ext === ".stl") {
                  const stlResult = parseStlBuffer(buffer);
                  triangles = toGenericTriangles(stlResult.triangles);
                } else if (ext === ".obj") {
                  const objResult = parseObjBuffer(buffer);
                  triangles = objResult.triangles;
                } else if (ext === ".gltf" || ext === ".glb") {
                  const gltfResult = await parseGltfBuffer(buffer, ext === ".glb");
                  triangles = gltfResult.triangles;
                } else if (ext === ".3mf") {
                  const result3mf = await parse3mfBuffer(buffer);
                  triangles = result3mf.triangles;
                }
              } catch (parseError) {
                console.error(`Failed to parse ${ext} file for geometry analysis:`, parseError);
              }

              // Compute geometry metrics
              const geometryMetrics = analyzeGeometry(triangles);
              const materialEstimate = estimateMaterialUsage(
                geometryMetrics.volumeEstimate,
                geometryMetrics.detectedUnit
              );

              // Build context for AI with computed geometry data
              const model3DContext: Model3DContext = {
                filename: file.name,
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

              // Generate multi-view preview for AI analysis
              let aiImageBuffer: Buffer;
              if (ext === ".stl") {
                const multiViewResult = await generateStlMultiViewPreview(buffer);
                aiImageBuffer = multiViewResult.success && multiViewResult.buffer
                  ? multiViewResult.buffer
                  : (previewBuffer || buffer);
              } else if (ext === ".obj") {
                const multiViewResult = await generateObjMultiViewPreview(buffer);
                aiImageBuffer = multiViewResult.success && multiViewResult.buffer
                  ? multiViewResult.buffer
                  : (previewBuffer || buffer);
              } else if (ext === ".gltf" || ext === ".glb") {
                const multiViewResult = await generateGltfMultiViewPreview(buffer, ext.slice(1));
                aiImageBuffer = multiViewResult.success && multiViewResult.buffer
                  ? multiViewResult.buffer
                  : (previewBuffer || buffer);
              } else {
                const multiViewResult = await generate3mfMultiViewPreview(buffer);
                aiImageBuffer = multiViewResult.success && multiViewResult.buffer
                  ? multiViewResult.buffer
                  : (previewBuffer || buffer);
              }

              console.log(`Using 3D-specific AI extraction for ${file.name} with geometry context`);
              console.log(`  Dimensions: ${model3DContext.dimensions}`);
              console.log(`  Complexity: ${model3DContext.complexity}`);
              console.log(`  Material: ${model3DContext.materialEstimate}`);

              // Use specialized 3D extraction with geometry context
              const aiMetadata = await extract3DModelMetadata(aiImageBuffer, model3DContext);

              title = aiMetadata.title || title;
              description = aiMetadata.description || "";
              projectType = aiMetadata.project_type;
              difficulty = aiMetadata.difficulty;
              categories = aiMetadata.categories;
              style = aiMetadata.style;
              // Use computed dimensions instead of AI-guessed
              approxDimensions = model3DContext.dimensions;
              tags = aiMetadata.tags || [];

            } else {
              // Non-3D files: use generic AI extraction
              const aiImageBuffer = previewBuffer || buffer;
              const mimeType = previewBuffer ? "image/png" : (ext === ".svg" ? "image/svg+xml" : "application/octet-stream");

              const aiMetadata = await extractAIMetadata(aiImageBuffer, file.name, mimeType);

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
            console.error("AI metadata extraction error:", aiError);
            // Continue with basic metadata
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

        // Create design record first (without current_version_id)
        const { data: design, error: designError } = await supabase
          .from("designs")
          .insert({
            slug,
            title,
            description,
            preview_path: "", // Will update after upload
            is_public: false, // Start as draft
            project_type: projectType,
            difficulty,
            categories,
            style,
            approx_dimensions: approxDimensions,
          })
          .select()
          .single();

        if (designError || !design) {
          results.push({
            success: false,
            filename: file.name,
            error: `Failed to create design: ${designError?.message}`,
          });
          continue;
        }

        // Upload design file to storage
        const storagePath = `files/${design.id}/v1${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("designs")
          .upload(storagePath, buffer, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          // Clean up design record
          await supabase.from("designs").delete().eq("id", design.id);
          results.push({
            success: false,
            filename: file.name,
            error: `Failed to upload file: ${uploadError.message}`,
          });
          continue;
        }

        // Upload preview (already generated earlier)
        let previewPath = "";
        if (previewBuffer) {
          try {
            // Include timestamp to avoid CDN cache issues when preview format changes
            const timestamp = Date.now().toString(36);
            const previewFilename = `${slug}-${contentHash.slice(0, 8)}-${timestamp}.png`;

            // Upload PNG preview
            const { error: previewUploadError } = await supabase.storage
              .from("previews")
              .upload(previewFilename, previewBuffer, {
                contentType: "image/png",
                upsert: true,
              });

            if (!previewUploadError) {
              // Get public URL
              const { data: publicUrl } = supabase.storage
                .from("previews")
                .getPublicUrl(previewFilename);

              previewPath = publicUrl.publicUrl;
              console.log(`Preview uploaded for ${file.name}: ${previewPath}`);
            } else {
              console.error(`Preview upload error for ${file.name}:`, previewUploadError);
            }
          } catch (previewError) {
            console.error(`Preview upload error for ${file.name}:`, previewError);
          }
        }

        // Create design_files record with multi-file support fields
        const { data: designFile, error: fileRecordError } = await supabase
          .from("design_files")
          .insert({
            design_id: design.id,
            storage_path: storagePath,
            file_type: fileExt.slice(1), // Remove the dot
            size_bytes: buffer.length,
            content_hash: contentHash,
            preview_phash: previewPhash || null,
            version_number: 1,
            is_active: true,
            // Multi-file support fields
            file_role: "primary",
            file_group: "main",
            original_filename: file.name,
            display_name: baseName,
            sort_order: 0,
          })
          .select()
          .single();

        if (fileRecordError || !designFile) {
          results.push({
            success: false,
            filename: file.name,
            error: `Failed to create file record: ${fileRecordError?.message}`,
          });
          continue;
        }

        // Update design with current_version_id, primary_file_id, and preview_path
        await supabase
          .from("designs")
          .update({
            current_version_id: designFile.id,
            primary_file_id: designFile.id,
            preview_path: previewPath || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/previews/placeholder.png`,
          })
          .eq("id", design.id);

        // Save tags if any were generated by AI
        if (tags.length > 0) {
          for (const tagName of tags) {
            const normalizedTag = tagName.toLowerCase().trim();
            if (!normalizedTag) continue;

            // Get or create tag
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

              if (tagError || !newTag) {
                console.error("Failed to create tag:", normalizedTag, tagError);
                continue;
              }
              tagId = newTag.id;
            }

            // Link tag to design
            await supabase
              .from("design_tags")
              .insert({ design_id: design.id, tag_id: tagId })
              .select();
          }
        }

        results.push({
          success: true,
          filename: file.name,
          designId: design.id,
          nearDuplicates: nearDuplicates.length > 0 ? nearDuplicates : undefined,
        });

      } catch (err) {
        results.push({
          success: false,
          filename: file.name,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Uploaded ${successCount} file(s), ${failCount} failed`,
      results,
      successCount,
      failCount,
    });

  } catch (error) {
    return handleDbError(error, "upload files");
  }
}
