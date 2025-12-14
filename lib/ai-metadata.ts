import OpenAI from "openai";
import sharp from "sharp";
import {
  loadAIConfig,
  expandPromptTemplate,
  getAllValidTags,
  type AIConfig,
} from "./ai-config";

export interface AIMetadata {
  title: string;
  description: string;
  project_type: string | null;
  difficulty: string | null;
  categories: string[];
  style: string | null;
  tags: string[];
  approx_dimensions: string | null;
}

// Extended metadata for 3D models
export interface AI3DMetadata extends AIMetadata {
  subjects: string[];  // Animals, characters, objects depicted (e.g., "bear", "salmon", "eagle")
  print_time_estimate: string | null;
  supports_required: boolean | null;
  recommended_layer_height: string | null;
  functional_features: string[];
}

// Context for 3D model analysis (computed from geometry)
export interface Model3DContext {
  filename: string;
  dimensions: string; // e.g., "50.0 x 30.0 x 20.0 mm"
  triangleCount: number;
  vertexCount: number;
  volumeEstimate: string; // e.g., "15,000 mm^3"
  surfaceArea: string; // e.g., "8,500 mm^2"
  complexity: string; // e.g., "moderate (4,500 triangles)"
  detectedUnit: string; // e.g., "mm (high confidence)"
  aspectRatio: string; // e.g., "1:0.6:0.4"
  materialEstimate: string; // e.g., "~25g PLA at 20% infill"
}

const AI_API_KEY = process.env.AI_API_KEY;

// Logging helper for AI metadata operations
function logAI(level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const prefix = `[AI-METADATA ${timestamp}]`;
  const dataStr = data ? ` ${JSON.stringify(data)}` : "";

  if (level === "error") {
    console.error(`${prefix} ERROR: ${message}${dataStr}`);
  } else if (level === "warn") {
    console.warn(`${prefix} WARN: ${message}${dataStr}`);
  } else {
    console.log(`${prefix} INFO: ${message}${dataStr}`);
  }
}

// Cache for config to avoid repeated file reads
let configCache: AIConfig | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minute cache

async function getConfig(): Promise<AIConfig> {
  const now = Date.now();
  if (configCache && now - configCacheTime < CONFIG_CACHE_TTL) {
    return configCache;
  }
  configCache = await loadAIConfig();
  configCacheTime = now;
  return configCache;
}

// ============================================================================
// 3D MODEL EXTRACTION (uses configurable model with geometry context)
// ============================================================================

/**
 * Extract metadata from a 3D model using AI vision with geometry context.
 * Uses configurable model and prompts from ai-config.
 */
