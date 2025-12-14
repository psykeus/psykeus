/**
 * File validation utilities including magic byte checking
 * Prevents extension spoofing by validating actual file content
 */

// =============================================================================
// Magic Byte Signatures
// =============================================================================

/**
 * Magic byte signatures for supported file types
 * Each entry contains the byte offset and expected bytes
 */
interface MagicSignature {
  offset: number;
  bytes: number[];
  mask?: number[]; // Optional mask for partial matching
}

const MAGIC_SIGNATURES: Record<string, MagicSignature[]> = {
  // Images
  ".png": [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  ".jpg": [
    { offset: 0, bytes: [0xff, 0xd8, 0xff, 0xe0] }, // JFIF
    { offset: 0, bytes: [0xff, 0xd8, 0xff, 0xe1] }, // EXIF
    { offset: 0, bytes: [0xff, 0xd8, 0xff, 0xe2] }, // ICC
    { offset: 0, bytes: [0xff, 0xd8, 0xff, 0xee] }, // Adobe
    { offset: 0, bytes: [0xff, 0xd8, 0xff, 0xdb] }, // Raw
  ],
  ".jpeg": [], // Same as .jpg, will use .jpg signatures
  ".webp": [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }], // RIFF header (needs additional WEBP check)
  ".gif": [
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],

  // 3D Models
  ".stl": [
    { offset: 0, bytes: [0x73, 0x6f, 0x6c, 0x69, 0x64] }, // ASCII STL starts with "solid"
    // Binary STL has 80-byte header (arbitrary) followed by triangle count
    // We check for non-"solid" start which indicates binary
  ],
  ".obj": [], // Text format, no magic bytes - validated by content
  ".gltf": [], // JSON format, validated by content
  ".glb": [{ offset: 0, bytes: [0x67, 0x6c, 0x54, 0x46] }], // "glTF" magic
  ".3mf": [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }], // ZIP format (PK..)

  // Vector/CAD formats
  ".svg": [], // XML format, validated by content
  ".pdf": [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  ".dxf": [], // Text/binary format, validated by content
  ".dwg": [{ offset: 0, bytes: [0x41, 0x43, 0x31, 0x30] }], // AC10, AC15, etc.
  ".ai": [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // AI uses PDF format
  ".eps": [
    { offset: 0, bytes: [0x25, 0x21, 0x50, 0x53] }, // %!PS
    { offset: 0, bytes: [0xc5, 0xd0, 0xd3, 0xc6] }, // Binary EPS
  ],
  ".cdr": [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }], // RIFF format

  // Archives
  ".zip": [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }], // PK..
};

// Use .jpg signatures for .jpeg
MAGIC_SIGNATURES[".jpeg"] = MAGIC_SIGNATURES[".jpg"];

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Check if buffer matches any of the magic signatures
 */
function matchesMagicBytes(buffer: Buffer, signatures: MagicSignature[]): boolean {
  if (signatures.length === 0) {
    // No magic bytes defined - rely on other validation
    return true;
  }

  for (const sig of signatures) {
    if (buffer.length < sig.offset + sig.bytes.length) {
      continue;
    }

    let matches = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      const bufByte = buffer[sig.offset + i];
      const sigByte = sig.bytes[i];
      const mask = sig.mask?.[i] ?? 0xff;

      if ((bufByte & mask) !== (sigByte & mask)) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return true;
    }
  }

  return false;
}

/**
 * Validate text-based file formats by checking content structure
 */
function validateTextFormat(buffer: Buffer, extension: string): boolean {
  // Convert first portion to string for text-based checks
  const headerSize = Math.min(buffer.length, 1024);
  const header = buffer.slice(0, headerSize).toString("utf-8", 0, headerSize);

  switch (extension.toLowerCase()) {
    case ".svg":
      // SVG should contain <?xml or <svg
      return header.includes("<?xml") || header.includes("<svg");

    case ".obj":
      // OBJ files typically start with comments (#) or vertex data (v )
      return /^(#|v |vn |vt |f |g |o |s |mtllib |usemtl )/m.test(header);

    case ".gltf":
      // GLTF is JSON with specific structure
      try {
        // Check for valid JSON start and glTF markers
        const trimmed = header.trim();
        if (!trimmed.startsWith("{")) return false;
        return header.includes('"asset"') || header.includes('"scene"') || header.includes('"nodes"');
      } catch {
        return false;
      }

    case ".dxf":
      // DXF starts with section markers
      return header.includes("SECTION") || header.startsWith("0\n");

    case ".stl":
      // ASCII STL starts with "solid", binary STL doesn't
      // If it starts with "solid", verify it's actually ASCII by checking for "facet" or "endsolid"
      if (header.toLowerCase().startsWith("solid")) {
        // Could be ASCII or binary with "solid" in header
        const lowerHeader = header.toLowerCase();
        return lowerHeader.includes("facet") || lowerHeader.includes("endsolid");
      }
      // Binary STL - just verify it's not obviously something else
      return buffer.length > 84; // Minimum: 80 byte header + 4 byte triangle count

    default:
      return true;
  }
}

/**
 * Additional validation for WEBP format
 * WEBP has RIFF header followed by WEBP marker at offset 8
 */
function validateWebp(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  // Check for RIFF header
  if (!matchesMagicBytes(buffer, MAGIC_SIGNATURES[".webp"])) {
    return false;
  }

  // Check for WEBP marker at offset 8
  const webpMarker = buffer.slice(8, 12).toString("ascii");
  return webpMarker === "WEBP";
}

// =============================================================================
// Public API
// =============================================================================

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedType?: string;
}

