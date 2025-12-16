/**
 * Supported file types for the CNC Design Library
 */

/**
 * Internal helper to normalize filename to lowercase extension
 */
function _getExt(filename: string): string {
  return filename.toLowerCase().slice(filename.lastIndexOf('.'));
}

// Design file extensions that can be uploaded
export const DESIGN_EXTENSIONS = [
  '.svg',
  '.dxf',
  '.dwg',
  '.ai',
  '.eps',
  '.pdf',
  '.cdr',
  '.stl',
  '.obj',
  '.gltf',
  '.glb',
  '.3mf',
  '.gcode',
  '.nc',
  '.ngc',
  '.tap',
] as const;

// Preview/reference image extensions (can be included in projects)
export const IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
] as const;

// All supported extensions for upload (design files + images)
export const ALL_EXTENSIONS = [...DESIGN_EXTENSIONS, ...IMAGE_EXTENSIONS] as const;

// Legacy alias for backwards compatibility
export const PREVIEW_EXTENSIONS = IMAGE_EXTENSIONS;

// MIME types for design files
export const DESIGN_MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.dxf': 'application/dxf',
  '.dwg': 'application/acad',
  '.ai': 'application/postscript',
  '.eps': 'application/postscript',
  '.pdf': 'application/pdf',
  '.cdr': 'application/vnd.corel-draw',
  '.stl': 'model/stl',
  '.obj': 'model/obj',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.3mf': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
  '.gcode': 'text/x-gcode',
  '.nc': 'text/x-gcode',
  '.ngc': 'text/x-gcode',
  '.tap': 'text/x-gcode',
};

// MIME types for images
export const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

// Legacy alias
export const PREVIEW_MIME_TYPES = IMAGE_MIME_TYPES;

// Accept string for file inputs
export const DESIGN_ACCEPT = DESIGN_EXTENSIONS.map(ext => {
  const mime = DESIGN_MIME_TYPES[ext];
  return mime ? `${mime},${ext}` : ext;
}).join(',');

// File type info for display
export const FILE_TYPE_INFO = [
  { ext: '.svg', name: 'SVG', description: 'Scalable Vector Graphics', previewSupport: true },
  { ext: '.dxf', name: 'DXF', description: 'AutoCAD Drawing Exchange Format', previewSupport: true },
  { ext: '.dwg', name: 'DWG', description: 'AutoCAD Drawing', previewSupport: true },
  { ext: '.ai', name: 'AI', description: 'Adobe Illustrator', previewSupport: true },
  { ext: '.eps', name: 'EPS', description: 'Encapsulated PostScript', previewSupport: true },
  { ext: '.pdf', name: 'PDF', description: 'Portable Document Format', previewSupport: true },
  { ext: '.cdr', name: 'CDR', description: 'CorelDRAW', previewSupport: false },
  { ext: '.stl', name: 'STL', description: '3D Stereolithography', previewSupport: true },
  { ext: '.obj', name: 'OBJ', description: 'Wavefront 3D Object', previewSupport: true },
  { ext: '.gltf', name: 'GLTF', description: 'GL Transmission Format', previewSupport: true },
  { ext: '.glb', name: 'GLB', description: 'GL Transmission Format (Binary)', previewSupport: true },
  { ext: '.3mf', name: '3MF', description: '3D Manufacturing Format', previewSupport: true },
  { ext: '.gcode', name: 'G-code', description: 'CNC/3D Printer G-code', previewSupport: true },
  { ext: '.nc', name: 'NC', description: 'Numerical Control G-code', previewSupport: true },
  { ext: '.ngc', name: 'NGC', description: 'Numerical G-code', previewSupport: true },
  { ext: '.tap', name: 'TAP', description: 'CNC Tape File', previewSupport: true },
] as const;

/**
 * Check if a file extension is supported (design or image)
 */
export function isSupportedExtension(filename: string): boolean {
  const ext = _getExt(filename);
  return (
    DESIGN_EXTENSIONS.includes(ext as typeof DESIGN_EXTENSIONS[number]) ||
    IMAGE_EXTENSIONS.includes(ext as typeof IMAGE_EXTENSIONS[number])
  );
}

/**
 * Check if a file is an image
 */
export function isImageFile(filename: string): boolean {
  const ext = _getExt(filename);
  return IMAGE_EXTENSIONS.includes(ext as typeof IMAGE_EXTENSIONS[number]);
}

/**
 * Check if a file is a design file (not an image)
 */
export function isDesignFile(filename: string): boolean {
  const ext = _getExt(filename);
  return DESIGN_EXTENSIONS.includes(ext as typeof DESIGN_EXTENSIONS[number]);
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return _getExt(filename);
}

