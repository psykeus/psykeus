import { NextResponse } from "next/server";
import { loadAIConfig } from "@/lib/ai-config";

/**
 * Public API route to get display settings
 * No authentication required - these settings control what's shown on the public site
 */
export async function GET() {
  try {
    const config = await loadAIConfig();
    return NextResponse.json(config.displaySettings);
  } catch (error) {
    console.error("Failed to load display settings:", error);
    // Return defaults on error
    return NextResponse.json({
      showMaterials: true,
      showDifficulty: true,
      showDimensions: true,
      showPrintTime: true,
      showSupportsRequired: true,
      showLayerHeight: true,
    });
  }
}