export async function extract3DModelMetadata(
  imageBuffer: Buffer,
  context: Model3DContext
): Promise<AI3DMetadata> {
  logAI("info", "Starting 3D model metadata extraction", {
    filename: context.filename,
    dimensions: context.dimensions,
    triangleCount: context.triangleCount,
    imageBufferSize: imageBuffer.length,
  });

  if (!AI_API_KEY) {
    logAI("warn", "AI_API_KEY not configured - returning basic metadata", {
      filename: context.filename,
      envKeyExists: !!process.env.AI_API_KEY,
    });
    return generate3DBasicMetadata(context);
  }

  try {
    const config = await getConfig();
    logAI("info", "Config loaded, calling OpenAI API", {
      model: config.models.model3D.model,
      filename: context.filename,
    });
    const openai = new OpenAI({ apiKey: AI_API_KEY });
    const base64Image = imageBuffer.toString("base64");

    // Build prompts from config with variable expansion
    const systemPrompt = expandPromptTemplate(
      config.prompts.model3DSystem.systemPrompt,
      config
    );

    const userPrompt = expandPromptTemplate(
      config.prompts.model3DSystem.userPromptTemplate,
      config,
      {
        filename: context.filename,
        dimensions: context.dimensions,
        volumeEstimate: context.volumeEstimate,
        surfaceArea: context.surfaceArea,
        complexity: context.complexity,
        detectedUnit: context.detectedUnit,
        aspectRatio: context.aspectRatio,
        materialEstimate: context.materialEstimate,
      }
    );

    const response = await openai.chat.completions.create({
      model: config.models.model3D.model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
                detail: config.models.model3D.detail,
              },
            },
          ],
        },
      ],
      max_completion_tokens: config.models.model3D.maxTokens,
      temperature: config.models.model3D.temperature,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logAI("error", "No response content from OpenAI", { filename: context.filename });
      throw new Error("No response from AI");
    }

    logAI("info", "OpenAI response received, parsing JSON", {
      filename: context.filename,
      responseLength: content.length,
    });

    // Parse and validate response
    const cleanedContent = content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const data = JSON.parse(cleanedContent);

    // Extract subjects (animals, characters, etc. depicted in the design)
    const subjects = Array.isArray(data.subjects)
      ? data.subjects.map((s: string) => s.toLowerCase().trim())
      : [];

    // Validate and normalize tags against controlled vocabulary from config
    // Include subjects as additional tags for searchability
    const allTags = [...(data.tags || []), ...subjects];
    const normalizedTags = normalizeTagsWithConfig(allTags, config);

    const result = {
      title: data.title || cleanFilename(context.filename),
      description: data.description || "",
      project_type: validateProjectTypeWithConfig(data.project_type, config),
      difficulty: validateDifficultyWithConfig(data.difficulty, config),
      categories: Array.isArray(data.categories) ? data.categories : [],
      style: data.style || null,
      tags: normalizedTags,
      approx_dimensions: context.dimensions, // Use actual computed dimensions
      subjects: subjects,  // Specific subjects depicted (for search)
      print_time_estimate: data.print_time_estimate || null,
      supports_required: typeof data.supports_required === "boolean" ? data.supports_required : null,
      recommended_layer_height: data.recommended_layer_height || null,
      functional_features: Array.isArray(data.functional_features) ? data.functional_features : [],
    };

    logAI("info", "3D AI metadata extraction SUCCESS", {
      filename: context.filename,
      title: result.title,
      tagsCount: result.tags.length,
      hasDescription: !!result.description,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? error.stack : undefined;
    logAI("error", "3D AI metadata extraction FAILED", {
      filename: context.filename,
      error: errorMessage,
      stack: errorDetails,
    });
    return generate3DBasicMetadata(context);
  }
}

function generate3DBasicMetadata(context: Model3DContext): AI3DMetadata {
  return {
    title: cleanFilename(context.filename),
    description: "",
    project_type: null,
    difficulty: null,
    categories: [],
    style: null,
    tags: [],
    approx_dimensions: context.dimensions,
    subjects: [],
    print_time_estimate: null,
    supports_required: null,
    recommended_layer_height: null,
    functional_features: [],
  };
}

// ============================================================================
// VALIDATION AND NORMALIZATION FUNCTIONS
// ============================================================================

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Config-based validation functions
function normalizeTagsWithConfig(tags: string[], config: AIConfig): string[] {
  const validTags = getAllValidTags(config);
  const normalized: string[] = [];

  for (const tag of tags.slice(0, 10)) {
    const normalizedTag = tag.toLowerCase().trim().replace(/\s+/g, "-");

    // Exact match
    if (validTags.has(normalizedTag)) {
      if (!normalized.includes(normalizedTag)) {
        normalized.push(normalizedTag);
      }
      continue;
    }

    // Find closest match using Levenshtein distance
    const closest = findClosestTagInSet(normalizedTag, validTags);
    if (closest && !normalized.includes(closest)) {
      normalized.push(closest);
    }
  }

  return normalized;
}

function findClosestTagInSet(input: string, validTags: Set<string>): string | null {
  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const validTag of validTags) {
    const distance = levenshteinDistance(input, validTag);
    if (distance < bestDistance && distance <= 2) {
      bestDistance = distance;
      bestMatch = validTag;
    }
  }

  return bestMatch;
}

function validateProjectTypeWithConfig(type: string | null, config: AIConfig): string | null {
  if (!type) return null;
  const normalized = type.toLowerCase();
  return config.validValues.projectTypes.includes(normalized) ? normalized : "other";
}

