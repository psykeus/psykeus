import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { extractAIMetadata, extract3DModelMetadata, type Model3DContext } from "@/lib/ai-metadata";
import { generatePreview } from "@/lib/preview-generator";
import {
  analyzeGeometry,
  formatDimensions,
  formatVolume,
  formatSurfaceArea,
  estimateMaterialUsage,
  getComplexityDescription,
  type Triangle,
} from "@/lib/geometry-analysis";
import { parseStlBuffer, toGenericTriangles } from "@/lib/parsers/stl-parser";
import { parseObjBuffer } from "@/lib/parsers/obj-parser";
import { parseGltfBuffer } from "@/lib/parsers/gltf-parser";
import { parse3mfBuffer } from "@/lib/parsers/3mf-parser";
import * as fs from "fs/promises";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/designs/[id]/regenerate-ai
 * Regenerate AI metadata for a design
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { id: designId } = await params;
    const supabase = createServiceClient();

    // Get the design with its files
    const { data: design, error: designError } = await supabase
      .from("designs")
      .select(`
        *,
        design_files (*)
      `)
      .eq("id", designId)
      .single();

    if (designError || !design) {
      return NextResponse.json({ error: "Design not found" }, { status: 404 });
    }

    // Find the primary file or the first active file
    const primaryFile = design.design_files?.find((f: { id: string }) => f.id === design.primary_file_id) ||
      design.design_files?.find((f: { is_active: boolean }) => f.is_active) ||
      design.design_files?.[0];

    if (!primaryFile) {
      return NextResponse.json({ error: "No file found for this design" }, { status: 400 });
    }

    console.log(`[REGENERATE-AI] Starting AI regeneration for design ${designId}, file: ${primaryFile.original_filename}`);

    let aiMetadata;
    const fileType = primaryFile.file_type?.toLowerCase() || "";
    const is3DFile = ["stl", "obj", "gltf", "glb", "3mf"].includes(fileType);

    if (is3DFile) {
      // For 3D files, we need to generate a multi-view preview and analyze geometry
      // First, try to get the file from storage or local path
      let fileBuffer: Buffer;

      if (primaryFile.storage_path) {
        // Download from Supabase storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("designs")
          .download(primaryFile.storage_path);

        if (downloadError || !fileData) {
          return NextResponse.json({ error: "Failed to download design file" }, { status: 500 });
        }

        fileBuffer = Buffer.from(await fileData.arrayBuffer());
      } else if (primaryFile.local_path) {
        // Read from local filesystem
        fileBuffer = await fs.readFile(primaryFile.local_path);
      } else {
        return NextResponse.json({ error: "No file path available" }, { status: 400 });
      }

      // Generate preview image
      const filename = primaryFile.original_filename || "model.stl";
      const previewResult = await generatePreview(fileBuffer, fileType, filename);
      if (!previewResult.buffer) {
        return NextResponse.json({ error: "Failed to generate preview for 3D analysis" }, { status: 500 });
      }
      const previewBuffer = previewResult.buffer;

      // Parse 3D file for geometry analysis
      let triangles: Triangle[] = [];
      try {
        if (fileType === "stl") {
          const stlResult = parseStlBuffer(fileBuffer);
          triangles = toGenericTriangles(stlResult.triangles);
        } else if (fileType === "obj") {
          const objResult = parseObjBuffer(fileBuffer);
          triangles = objResult.triangles;
        } else if (fileType === "gltf" || fileType === "glb") {
          const gltfResult = await parseGltfBuffer(fileBuffer, fileType === "glb");
          triangles = gltfResult.triangles;
        } else if (fileType === "3mf") {
          const result3mf = await parse3mfBuffer(fileBuffer);
          triangles = result3mf.triangles;
        }
      } catch (parseError) {
        console.error(`[REGENERATE-AI] Failed to parse ${fileType} for geometry:`, parseError);
      }

      // Analyze geometry
      const geometryMetrics = analyzeGeometry(triangles);
      const materialEstimate = estimateMaterialUsage(
        geometryMetrics.volumeEstimate,
        geometryMetrics.detectedUnit
      );

      // Build context for AI
      const context: Model3DContext = {
        filename: primaryFile.original_filename || "model.stl",
        dimensions: formatDimensions(geometryMetrics),
        triangleCount: geometryMetrics.triangleCount,
        vertexCount: geometryMetrics.vertexCount,
        volumeEstimate: formatVolume(geometryMetrics.volumeEstimate, geometryMetrics.detectedUnit),
        surfaceArea: formatSurfaceArea(geometryMetrics.surfaceArea, geometryMetrics.detectedUnit),
        complexity: getComplexityDescription(geometryMetrics),
        detectedUnit: `${geometryMetrics.detectedUnit}`,
        aspectRatio: geometryMetrics.aspectRatio,
        materialEstimate: `~${materialEstimate.grams}g at 20% infill`,
      };

      console.log(`[REGENERATE-AI] Calling 3D AI extraction for ${primaryFile.original_filename}`);
      aiMetadata = await extract3DModelMetadata(previewBuffer, context);
    } else {
      // For 2D files, try to use the existing preview or generate one
      let imageBuffer: Buffer;

      if (design.preview_path) {
        // Try to download existing preview
        const previewPath = design.preview_path.replace(/^.*\/previews\//, "");
        const { data: previewData, error: previewError } = await supabase.storage
          .from("previews")
          .download(previewPath);

        if (!previewError && previewData) {
          imageBuffer = Buffer.from(await previewData.arrayBuffer());
        } else {
          // Generate new preview from file
          let fileBuffer: Buffer;
          if (primaryFile.storage_path) {
            const { data: fileData } = await supabase.storage
              .from("designs")
              .download(primaryFile.storage_path);
            if (!fileData) {
              return NextResponse.json({ error: "Failed to download design file" }, { status: 500 });
            }
            fileBuffer = Buffer.from(await fileData.arrayBuffer());
          } else if (primaryFile.local_path) {
            fileBuffer = await fs.readFile(primaryFile.local_path);
          } else {
            return NextResponse.json({ error: "No file path available" }, { status: 400 });
          }

          const previewResult = await generatePreview(fileBuffer, fileType, primaryFile.original_filename || "design");
          if (!previewResult.buffer) {
            return NextResponse.json({ error: "Failed to generate preview for AI analysis" }, { status: 500 });
          }
          imageBuffer = previewResult.buffer;
        }
      } else {
        // No preview exists, generate from file
        let fileBuffer: Buffer;
        if (primaryFile.storage_path) {
          const { data: fileData } = await supabase.storage
            .from("designs")
            .download(primaryFile.storage_path);
          if (!fileData) {
            return NextResponse.json({ error: "Failed to download design file" }, { status: 500 });
          }
          fileBuffer = Buffer.from(await fileData.arrayBuffer());
        } else if (primaryFile.local_path) {
          fileBuffer = await fs.readFile(primaryFile.local_path);
        } else {
          return NextResponse.json({ error: "No file path available" }, { status: 400 });
        }

        const previewResult = await generatePreview(fileBuffer, fileType, primaryFile.original_filename || "design");
        if (!previewResult.buffer) {
          return NextResponse.json({ error: "Failed to generate preview for AI analysis" }, { status: 500 });
        }
        imageBuffer = previewResult.buffer;
      }

      console.log(`[REGENERATE-AI] Calling 2D AI extraction for ${primaryFile.original_filename}`);
      aiMetadata = await extractAIMetadata(imageBuffer, primaryFile.original_filename || "design", "image/png");
    }

    console.log(`[REGENERATE-AI] AI extraction complete:`, {
      title: aiMetadata.title,
      description: aiMetadata.description?.substring(0, 50) + "...",
      tagsCount: aiMetadata.tags?.length || 0,
    });

    // Update the design with new metadata
    const updateData: Record<string, unknown> = {
      title: aiMetadata.title,
      description: aiMetadata.description,
      project_type: aiMetadata.project_type,
      difficulty: aiMetadata.difficulty,
      style: aiMetadata.style,
      approx_dimensions: aiMetadata.approx_dimensions,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("designs")
      .update(updateData)
      .eq("id", designId);

    if (updateError) {
      console.error("[REGENERATE-AI] Failed to update design:", updateError);
      return NextResponse.json({ error: "Failed to update design metadata" }, { status: 500 });
    }

    // Update tags if provided
    if (aiMetadata.tags && aiMetadata.tags.length > 0) {
      // First, get or create tags
      const tagIds: string[] = [];
      for (const tagName of aiMetadata.tags) {
        const normalizedTag = tagName.toLowerCase().trim();
        if (!normalizedTag) continue;

        // Check if tag exists
        const { data: existingTag } = await supabase
          .from("tags")
          .select("id")
          .eq("name", normalizedTag)
          .single();

        if (existingTag) {
          tagIds.push(existingTag.id);
        } else {
          // Create new tag
          const { data: newTag } = await supabase
            .from("tags")
            .insert({ name: normalizedTag })
            .select("id")
            .single();
          if (newTag) {
            tagIds.push(newTag.id);
          }
        }
      }

      // Delete existing design_tags
      await supabase
        .from("design_tags")
        .delete()
        .eq("design_id", designId);

      // Insert new design_tags
      if (tagIds.length > 0) {
        await supabase
          .from("design_tags")
          .insert(tagIds.map((tagId) => ({ design_id: designId, tag_id: tagId })));
      }
    }

    // Get updated design
    const { data: updatedDesign } = await supabase
      .from("designs")
      .select(`
        *,
        design_tags (
          tags (id, name)
        )
      `)
      .eq("id", designId)
      .single();

    return NextResponse.json({
      success: true,
      message: "AI metadata regenerated successfully",
      design: updatedDesign,
      metadata: aiMetadata,
    });
  } catch (error) {
    console.error("[REGENERATE-AI] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to regenerate AI metadata" },
      { status: 500 }
    );
  }
}
