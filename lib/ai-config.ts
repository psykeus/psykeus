/**
 * AI Configuration Management
 * Provides editable configuration for AI prompts, models, and vocabularies
 */

import fs from "fs/promises";
import path from "path";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AIModelConfig {
  name: string;
  model: string;
  maxTokens: number;
  temperature: number;
  detail: "low" | "high" | "auto";
}

export interface TagVocabulary {
  objectTypes: string[];
  functionalFeatures: string[];
  aestheticStyles: string[];
  useCases: string[];
  sizeCategories: string[];
  printConsiderations: string[];
  // Subject matter categories (for searchability)
  animals?: string[];
  natureElements?: string[];
  characters?: string[];
  themes?: string[];
}

export interface ValidValues {
  projectTypes: string[];
  difficulties: string[];
}

export interface PromptConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  enabled: boolean;
}

export interface DisplaySettings {
  showDifficulty: boolean;
  showDimensions: boolean;
  showPrintTime: boolean;
  showSupportsRequired: boolean;
  showLayerHeight: boolean;
}

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export interface FavoritesConfig {
  enabled: boolean;
  maxPerUser: number;
}

export interface CollectionsConfig {
  enabled: boolean;
  maxPerUser: number;
  maxItemsPerCollection: number;
}

export interface RelatedDesignsConfig {
  enabled: boolean;
  maxSuggestions: number;
  similarityThreshold: number; // 0-100, minimum similarity percentage
}

export interface AuditLogConfig {
  enabled: boolean;
  retentionDays: number;
}

export interface CdnConfig {
  enabled: boolean;
  provider: "cloudflare" | "cloudfront" | "generic";
  cdnUrl: string;
}

export interface NotificationsConfig {
  enabled: boolean;
  maxPerUser: number;
  retentionDays: number;
}

export interface EmailConfig {
  enabled: boolean;
  queueEmails: boolean;
}

export interface FeatureFlags {
  // User Features
  favorites: FavoritesConfig;
  collections: CollectionsConfig;
  relatedDesigns: RelatedDesignsConfig;

  // Admin Features
  scheduledPublishing: { enabled: boolean };
  bulkEdit: { enabled: boolean };
  auditLog: AuditLogConfig;

  // Analytics
  analyticsCharts: { enabled: boolean };
  popularTagsReport: { enabled: boolean };
  exportReports: { enabled: boolean };

  // Technical
  backgroundJobs: { enabled: boolean };
  cdnIntegration: CdnConfig;
  webhooks: { enabled: boolean };
  sitemapGeneration: { enabled: boolean };
  socialCards: { enabled: boolean };

  // Search
  advancedSearch: { enabled: boolean };
  tagAutocomplete: { enabled: boolean };

  // File Processing
  gcodePreview: { enabled: boolean };

  // Notifications & Email
  notifications: NotificationsConfig;
  email: EmailConfig;
  adminBroadcasts: { enabled: boolean };
}

export interface AIConfig {
  version: string;
  lastUpdated: string;

  // Model settings
  models: {
    legacy2D: AIModelConfig;
    model3D: AIModelConfig;
  };

  // Controlled vocabularies
  tagVocabulary: TagVocabulary;
  validValues: ValidValues;

  // Prompts
  prompts: {
    model3DSystem: PromptConfig;
    model3DUser: PromptConfig;
    legacy2DSystem: PromptConfig;
    legacy2DUser: PromptConfig;
  };

  // Display settings for public site
  displaySettings: DisplaySettings;