function validateDifficultyWithConfig(difficulty: string | null, config: AIConfig): string | null {
  if (!difficulty) return null;
  const normalized = difficulty.toLowerCase();
  return config.validValues.difficulties.includes(normalized) ? normalized : null;
}

// ============================================================================
// LEGACY 2D EXTRACTION (now uses config for prompts and settings)
// ============================================================================

/**
 * Extract metadata from a 2D design file using AI vision.
 * Analyzes the SVG/image content to determine:
 * - Title and description
 * - Project type (coaster, sign, ornament, etc.)
 * - Difficulty level
 * - Style and categories
 * - Suggested tags
 */
export async function extractAIMetadata(
  imageBuffer: Buffer,
  filename: string,
  mimeType: string = "image/svg+xml"
): Promise<AIMetadata> {
  logAI("info", "Starting 2D metadata extraction", {
    filename,
    mimeType,
    imageBufferSize: imageBuffer.length,
  });

  if (!AI_API_KEY) {
    logAI("warn", "AI_API_KEY not configured - returning basic metadata", {
      filename,
      envKeyExists: !!process.env.AI_API_KEY,
    });
    return generateBasicMetadata(filename);
  }

  try {
    const config = await getConfig();
    logAI("info", "Config loaded, preparing image for OpenAI", {
      model: config.models.legacy2D.model,
      filename,
    });
    const openai = new OpenAI({ apiKey: AI_API_KEY });

    // Convert SVG to PNG if needed (OpenAI only supports png, jpeg, gif, webp)
    let processedBuffer = imageBuffer;
    let finalMimeType = mimeType;

    if (mimeType === "image/svg+xml" || mimeType.includes("svg")) {
      try {
        logAI("info", "Converting SVG to PNG for OpenAI", { filename });
        // Convert SVG to PNG using sharp
        processedBuffer = await sharp(imageBuffer)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
        finalMimeType = "image/png";
        logAI("info", "SVG conversion successful", { filename, newSize: processedBuffer.length });
      } catch (conversionError) {
        const errorMsg = conversionError instanceof Error ? conversionError.message : String(conversionError);
        logAI("error", "SVG to PNG conversion FAILED", { filename, error: errorMsg });
        return generateBasicMetadata(filename);
      }
    }

    // Convert buffer to base64
    const base64Image = processedBuffer.toString("base64");

    // Determine file type description
    const fileTypeDescription = filename.toLowerCase().endsWith(".stl")
      ? "3D model (STL file) shown from 6 different angles"
      : "CNC/laser design";

    // Build prompts from config
    const systemPrompt = expandPromptTemplate(
      config.prompts.legacy2DSystem.systemPrompt,
      config
    );

    const userPrompt = expandPromptTemplate(
      config.prompts.legacy2DSystem.userPromptTemplate,
      config,
      {
        filename,
        fileTypeDescription,
      }
    );

    logAI("info", "Calling OpenAI API for 2D metadata", {
      filename,
      model: config.models.legacy2D.model,
      maxTokens: config.models.legacy2D.maxTokens,
    });

    const response = await openai.chat.completions.create({
      model: config.models.legacy2D.model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${finalMimeType};base64,${base64Image}`,
                detail: config.models.legacy2D.detail,
              },
            },
          ],
        },
      ],
      max_completion_tokens: config.models.legacy2D.maxTokens,
      temperature: config.models.legacy2D.temperature,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logAI("error", "No response content from OpenAI", {
        filename,
        model: config.models.legacy2D.model,
        finishReason: response.choices[0]?.finish_reason,
        usage: response.usage,
      });
      throw new Error("No response from AI");
    }

    logAI("info", "OpenAI response received, parsing JSON", {
      filename,
      responseLength: content.length,
    });

    // Clean up response (remove markdown code blocks if present)
    const cleanedContent = content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const data = JSON.parse(cleanedContent);

    const result = {
      title: data.title || cleanFilename(filename),
      description: data.description || "",
      project_type: validateProjectTypeWithConfig(data.project_type, config),
      difficulty: validateDifficultyWithConfig(data.difficulty, config),
      categories: Array.isArray(data.categories) ? data.categories : [],
      style: data.style || null,
      tags: normalizeTagsWithConfig(Array.isArray(data.tags) ? data.tags : [], config),
      approx_dimensions: data.approx_dimensions || null,
    };

    logAI("info", "2D AI metadata extraction SUCCESS", {
      filename,
      title: result.title,
      tagsCount: result.tags.length,
      hasDescription: !!result.description,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? error.stack : undefined;
    logAI("error", "2D AI metadata extraction FAILED", {
      filename,
      error: errorMessage,
      stack: errorDetails,
    });
    return generateBasicMetadata(filename);
  }
}

/**
 * Generate basic metadata from filename when AI is not available.
 */
export function generateBasicMetadata(filename: string): AIMetadata {
  return {
    title: cleanFilename(filename),
    description: "",
    project_type: null,
    difficulty: null,
    categories: [],
    style: null,
    tags: [],
    approx_dimensions: null,
  };
}

/**
 * Clean up filename to create a readable title.
 */
function cleanFilename(filename: string): string {
  // Remove extension
  const name = filename.replace(/\.[^/.]+$/, "");
  // Replace separators with spaces and capitalize
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// MULTI-FILE PROJECT EXTRACTION
// ============================================================================

/**
 * Context for multi-file project analysis
 */
export interface ProjectContext {
  allFilenames: string[];
  imageFilename?: string;
  primaryDesignFilename?: string;
  fileCount: number;
}

/**
 * Extract metadata from a multi-file project using AI vision.
 * Analyzes an image (if available) with context about all files in the project.
 * This helps AI understand the complete project rather than just one file.
 */
export async function extractProjectMetadata(
  imageBuffer: Buffer,
  context: ProjectContext,
  mimeType: string = "image/png"
): Promise<AIMetadata> {
  logAI("info", "Starting project metadata extraction", {
    fileCount: context.fileCount,
    primaryFile: context.primaryDesignFilename,
    imageBufferSize: imageBuffer.length,
  });

  if (!AI_API_KEY) {
    logAI("warn", "AI_API_KEY not configured - returning basic metadata", {
      primaryFile: context.primaryDesignFilename,
      envKeyExists: !!process.env.AI_API_KEY,
    });
    return generateProjectBasicMetadata(context);
  }

  try {
    const config = await getConfig();
    logAI("info", "Config loaded, preparing project for OpenAI", {
      model: config.models.legacy2D.model,
      fileCount: context.fileCount,
    });
    const openai = new OpenAI({ apiKey: AI_API_KEY });

    // Convert to PNG if needed
    let processedBuffer = imageBuffer;
    let finalMimeType = mimeType;

    if (mimeType === "image/svg+xml" || mimeType.includes("svg")) {
      try {
        logAI("info", "Converting SVG to PNG for project", { primaryFile: context.primaryDesignFilename });
        processedBuffer = await sharp(imageBuffer)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
        finalMimeType = "image/png";
      } catch (conversionError) {
        const errorMsg = conversionError instanceof Error ? conversionError.message : String(conversionError);
        logAI("error", "SVG to PNG conversion FAILED for project", { error: errorMsg });
        return generateProjectBasicMetadata(context);
      }
    }

    const base64Image = processedBuffer.toString("base64");

    // Build file list description for context
    const fileListDescription = context.allFilenames
      .map(f => `- ${f}`)
      .join("\n");

    // Determine project type hints from filenames
    const hasMultipleLayers = context.allFilenames.some(f =>
      /layer\s*\d+|part\s*\d+|piece\s*\d+/i.test(f)
    );
    const hasMultipleFormats = new Set(
      context.allFilenames.map(f => f.slice(f.lastIndexOf('.')).toLowerCase())
    ).size > 1;

    const projectTypeHint = hasMultipleLayers
      ? "This appears to be a multi-layer/multi-part project."
      : hasMultipleFormats
      ? "This project includes the same design in multiple file formats."
      : "";

    // Build a custom prompt for multi-file projects
    const systemPrompt = `You are an expert at analyzing CNC, laser cutting, and 3D printing design files.
You are looking at a project that contains ${context.fileCount} files.
Your task is to analyze the image and provide metadata about this design PROJECT (not just a single file).

${projectTypeHint}

The project contains these files:
${fileListDescription}

Based on the image AND the file list, provide a descriptive title that captures what this PROJECT is
(e.g., "Layered Sunflower Wall Art" not "Layer 1"). Consider all the files together.`;

    const userPrompt = `Analyze this design project and provide metadata in JSON format:
{
  "title": "A descriptive title for the entire project (not just one file)",
  "description": "A description of what this project creates, mentioning it has ${context.fileCount} files if relevant",
  "project_type": "Type of project (art, ornament, sign, holder, etc.)",
  "difficulty": "easy, medium, or hard",
  "categories": ["Categories"],
  "style": "Design style",
  "tags": ["Relevant tags"],
  "approx_dimensions": "Estimated dimensions if visible"
}

Remember: This is a MULTI-FILE PROJECT. The title should describe the complete project, not just one layer or component.`;

    const response = await openai.chat.completions.create({
      model: config.models.legacy2D.model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${finalMimeType};base64,${base64Image}`,
                detail: config.models.legacy2D.detail,
              },
            },
          ],
        },
      ],
      max_completion_tokens: config.models.legacy2D.maxTokens,
      temperature: config.models.legacy2D.temperature,
    });

    logAI("info", "Calling OpenAI API for project metadata", { fileCount: context.fileCount });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logAI("error", "No response content from OpenAI for project", { primaryFile: context.primaryDesignFilename });
      throw new Error("No response from AI");
    }

    logAI("info", "OpenAI response received for project, parsing JSON", {
      primaryFile: context.primaryDesignFilename,
      responseLength: content.length,
    });

    const cleanedContent = content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const data = JSON.parse(cleanedContent);

    const result = {
      title: data.title || inferProjectTitle(context),
      description: data.description || "",
      project_type: validateProjectTypeWithConfig(data.project_type, config),
      difficulty: validateDifficultyWithConfig(data.difficulty, config),
      categories: Array.isArray(data.categories) ? data.categories : [],
      style: data.style || null,
      tags: normalizeTagsWithConfig(Array.isArray(data.tags) ? data.tags : [], config),
      approx_dimensions: data.approx_dimensions || null,
    };

    logAI("info", "Project AI metadata extraction SUCCESS", {
      fileCount: context.fileCount,
      title: result.title,
      tagsCount: result.tags.length,
      hasDescription: !!result.description,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? error.stack : undefined;
    logAI("error", "Project AI metadata extraction FAILED", {
      primaryFile: context.primaryDesignFilename,
      error: errorMessage,
      stack: errorDetails,
    });
    return generateProjectBasicMetadata(context);
  }
}

