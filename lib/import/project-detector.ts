/**
 * Project Detection Algorithm
 * Automatically groups related files into projects based on:
 * - Folder structure
 * - Filename patterns (variants, prefixes, layer numbering)
 * - Manifest files
 */

import {
  isSupportedExtension,
  getFileExtension,
  PRIMARY_FILE_PRIORITY,
} from "@/lib/file-types";
import type {
  DetectedProjectPreview,
  ScannedFile,
  DetectionReason,
  ProjectRole,
} from "@/lib/types/import";

interface FileGroup {
  id: string;
  name: string;
  files: ScannedFile[];
  reason: DetectionReason;
  confidence: number;
}

/**
 * Detect projects from a list of scanned files
 */
export function detectProjects(files: ScannedFile[]): DetectedProjectPreview[] {
  const projects: DetectedProjectPreview[] = [];
  const assignedFiles = new Set<string>();

  // Filter to only supported files
  const supportedFiles = files.filter((f) => isSupportedExtension(f.filename));

  // Strategy 1: Manifest files (highest confidence)
  const manifestProjects = detectByManifest(supportedFiles, assignedFiles);
  projects.push(...manifestProjects);

  // Strategy 2: Cross-folder matching (files organized by type in separate folders)
  // This handles cases like: SVG/Design1.svg, DXF/Design1.dxf, PNG/Design1.png
  const crossFolderProjects = detectByCrossFolder(supportedFiles, assignedFiles);
  projects.push(...crossFolderProjects);

  // Strategy 3: Folder grouping (high confidence)
  const folderProjects = detectByFolder(supportedFiles, assignedFiles);
  projects.push(...folderProjects);

  // Strategy 4: Filename variants (same base name, different extension)
  const variantProjects = detectByVariants(supportedFiles, assignedFiles);
  projects.push(...variantProjects);

  // Strategy 5: Common prefix patterns
  const prefixProjects = detectByPrefix(supportedFiles, assignedFiles);
  projects.push(...prefixProjects);

  // Strategy 6: Layer/part numbering
  const layerProjects = detectByLayers(supportedFiles, assignedFiles);
  projects.push(...layerProjects);

  // Remaining unassigned files become individual projects
  const remainingFiles = supportedFiles.filter((f) => !assignedFiles.has(f.path));
  for (const file of remainingFiles) {
    const baseName = getBaseName(file.filename);
    projects.push({
      inferred_name: formatProjectName(baseName),
      files: [file],
      detection_reason: "folder", // Single file treated as folder-based
      confidence: 1.0,
      primary_file: file,
    });
  }

  // Select primary file for each project
  return projects.map((project) => ({
    ...project,
    primary_file: selectPrimaryFile(project.files),
  }));
}

/**
 * Detect projects by manifest files (project.json, readme.txt, etc.)
 */
function detectByManifest(
  files: ScannedFile[],
  assigned: Set<string>
): DetectedProjectPreview[] {
  const projects: DetectedProjectPreview[] = [];
  const manifestPatterns = [
    /^project\.json$/i,
    /^manifest\.json$/i,
    /^readme\.txt$/i,
    /^readme\.md$/i,
    /^info\.txt$/i,
  ];

  // Find manifest files
  const manifestFiles = files.filter((f) =>
    manifestPatterns.some((p) => p.test(f.filename))
  );

  for (const manifest of manifestFiles) {
    const folder = getFolder(manifest.path);
    const folderFiles = files.filter(
      (f) => getFolder(f.path) === folder && !assigned.has(f.path)
    );

    if (folderFiles.length > 1) {
      // Mark all files as assigned
      folderFiles.forEach((f) => assigned.add(f.path));

      // Infer project name from folder or manifest
      const name = folder.split("/").pop() || "Project";

      projects.push({
        inferred_name: formatProjectName(name),
        files: folderFiles.filter((f) => isSupportedExtension(f.filename)),
        detection_reason: "manifest",
        confidence: 1.0,
        primary_file: null,
      });
    }
  }

  return projects;
}

/**
 * Detect projects by cross-folder matching
 * Handles cases where files are organized by type in sibling folders:
 * e.g., SVG/Design1.svg, DXF/Design1.dxf, PNG/Design1.png
 * These should all be grouped as "Design 1" project
 */
