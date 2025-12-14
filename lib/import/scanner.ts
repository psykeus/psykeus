/**
 * Directory Scanner
 * Scans directories for design files and detects projects
 */

import fs from "fs/promises";
import path from "path";
import { isSupportedExtension, getFileExtension } from "@/lib/file-types";
import { detectProjects } from "@/lib/import/project-detector";
import type { ScannedFile, ScanResult, ScanError } from "@/lib/types/import";

/**
 * Scan a directory recursively for design files
 * @param dirPath - Directory path to scan
 * @param _computeHashes - Unused, reserved for future duplicate detection
 */
export async function scanDirectory(
  dirPath: string,
  _computeHashes: boolean = false
): Promise<ScanResult> {
  const files: ScannedFile[] = [];
  const errors: ScanError[] = [];
  const fileTypes: Record<string, number> = {};

  await scanDirectoryRecursive(dirPath, files, errors, fileTypes);

  // Calculate total size
  let totalSize = 0;
  for (const file of files) {
    totalSize += file.size_bytes;
  }

  // Detect projects
  const detectedProjects = detectProjects(files);

  return {
    total_files: files.length,
    file_types: fileTypes,
    total_size_bytes: totalSize,
    detected_projects: detectedProjects,
    duplicate_count: 0,
    errors,
  };
}

async function scanDirectoryRecursive(
  dirPath: string,
  files: ScannedFile[],
  errors: ScanError[],
  fileTypes: Record<string, number>
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
        await scanDirectoryRecursive(fullPath, files, errors, fileTypes);
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