/**
 * Generate basic metadata from project context when AI is not available.
 */
function generateProjectBasicMetadata(context: ProjectContext): AIMetadata {
  return {
    title: inferProjectTitle(context),
    description: "",
    project_type: null,
    difficulty: null,
    categories: [],
    style: null,
    tags: [],
    approx_dimensions: null,
  };
}

/**
 * Infer a project title from filenames.
 * Tries to find common patterns or meaningful names.
 */
function inferProjectTitle(context: ProjectContext): string {
  const filenames = context.allFilenames.map(f => f.replace(/\.[^/.]+$/, ""));

  // If there's a file that looks like a project name (not layer/part), use it
  const projectNameFile = filenames.find(f =>
    !/^(layer|part|piece|component)\s*\d+$/i.test(f) &&
    !/^\d+$/.test(f)
  );

  if (projectNameFile) {
    return projectNameFile
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // Try to find common prefix among filenames
  if (filenames.length > 1) {
    const sorted = filenames.sort();
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    let commonPrefix = "";

    for (let i = 0; i < Math.min(first.length, last.length); i++) {
      if (first[i] === last[i]) {
        commonPrefix += first[i];
      } else {
        break;
      }
    }

    // Clean up and use if meaningful
    commonPrefix = commonPrefix.replace(/[-_\s]+$/, "").trim();
    if (commonPrefix.length > 2) {
      return commonPrefix
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
    }
  }

  // Fallback: use the primary design filename
  if (context.primaryDesignFilename) {
    return cleanFilename(context.primaryDesignFilename);
  }

  return "Multi-File Project";
}