function detectByCrossFolder(
  files: ScannedFile[],
  assigned: Set<string>
): DetectedProjectPreview[] {
  const projects: DetectedProjectPreview[] = [];

  // Group files by their parent's parent directory (grandparent)
  // This helps identify sibling folders organized by file type
  const grandparentMap = new Map<string, ScannedFile[]>();

  for (const file of files) {
    if (assigned.has(file.path)) continue;

    const folder = getFolder(file.path);
    const grandparent = getFolder(folder);

    if (!grandparentMap.has(grandparent)) {
      grandparentMap.set(grandparent, []);
    }
    grandparentMap.get(grandparent)!.push(file);
  }

  // For each grandparent directory, check if its children are organized by file type
  for (const [grandparent, grandparentFiles] of grandparentMap) {
    // Skip if too few files
    if (grandparentFiles.length < 4) continue;

    // Get unique parent folders (the type-organized folders)
    const parentFolders = new Set(grandparentFiles.map((f) => getFolder(f.path)));

    // Need at least 2 different parent folders to be a cross-folder structure
    if (parentFolders.size < 2) continue;

    // Check if folders seem to be organized by file type
    // (folder names often contain type hints like "SVG", "DXF", "PNG", etc.)
    const typeHints = ["svg", "dxf", "pdf", "png", "jpg", "jpeg", "ai", "eps", "stl", "obj"];
    const foldersWithTypeHints = [...parentFolders].filter((folder) => {
      const folderName = folder.split("/").pop()?.toLowerCase() || "";
      return typeHints.some((hint) => folderName.includes(hint));
    });

    // If at least 2 folders have type hints, or all folders have many files with same extensions
    const isTypeOrganized = foldersWithTypeHints.length >= 2 || checkUniformExtensions(grandparentFiles, parentFolders);

    if (!isTypeOrganized) continue;

    // Group files by base name across all parent folders
    const baseNameGroups = new Map<string, ScannedFile[]>();

    for (const file of grandparentFiles) {
      if (assigned.has(file.path)) continue;

      const baseName = getBaseName(file.filename).toLowerCase();
      if (!baseNameGroups.has(baseName)) {
        baseNameGroups.set(baseName, []);
      }
      baseNameGroups.get(baseName)!.push(file);
    }

    // Create projects for base names that have files in multiple folders
    for (const [baseName, groupFiles] of baseNameGroups) {
      // Need files from at least 2 different folders
      const foldersRepresented = new Set(groupFiles.map((f) => getFolder(f.path)));
      if (foldersRepresented.size < 2) continue;

      // All files in this group become a project
      groupFiles.forEach((f) => assigned.add(f.path));

      // Use the original case from the first file for the project name
      const originalBaseName = getBaseName(groupFiles[0].filename);

      projects.push({
        inferred_name: formatProjectName(originalBaseName),
        files: groupFiles,
        detection_reason: "cross-folder",
        confidence: 0.95,
        primary_file: null,
      });
    }
  }

  return projects;
}

/**
 * Check if files in parent folders have uniform extensions within each folder
 * This indicates a type-organized structure
 */
function checkUniformExtensions(files: ScannedFile[], parentFolders: Set<string>): boolean {
  let uniformFolders = 0;

  for (const folder of parentFolders) {
    const folderFiles = files.filter((f) => getFolder(f.path) === folder);
    if (folderFiles.length < 2) continue;

    // Check if all files in this folder have the same extension
    const extensions = new Set(folderFiles.map((f) => getFileExtension(f.filename).toLowerCase()));
    if (extensions.size === 1) {
      uniformFolders++;
    }
  }

  // If at least 2 folders have uniform extensions, it's likely type-organized
  return uniformFolders >= 2;
}

/**
 * Detect projects by folder structure
 * Files in the same folder (with multiple design files) = same project
 */
function detectByFolder(
  files: ScannedFile[],
  assigned: Set<string>
): DetectedProjectPreview[] {
  const projects: DetectedProjectPreview[] = [];

  // Group files by folder
  const folderMap = new Map<string, ScannedFile[]>();
  for (const file of files) {
    if (assigned.has(file.path)) continue;

    const folder = getFolder(file.path);
    if (!folderMap.has(folder)) {
      folderMap.set(folder, []);
    }
    folderMap.get(folder)!.push(file);
  }

  // Create projects for folders with multiple files
  for (const [folder, folderFiles] of folderMap) {
    if (folderFiles.length >= 2) {
      // Check if files seem related (not just random files in same folder)
      const baseNames = new Set(folderFiles.map((f) => getBaseName(f.filename)));

      // Calculate average files per unique base name
      // If avg >= 3, files are likely variants of fewer projects (e.g., Design.svg + Design.dxf + Design.pdf)
      // If avg < 3, files are likely separate projects (e.g., 50 STL+JPG pairs = avg 2)
      const avgFilesPerBaseName = folderFiles.length / baseNames.size;
      const shouldGroup =
        avgFilesPerBaseName >= 3 ||
        folderFiles.length <= 5;

      if (shouldGroup) {
        folderFiles.forEach((f) => assigned.add(f.path));

        const name = folder.split("/").filter(Boolean).pop() || "Project";
        projects.push({
          inferred_name: formatProjectName(name),
          files: folderFiles,
          detection_reason: "folder",
          confidence: 0.9,
          primary_file: null,
        });
      }
    }
  }

  return projects;
}