/**
 * Generate a URL-friendly slug from a title.
 * Strict alphanumeric only (a-z, 0-9), truncated to 100 chars.
 * Use for: file-based slugs where stricter rules apply.
 * @see slugify in utils.ts for general purpose slugification
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

/**
 * 3D file extensions that support interactive viewing
 */
export const THREE_D_EXTENSIONS = ['.stl', '.obj', '.gltf', '.glb', '.3mf'] as const;

/**
 * Check if a file extension is a 3D format
 */
export function is3DFormat(filename: string): boolean {
  const ext = _getExt(filename);
  return THREE_D_EXTENSIONS.includes(ext as typeof THREE_D_EXTENSIONS[number]);
}

/**
 * Get the 3D model type from filename
 */
export function get3DModelType(filename: string): 'stl' | 'obj' | 'gltf' | 'glb' | '3mf' | null {
  const ext = _getExt(filename);
  if (ext === '.stl') return 'stl';
  if (ext === '.obj') return 'obj';
  if (ext === '.gltf') return 'gltf';
  if (ext === '.glb') return 'glb';
  if (ext === '.3mf') return '3mf';
  return null;
}

/**
 * G-code file extensions for CNC toolpath preview
 */
export const GCODE_EXTENSIONS = ['.gcode', '.nc', '.ngc', '.tap'] as const;

/**
 * Check if a file is a G-code file
 */
export function isGcodeFile(filename: string): boolean {
  const ext = _getExt(filename);
  return GCODE_EXTENSIONS.includes(ext as typeof GCODE_EXTENSIONS[number]);
}

// =============================================================================
// File Priority Constants
// =============================================================================

/**
 * Priority order for selecting the primary design file
 * Used when grouping multiple files into a single design
 * Design files (SVG, STL, etc.) should be primary, not preview images
 */
export const PRIMARY_FILE_PRIORITY = [
  '.svg',
  '.stl',
  '.obj',
  '.gltf',
  '.glb',
  '.3mf',
  '.dxf',
  '.dwg',
  '.ai',
  '.eps',
  '.pdf',
  '.gcode',
  '.nc',
  '.ngc',
  '.tap',
] as const;

/**
 * Priority order for selecting preview source file
 * Images first since they're already rendered, then design files
 */
export const PREVIEW_FILE_PRIORITY = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
  '.stl',
  '.obj',
  '.gltf',
  '.glb',
  '.3mf',
  '.dxf',
  '.dwg',
  '.ai',
  '.eps',
  '.pdf',
  '.gcode',
  '.nc',
  '.ngc',
  '.tap',
] as const;

// =============================================================================
// MIME Type Helpers
// =============================================================================

/**
 * Combined MIME types for all supported file types
 */
export const ALL_MIME_TYPES: Record<string, string> = {
  ...DESIGN_MIME_TYPES,
  ...IMAGE_MIME_TYPES,
};

/**
 * Get MIME type for a file extension
 * @param ext - File extension (with or without leading dot)
 * @returns MIME type string or 'application/octet-stream' if unknown
 */
export function getMimeType(ext: string): string {
  const normalizedExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return ALL_MIME_TYPES[normalizedExt] || 'application/octet-stream';
}

// =============================================================================
// File Sorting Utilities
// =============================================================================

/**
 * Generic file object interface for sorting
 */
export interface SortableFile {
  name: string;
  extension: string;
}

/**
 * Sort files by priority list with special handling for main/primary named files
 *
 * Priority order:
 * 1. Files named main.*, primary.*, or preview.* get highest priority
 * 2. Then sorted by position in the priority list
 * 3. Files not in priority list go to the end, sorted alphabetically
 *
 * @param files - Array of files to sort
 * @param priorityList - Ordered list of extensions (e.g., PRIMARY_FILE_PRIORITY)
 * @returns New sorted array (original not mutated)
 */
export function sortFilesByPriority<T extends SortableFile>(
  files: T[],
  priorityList: readonly string[]
): T[] {
  return [...files].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    // main.*, primary.*, or preview.* files get highest priority
    const aIsMain =
      aName.startsWith('main.') ||
      aName.startsWith('primary.') ||
      aName.startsWith('preview.');
    const bIsMain =
      bName.startsWith('main.') ||
      bName.startsWith('primary.') ||
      bName.startsWith('preview.');

    if (aIsMain && !bIsMain) return -1;
    if (!aIsMain && bIsMain) return 1;

    // Then by file type priority
    const aExt = a.extension.toLowerCase();
    const bExt = b.extension.toLowerCase();
    const aPriority = priorityList.indexOf(aExt as typeof priorityList[number]);
    const bPriority = priorityList.indexOf(bExt as typeof priorityList[number]);

    if (aPriority !== bPriority) {
      // -1 means not in list, put at end (999)
      return (aPriority === -1 ? 999 : aPriority) - (bPriority === -1 ? 999 : bPriority);
    }

    // Finally alphabetical
    return aName.localeCompare(bName);
  });
}