/**
 * Validate that a file's content matches its claimed extension
 * Prevents extension spoofing attacks
 *
 * @param buffer - File content as Buffer
 * @param claimedExtension - The file extension claimed by the filename
 * @returns Validation result with error message if invalid
 */
export function validateFileContent(
  buffer: Buffer,
  claimedExtension: string
): FileValidationResult {
  const ext = claimedExtension.toLowerCase();

  // Check if we have magic byte signatures for this extension
  const signatures = MAGIC_SIGNATURES[ext];

  if (signatures === undefined) {
    // Unknown extension - let the file type filter handle it
    return { valid: true };
  }

  // Special handling for WEBP (needs additional check beyond RIFF header)
  if (ext === ".webp") {
    if (!validateWebp(buffer)) {
      return {
        valid: false,
        error: `File content does not match WEBP format`,
      };
    }
    return { valid: true, detectedType: "webp" };
  }

  // Check magic bytes
  if (signatures.length > 0 && !matchesMagicBytes(buffer, signatures)) {
    // For STL and some text formats, try text-based validation
    if ([".stl", ".svg", ".obj", ".gltf", ".dxf"].includes(ext)) {
      if (validateTextFormat(buffer, ext)) {
        return { valid: true, detectedType: ext.slice(1) };
      }
    }

    return {
      valid: false,
      error: `File content does not match ${ext.toUpperCase()} format`,
    };
  }

  // For text-based formats with no magic bytes, validate content structure
  if (signatures.length === 0) {
    if (!validateTextFormat(buffer, ext)) {
      return {
        valid: false,
        error: `File content does not appear to be valid ${ext.toUpperCase()} format`,
      };
    }
  }

  return { valid: true, detectedType: ext.slice(1) };
}

/**
 * Check if a file is potentially dangerous
 * Returns true if the file contains executable or script patterns
 */
export function isPotentiallyDangerous(buffer: Buffer): boolean {
  const headerSize = Math.min(buffer.length, 2048);
  const header = buffer.slice(0, headerSize);

  // Check for executable magic bytes
  const dangerousPatterns = [
    [0x4d, 0x5a], // MZ (Windows executable)
    [0x7f, 0x45, 0x4c, 0x46], // ELF (Linux executable)
    [0xfe, 0xed, 0xfa, 0xce], // Mach-O 32-bit
    [0xfe, 0xed, 0xfa, 0xcf], // Mach-O 64-bit
    [0xca, 0xfe, 0xba, 0xbe], // Mach-O Universal
    [0x23, 0x21], // Shebang (#!)
  ];

  for (const pattern of dangerousPatterns) {
    let matches = true;
    for (let i = 0; i < pattern.length && i < header.length; i++) {
      if (header[i] !== pattern[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return true;
    }
  }

  // Check for embedded scripts in text content
  const headerStr = header.toString("utf-8", 0, headerSize);
  const scriptPatterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /data:text\/html/i,
    /on\w+\s*=/i, // Event handlers like onclick=
  ];

  for (const pattern of scriptPatterns) {
    if (pattern.test(headerStr)) {
      return true;
    }
  }

  return false;
}

/**
 * Comprehensive file validation
 * Combines extension check, magic byte validation, and dangerous content detection
 */
export function validateUploadedFile(
  buffer: Buffer,
  filename: string,
  allowedExtensions: readonly string[]
): FileValidationResult {
  // Get extension from filename
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) {
    return { valid: false, error: "File has no extension" };
  }

  const ext = filename.slice(lastDot).toLowerCase();

  // Check if extension is allowed
  if (!allowedExtensions.includes(ext)) {
    return { valid: false, error: `File type ${ext} is not allowed` };
  }

  // Check for dangerous content
  if (isPotentiallyDangerous(buffer)) {
    return { valid: false, error: "File contains potentially dangerous content" };
  }

  // Validate file content matches claimed extension
  return validateFileContent(buffer, ext);
}