/**
 * Detect projects by filename variants
 * Same base name with different extensions = format variants
 */
function detectByVariants(
  files: ScannedFile[],
  assigned: Set<string>
): DetectedProjectPreview[] {
  const projects: DetectedProjectPreview[] = [];

  // Group by base name (without extension)
  const baseNameMap = new Map<string, ScannedFile[]>();
  for (const file of files) {
    if (assigned.has(file.path)) continue;

    const baseName = getBaseName(file.filename);
    const key = `${getFolder(file.path)}/${baseName}`;

    if (!baseNameMap.has(key)) {
      baseNameMap.set(key, []);
    }
    baseNameMap.get(key)!.push(file);
  }

  // Create projects for files with same base name but different extensions
  for (const [key, variantFiles] of baseNameMap) {
    if (variantFiles.length >= 2) {
      // Check they have different extensions
      const extensions = new Set(variantFiles.map((f) => getFileExtension(f.filename)));
      if (extensions.size >= 2) {
        variantFiles.forEach((f) => assigned.add(f.path));

        const baseName = getBaseName(variantFiles[0].filename);
        projects.push({
          inferred_name: formatProjectName(baseName),
          files: variantFiles,
          detection_reason: "variant",
          confidence: 0.95,
          primary_file: null,
        });
      }
    }
  }

  return projects;
}

/**
 * Detect projects by common prefix patterns
 * e.g., solar-panel-base.svg, solar-panel-cover.svg
 */
function detectByPrefix(
  files: ScannedFile[],
  assigned: Set<string>
): DetectedProjectPreview[] {
  const projects: DetectedProjectPreview[] = [];
  const unassignedFiles = files.filter((f) => !assigned.has(f.path));

  // Group by folder first
  const folderMap = new Map<string, ScannedFile[]>();
  for (const file of unassignedFiles) {
    const folder = getFolder(file.path);
    if (!folderMap.has(folder)) {
      folderMap.set(folder, []);
    }
    folderMap.get(folder)!.push(file);
  }

  for (const [, folderFiles] of folderMap) {
    if (folderFiles.length < 2) continue;

    // Find common prefixes
    const prefixGroups = findCommonPrefixes(folderFiles);

    for (const group of prefixGroups) {
      if (group.files.length >= 2) {
        group.files.forEach((f) => assigned.add(f.path));

        projects.push({
          inferred_name: formatProjectName(group.prefix),
          files: group.files,
          detection_reason: "prefix",
          confidence: 0.7,
          primary_file: null,
        });
      }
    }
  }

  return projects;
}

/**
 * Detect projects by layer/part numbering
 * e.g., layer-1.svg, layer-2.svg, layer-3.svg
 */
function detectByLayers(
  files: ScannedFile[],
  assigned: Set<string>
): DetectedProjectPreview[] {
  const projects: DetectedProjectPreview[] = [];
  const unassignedFiles = files.filter((f) => !assigned.has(f.path));

  // Common layer/part patterns
  const layerPatterns = [
    /^(.+?)[-_]?(\d+)$/i, // name-1, name_2, name3
    /^(.+?)[-_]?part[-_]?(\d+)$/i, // name-part-1, name_part_2
    /^(.+?)[-_]?layer[-_]?(\d+)$/i, // name-layer-1
    /^(.+?)[-_]?([a-z])$/i, // name-a, name-b
  ];

  // Group by folder
  const folderMap = new Map<string, ScannedFile[]>();
  for (const file of unassignedFiles) {
    const folder = getFolder(file.path);
    if (!folderMap.has(folder)) {
      folderMap.set(folder, []);
    }
    folderMap.get(folder)!.push(file);
  }

  for (const [, folderFiles] of folderMap) {
    // Try each pattern
    for (const pattern of layerPatterns) {
      const groups = new Map<string, ScannedFile[]>();

      for (const file of folderFiles) {
        if (assigned.has(file.path)) continue;

        const baseName = getBaseName(file.filename);
        const match = baseName.match(pattern);

        if (match) {
          const prefix = match[1];
          if (!groups.has(prefix)) {
            groups.set(prefix, []);
          }
          groups.get(prefix)!.push(file);
        }
      }

      // Create projects for groups with 2+ files
      for (const [prefix, groupFiles] of groups) {
        if (groupFiles.length >= 2) {
          groupFiles.forEach((f) => assigned.add(f.path));

          projects.push({
            inferred_name: formatProjectName(prefix),
            files: groupFiles,
            detection_reason: "layer",
            confidence: 0.85,
            primary_file: null,
          });
        }
      }
    }
  }

  return projects;
}

