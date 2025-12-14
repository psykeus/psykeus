import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupportedExtension, getFileExtension } from "@/lib/file-types";
import { detectProjects } from "@/lib/import/project-detector";
import crypto from "crypto";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import type { ScannedFile, ScanResult, ScanError } from "@/lib/types/import";

export const runtime = "nodejs";

/**
 * POST /api/admin/import/scan
 * Scan a directory and detect projects
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { source_path, compute_hashes = false } = body;

    if (!source_path) {
      return NextResponse.json(
        { error: "source_path is required" },
        { status: 400 }
      );
    }

    // Validate path exists and is a directory
    try {
      const stat = await fs.stat(source_path);
      if (!stat.isDirectory()) {
        return NextResponse.json(
          { error: "Path is not a directory" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Directory not found or not accessible" },
        { status: 400 }
      );
    }

    // Scan directory recursively
    const files: ScannedFile[] = [];
    const errors: ScanError[] = [];
    const fileTypes: Record<string, number> = {};
    let totalSize = 0;

    await scanDirectory(source_path, files, errors, fileTypes, compute_hashes);

    // Calculate total size
    for (const file of files) {
      totalSize += file.size_bytes;
    }

    // Check for duplicates against existing designs
    let duplicateCount = 0;
    if (compute_hashes) {
      const existingHashes = await loadExistingHashes();
      for (const file of files) {
        if (file.content_hash && existingHashes.has(file.content_hash)) {
          file.is_duplicate = true;
          file.duplicate_of = existingHashes.get(file.content_hash);
          duplicateCount++;
        }
      }
    }

    // Detect projects
    const detectedProjects = detectProjects(files);

    const result: ScanResult = {
      total_files: files.length,
      file_types: fileTypes,
      total_size_bytes: totalSize,
      detected_projects: detectedProjects,
      duplicate_count: duplicateCount,
      errors,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json(
      { error: "Failed to scan directory" },
      { status: 500 }
    );
  }
}

async function scanDirectory(
  dirPath: string,
  files: ScannedFile[],
  errors: ScanError[],
  fileTypes: Record<string, number>,
  computeHashes: boolean
): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and common non-design folders
        if (
          entry.name.startsWith(".") ||
          entry.name === "node_modules" ||
          entry.name === "__MACOSX"
        ) {
          continue;
        }
        await scanDirectory(fullPath, files, errors, fileTypes, computeHashes);
      } else if (entry.isFile()) {
        // Skip hidden files
        if (entry.name.startsWith(".")) continue;

        // Check if supported file type
        if (!isSupportedExtension(entry.name)) continue;

        try {
          const stat = await fs.stat(fullPath);
          const ext = getFileExtension(entry.name).toLowerCase();

          // Count file types
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;

          const file: ScannedFile = {
            path: fullPath,
            filename: entry.name,
            file_type: ext.slice(1), // Remove the dot
            size_bytes: stat.size,
          };

          // Compute hash if requested (using streaming for large files)
          if (computeHashes) {
            try {
              file.content_hash = await computeFileHash(fullPath);
            } catch (err) {
              // Skip hash computation on error
            }
          }

          files.push(file);
        } catch (err) {
          errors.push({
            path: fullPath,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }
  } catch (err) {
    errors.push({
      path: dirPath,
      error: err instanceof Error ? err.message : "Failed to read directory",
    });
  }
}

async function loadExistingHashes(): Promise<Map<string, string>> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("design_files")
    .select("content_hash, design_id")
    .eq("is_active", true)
    .not("content_hash", "is", null);

  const map = new Map<string, string>();
  for (const d of data || []) {
    if (d.content_hash) {
      map.set(d.content_hash, d.design_id);
    }
  }

  return map;
}

/**
 * Compute SHA-256 hash using streaming to handle large files efficiently
 */
function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) => reject(err));
  });
}