  // Feature flags for toggling functionality
  featureFlags: FeatureFlags;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_AI_CONFIG: AIConfig = {
  version: "1.0.0",
  lastUpdated: new Date().toISOString(),

  models: {
    legacy2D: {
      name: "2D Design Analysis",
      model: "gpt-5-mini",
      maxTokens: 500,
      temperature: 0.7,
      detail: "auto",
    },
    model3D: {
      name: "3D Model Analysis",
      model: "gpt-5.1-thinking",
      maxTokens: 1200,
      temperature: 0.3,
      detail: "high",
    },
  },

  tagVocabulary: {
    objectTypes: [
      "figurine", "miniature", "statue", "bust", "holder", "stand", "mount",
      "bracket", "clip", "hook", "organizer", "container", "box", "case",
      "enclosure", "cover", "cap", "knob", "handle", "wheel", "gear", "tool",
      "jig", "fixture", "adapter", "connector", "spacer", "washer",
    ],
    functionalFeatures: [
      "threaded", "snap-fit", "hinged", "interlocking", "stackable", "magnetic",
      "adjustable", "modular", "hollow", "solid", "vented", "reinforced",
      "waterproof", "flexible", "rigid",
    ],
    aestheticStyles: [
      "low-poly", "high-detail", "smooth", "textured", "organic", "geometric",
      "mechanical", "artistic", "minimal", "ornate", "realistic", "stylized",
      "cartoon", "abstract", "nature-inspired", "industrial",
    ],
    useCases: [
      "desk-organizer", "phone-stand", "cable-management", "wall-mount",
      "3d-printing", "cnc", "prototype", "replacement-part", "custom-fit",
      "home-decor", "gaming", "cosplay", "educational",
    ],
    sizeCategories: ["miniature", "small", "medium", "large", "oversized"],
    printConsiderations: [
      "no-supports", "easy-print", "multi-part", "single-piece",
      "requires-supports", "detailed-print", "quick-print",
    ],
  },

  validValues: {
    projectTypes: [
      "figurine", "holder", "mount", "enclosure", "bracket", "clip", "tool",
      "container", "art", "ornament", "mechanical", "puzzle", "jig", "model",
      "coaster", "sign", "box", "other",
    ],
    difficulties: ["easy", "medium", "hard"],
  },

  prompts: {
    model3DSystem: {
      id: "model3DSystem",
      name: "3D Model System Prompt",
      description: "System instructions for analyzing 3D models",
      enabled: true,
      systemPrompt: `You are an expert 3D printing and CNC machining analyst. You analyze 3D models and provide detailed, accurate metadata.

You will receive:
1. A multi-view image showing the model from 6 angles (Front, Right, Back, Top, Bottom, Isometric)
2. Computed geometry data including exact dimensions, volume, and complexity

Your task is to analyze BOTH the visual appearance AND the geometry data to provide comprehensive metadata.

## Response Format
Return ONLY valid JSON with these fields:

{
  "title": "Descriptive title without file extension",
  "description": "2-3 sentence description explaining what the model is, its purpose, and notable features",
  "project_type": "One of: {{projectTypes}}",
  "difficulty": "One of: {{difficulties}} (based on print complexity, supports needed, assembly)",
  "categories": ["Functional", "Decorative", "Mechanical", "Artistic", etc.],
  "style": "Design style: organic, geometric, mechanical, minimal, detailed, artistic, functional",
  "tags": ["max 10 specific tags from controlled vocabulary - see rules below"],
  "print_time_estimate": "Estimated print time range, e.g., '2-4 hours' or '30-60 minutes'",
  "supports_required": true or false,
  "recommended_layer_height": "e.g., '0.2mm' or '0.1mm for detail'",
  "functional_features": ["List specific features: mounting holes, snap fits, threads, hinges, etc."]
}

## Tag Guidelines (IMPORTANT)
Use tags ONLY from these categories:

**Object Types**: {{objectTypes}}

**Functional Features**: {{functionalFeatures}}

**Aesthetic Styles**: {{aestheticStyles}}

**Use Cases**: {{useCases}}

**Size Categories**: {{sizeCategories}}

**Print Considerations**: {{printConsiderations}}

Do NOT invent new tags. Select the most relevant tags from the vocabulary above.

## Analysis Tips
- Look at ALL 6 views to understand the complete 3D shape
- Consider overhangs and bridges when assessing difficulty
- Note mounting holes, clips, slots, or functional features
- Consider print orientation and its impact on supports
- Use the provided dimensions to assess appropriate materials (larger = stronger materials)
- Use volume/complexity to estimate print time`,
      userPromptTemplate: `Analyze this 3D model for metadata extraction.

## Filename
{{filename}}

## Computed Geometry (ACCURATE DATA - use for dimensions)
- **Exact Dimensions**: {{dimensions}}
- **Volume**: {{volumeEstimate}}
- **Surface Area**: {{surfaceArea}}
- **Complexity**: {{complexity}}
- **Detected Units**: {{detectedUnit}}
- **Aspect Ratio**: {{aspectRatio}}
- **Material Estimate**: {{materialEstimate}}

## Image Description
The image shows a 3x2 grid of 6 views:
- Row 1: Front, Right, Back views
- Row 2: Top, Bottom, Isometric views

Analyze ALL views to understand the complete 3D shape. Consider functional features like mounting holes, clips, slots, threads, or decorative elements.

Return ONLY valid JSON with your analysis.`,
    },

    model3DUser: {
      id: "model3DUser",
      name: "3D Model User Prompt",
      description: "User message template for 3D models (uses variables from geometry)",
      enabled: true,
      systemPrompt: "",
      userPromptTemplate: "",
    },

    legacy2DSystem: {
      id: "legacy2DSystem",
      name: "2D Design System Prompt",
      description: "System instructions for analyzing 2D designs (SVG, DXF, etc.)",
      enabled: true,
      systemPrompt: `You are analyzing CNC/laser cutting design files and 3D model files (STL).
Extract metadata and return valid JSON with these fields:
- title: A descriptive title (without file extension)
- description: 2-3 sentence description of the design
- project_type: One of: {{projectTypes}}
- difficulty: One of: {{difficulties}}
- categories: Array of categories
- style: Design style (mandala, geometric, floral, minimal, detailed, celtic, tribal, mechanical, organic, functional, decorative, etc.)
- tags: Array of descriptive tags (max 10)
- approx_dimensions: Estimated dimensions if visible (e.g., "4 inch diameter" or "100mm x 50mm x 30mm")

For STL/3D models, the image shows a 3x2 grid of 6 different views of the model:
- Row 1: Front, Right, Back views
- Row 2: Top, Bottom, Isometric views
Analyze ALL views to understand the complete 3D shape. Consider what the 3D printed or CNC machined object would be used for. Look for functional features like mounting holes, clips, slots, or decorative elements.

Return ONLY valid JSON, no markdown or explanation.`,
      userPromptTemplate: `Analyze this {{fileTypeDescription}}. Filename: {{filename}}`,
    },

    legacy2DUser: {
      id: "legacy2DUser",
      name: "2D Design User Prompt",
      description: "User message template for 2D designs",
      enabled: true,
      systemPrompt: "",
      userPromptTemplate: "",
    },
  },

  displaySettings: {
    showDifficulty: true,
    showDimensions: true,
    showPrintTime: true,
    showSupportsRequired: true,
    showLayerHeight: true,
  },

  featureFlags: {
    // User Features - all disabled by default
    favorites: {
      enabled: false,
      maxPerUser: 100,
    },
    collections: {
      enabled: false,
      maxPerUser: 20,
      maxItemsPerCollection: 100,
    },
    relatedDesigns: {
      enabled: false,
      maxSuggestions: 6,
      similarityThreshold: 70,
    },

    // Admin Features
    scheduledPublishing: { enabled: false },
    bulkEdit: { enabled: false },
    auditLog: {
      enabled: false,
      retentionDays: 90,
    },

    // Analytics
    analyticsCharts: { enabled: false },
    popularTagsReport: { enabled: false },
    exportReports: { enabled: false },

    // Technical
    backgroundJobs: { enabled: false },
    cdnIntegration: {
      enabled: false,
      provider: "cloudflare",
      cdnUrl: "",
    },
    webhooks: { enabled: false },
    sitemapGeneration: { enabled: false },
    socialCards: { enabled: false },

    // Search
    advancedSearch: { enabled: false },
    tagAutocomplete: { enabled: false },

    // File Processing
    gcodePreview: { enabled: false },

    // Notifications & Email
    notifications: {
      enabled: true,
      maxPerUser: 100,
      retentionDays: 30,
    },
    email: {
      enabled: true,
      queueEmails: false,
    },
    adminBroadcasts: { enabled: true },
  },
};

// ============================================================================
// CONFIGURATION LOADING/SAVING
// ============================================================================

const CONFIG_FILE_PATH = path.join(process.cwd(), "config", "ai-config.json");

/**
 * Load AI configuration from file or return defaults
 */
export async function loadAIConfig(): Promise<AIConfig> {
  try {
    const configDir = path.dirname(CONFIG_FILE_PATH);

    // Ensure config directory exists
    try {
      await fs.access(configDir);
    } catch {
      await fs.mkdir(configDir, { recursive: true });
    }

    // Try to read existing config
    const configData = await fs.readFile(CONFIG_FILE_PATH, "utf-8");
    const config = JSON.parse(configData) as AIConfig;

    // Merge with defaults to ensure all fields exist
    return mergeWithDefaults(config);
  } catch {
    // If file doesn't exist, save and return defaults
    await saveAIConfig(DEFAULT_AI_CONFIG);
    return DEFAULT_AI_CONFIG;
  }
}

/**
 * Save AI configuration to file
 */
export async function saveAIConfig(config: AIConfig): Promise<void> {
  const configDir = path.dirname(CONFIG_FILE_PATH);

  // Ensure config directory exists
  try {
    await fs.access(configDir);
  } catch {
    await fs.mkdir(configDir, { recursive: true });
  }

  // Update timestamp
  config.lastUpdated = new Date().toISOString();

  await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Merge loaded config with defaults to ensure all fields exist
 */
function mergeWithDefaults(loaded: Partial<AIConfig>): AIConfig {
  return {
    version: loaded.version || DEFAULT_AI_CONFIG.version,
    lastUpdated: loaded.lastUpdated || DEFAULT_AI_CONFIG.lastUpdated,
    models: {
      legacy2D: { ...DEFAULT_AI_CONFIG.models.legacy2D, ...loaded.models?.legacy2D },
      model3D: { ...DEFAULT_AI_CONFIG.models.model3D, ...loaded.models?.model3D },
    },
    tagVocabulary: {
      ...DEFAULT_AI_CONFIG.tagVocabulary,
      ...loaded.tagVocabulary,
    },
    validValues: {
      ...DEFAULT_AI_CONFIG.validValues,
      ...loaded.validValues,
    },
    prompts: {
      model3DSystem: { ...DEFAULT_AI_CONFIG.prompts.model3DSystem, ...loaded.prompts?.model3DSystem },
      model3DUser: { ...DEFAULT_AI_CONFIG.prompts.model3DUser, ...loaded.prompts?.model3DUser },
      legacy2DSystem: { ...DEFAULT_AI_CONFIG.prompts.legacy2DSystem, ...loaded.prompts?.legacy2DSystem },
      legacy2DUser: { ...DEFAULT_AI_CONFIG.prompts.legacy2DUser, ...loaded.prompts?.legacy2DUser },
    },
    displaySettings: {
      ...DEFAULT_AI_CONFIG.displaySettings,
      ...loaded.displaySettings,
    },
    featureFlags: {
      favorites: { ...DEFAULT_AI_CONFIG.featureFlags.favorites, ...loaded.featureFlags?.favorites },
      collections: { ...DEFAULT_AI_CONFIG.featureFlags.collections, ...loaded.featureFlags?.collections },
      relatedDesigns: { ...DEFAULT_AI_CONFIG.featureFlags.relatedDesigns, ...loaded.featureFlags?.relatedDesigns },
      scheduledPublishing: { ...DEFAULT_AI_CONFIG.featureFlags.scheduledPublishing, ...loaded.featureFlags?.scheduledPublishing },
      bulkEdit: { ...DEFAULT_AI_CONFIG.featureFlags.bulkEdit, ...loaded.featureFlags?.bulkEdit },
      auditLog: { ...DEFAULT_AI_CONFIG.featureFlags.auditLog, ...loaded.featureFlags?.auditLog },
      analyticsCharts: { ...DEFAULT_AI_CONFIG.featureFlags.analyticsCharts, ...loaded.featureFlags?.analyticsCharts },
      popularTagsReport: { ...DEFAULT_AI_CONFIG.featureFlags.popularTagsReport, ...loaded.featureFlags?.popularTagsReport },
      exportReports: { ...DEFAULT_AI_CONFIG.featureFlags.exportReports, ...loaded.featureFlags?.exportReports },
      backgroundJobs: { ...DEFAULT_AI_CONFIG.featureFlags.backgroundJobs, ...loaded.featureFlags?.backgroundJobs },
      cdnIntegration: { ...DEFAULT_AI_CONFIG.featureFlags.cdnIntegration, ...loaded.featureFlags?.cdnIntegration },
      webhooks: { ...DEFAULT_AI_CONFIG.featureFlags.webhooks, ...loaded.featureFlags?.webhooks },
      sitemapGeneration: { ...DEFAULT_AI_CONFIG.featureFlags.sitemapGeneration, ...loaded.featureFlags?.sitemapGeneration },
      socialCards: { ...DEFAULT_AI_CONFIG.featureFlags.socialCards, ...loaded.featureFlags?.socialCards },
      advancedSearch: { ...DEFAULT_AI_CONFIG.featureFlags.advancedSearch, ...loaded.featureFlags?.advancedSearch },
      tagAutocomplete: { ...DEFAULT_AI_CONFIG.featureFlags.tagAutocomplete, ...loaded.featureFlags?.tagAutocomplete },
      gcodePreview: { ...DEFAULT_AI_CONFIG.featureFlags.gcodePreview, ...loaded.featureFlags?.gcodePreview },
      notifications: { ...DEFAULT_AI_CONFIG.featureFlags.notifications, ...loaded.featureFlags?.notifications },
      email: { ...DEFAULT_AI_CONFIG.featureFlags.email, ...loaded.featureFlags?.email },
      adminBroadcasts: { ...DEFAULT_AI_CONFIG.featureFlags.adminBroadcasts, ...loaded.featureFlags?.adminBroadcasts },
    },
  };
}

// ============================================================================
// PROMPT TEMPLATING
// ============================================================================

/**
 * Expand variables in a prompt template
 */
export function expandPromptTemplate(
  template: string,
  config: AIConfig,
  variables: Record<string, string> = {}
): string {
  let result = template;

  // Replace vocabulary placeholders
  result = result.replace(/\{\{objectTypes\}\}/g, config.tagVocabulary.objectTypes.join(", "));
  result = result.replace(/\{\{functionalFeatures\}\}/g, config.tagVocabulary.functionalFeatures.join(", "));
  result = result.replace(/\{\{aestheticStyles\}\}/g, config.tagVocabulary.aestheticStyles.join(", "));
  result = result.replace(/\{\{useCases\}\}/g, config.tagVocabulary.useCases.join(", "));
  result = result.replace(/\{\{sizeCategories\}\}/g, config.tagVocabulary.sizeCategories.join(", "));
  result = result.replace(/\{\{printConsiderations\}\}/g, config.tagVocabulary.printConsiderations.join(", "));
  // Subject matter categories
  result = result.replace(/\{\{animals\}\}/g, (config.tagVocabulary.animals || []).join(", "));
  result = result.replace(/\{\{natureElements\}\}/g, (config.tagVocabulary.natureElements || []).join(", "));
  result = result.replace(/\{\{characters\}\}/g, (config.tagVocabulary.characters || []).join(", "));
  result = result.replace(/\{\{themes\}\}/g, (config.tagVocabulary.themes || []).join(", "));

  // Replace valid values placeholders
  result = result.replace(/\{\{projectTypes\}\}/g, config.validValues.projectTypes.join(", "));
  result = result.replace(/\{\{difficulties\}\}/g, config.validValues.difficulties.join(", "));

  // Replace custom variables
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return result;
}

/**
 * Get all valid tags as a Set for validation
 */
export function getAllValidTags(config: AIConfig): Set<string> {
  return new Set([
    ...config.tagVocabulary.objectTypes,
    ...config.tagVocabulary.functionalFeatures,
    ...config.tagVocabulary.aestheticStyles,
    ...config.tagVocabulary.useCases,
    ...config.tagVocabulary.sizeCategories,
    ...config.tagVocabulary.printConsiderations,
    // Subject matter categories (for searchability)
    ...(config.tagVocabulary.animals || []),
    ...(config.tagVocabulary.natureElements || []),
    ...(config.tagVocabulary.characters || []),
    ...(config.tagVocabulary.themes || []),
  ]);
}