/**
 * Select the primary file from a project's files
 */
export function selectPrimaryFile(files: ScannedFile[]): ScannedFile | null {
  if (files.length === 0) return null;
  if (files.length === 1) return files[0];

  // Check for explicit "main" or "primary" naming
  const mainFile = files.find((f) => {
    const baseName = getBaseName(f.filename).toLowerCase();
    return baseName === "main" || baseName === "primary" || baseName.endsWith("-main");
  });
  if (mainFile) return mainFile;

  // Sort by file type priority
  const sorted = [...files].sort((a, b) => {
    const extA = getFileExtension(a.filename).toLowerCase();
    const extB = getFileExtension(b.filename).toLowerCase();

    // Cast to the tuple element type for indexOf - returns -1 if not found
    const priorityA = PRIMARY_FILE_PRIORITY.indexOf(extA as typeof PRIMARY_FILE_PRIORITY[number]);
    const priorityB = PRIMARY_FILE_PRIORITY.indexOf(extB as typeof PRIMARY_FILE_PRIORITY[number]);

    // -1 means not in priority list, put at end
    const pA = priorityA === -1 ? 999 : priorityA;
    const pB = priorityB === -1 ? 999 : priorityB;

    return pA - pB;
  });

  return sorted[0];
}

/**
 * Determine the role of a file within a project
 */
export function determineFileRole(
  file: ScannedFile,
  primaryFile: ScannedFile | null,
  allFiles: ScannedFile[]
): ProjectRole {
  if (!primaryFile || file.path === primaryFile.path) {
    return "primary";
  }

  const fileBase = getBaseName(file.filename);
  const primaryBase = getBaseName(primaryFile.filename);

  // Same base name = variant (different format of same design)
  if (fileBase.toLowerCase() === primaryBase.toLowerCase()) {
    return "variant";
  }

  // Different base name = component (part of project)
  return "component";
}

// ============================================================================
// Helper Functions
// ============================================================================

function getFolder(path: string): string {
  const parts = path.split("/");
  parts.pop(); // Remove filename
  return parts.join("/") || "/";
}

function getBaseName(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

function formatProjectName(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface PrefixGroup {
  prefix: string;
  files: ScannedFile[];
}

function findCommonPrefixes(files: ScannedFile[]): PrefixGroup[] {
  const groups: PrefixGroup[] = [];
  const used = new Set<string>();

  // Sort by filename to help find common prefixes
  const sorted = [...files].sort((a, b) => a.filename.localeCompare(b.filename));

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].path)) continue;

    const baseNameA = getBaseName(sorted[i].filename);
    const matchingFiles: ScannedFile[] = [sorted[i]];

    // Look for files with common prefix (at least 5 chars)
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(sorted[j].path)) continue;

      const baseNameB = getBaseName(sorted[j].filename);
      const commonPrefix = findLongestCommonPrefix(baseNameA, baseNameB);

      // Need at least 5 chars and prefix should be a word boundary
      if (
        commonPrefix.length >= 5 &&
        (commonPrefix.endsWith("-") ||
          commonPrefix.endsWith("_") ||
          commonPrefix.length === baseNameA.length ||
          baseNameA[commonPrefix.length]?.match(/[-_]/))
      ) {
        matchingFiles.push(sorted[j]);
      }
    }

    if (matchingFiles.length >= 2) {
      const prefix = findLongestCommonPrefix(
        ...matchingFiles.map((f) => getBaseName(f.filename))
      ).replace(/[-_]+$/, "");

      if (prefix.length >= 3) {
        matchingFiles.forEach((f) => used.add(f.path));
        groups.push({ prefix, files: matchingFiles });
      }
    }
  }

  return groups;
}

function findLongestCommonPrefix(...strings: string[]): string {
  if (strings.length === 0) return "";
  if (strings.length === 1) return strings[0];

  let prefix = "";
  const first = strings[0];

  for (let i = 0; i < first.length; i++) {
    const char = first[i];
    if (strings.every((s) => s[i] === char)) {
      prefix += char;
    } else {
      break;
    }
  }

  return prefix;
}
