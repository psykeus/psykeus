import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import { loadAIConfig, saveAIConfig, type AIConfig } from "@/lib/ai-config";

export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const config = await loadAIConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to load AI config:", error);
    return NextResponse.json(
      { error: "Failed to load AI configuration" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const config = body as AIConfig;

    // Basic validation
    if (!config.models || !config.prompts || !config.tagVocabulary) {
      return NextResponse.json(
        { error: "Invalid configuration structure" },
        { status: 400 }
      );
    }

    await saveAIConfig(config);

    return NextResponse.json({
      message: "AI configuration saved successfully",
      lastUpdated: config.lastUpdated,
    });
  } catch (error) {
    console.error("Failed to save AI config:", error);
    return NextResponse.json(
      { error: "Failed to save AI configuration" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const currentConfig = await loadAIConfig();

    // Deep merge the updates
    const updatedConfig: AIConfig = {
      ...currentConfig,
      ...body,
      models: body.models ? { ...currentConfig.models, ...body.models } : currentConfig.models,
      tagVocabulary: body.tagVocabulary
        ? { ...currentConfig.tagVocabulary, ...body.tagVocabulary }
        : currentConfig.tagVocabulary,
      validValues: body.validValues
        ? { ...currentConfig.validValues, ...body.validValues }
        : currentConfig.validValues,
      prompts: body.prompts
        ? {
            model3DSystem: body.prompts.model3DSystem
              ? { ...currentConfig.prompts.model3DSystem, ...body.prompts.model3DSystem }
              : currentConfig.prompts.model3DSystem,
            model3DUser: body.prompts.model3DUser
              ? { ...currentConfig.prompts.model3DUser, ...body.prompts.model3DUser }
              : currentConfig.prompts.model3DUser,
            legacy2DSystem: body.prompts.legacy2DSystem
              ? { ...currentConfig.prompts.legacy2DSystem, ...body.prompts.legacy2DSystem }
              : currentConfig.prompts.legacy2DSystem,
            legacy2DUser: body.prompts.legacy2DUser
              ? { ...currentConfig.prompts.legacy2DUser, ...body.prompts.legacy2DUser }
              : currentConfig.prompts.legacy2DUser,
          }
        : currentConfig.prompts,
      displaySettings: body.displaySettings
        ? { ...currentConfig.displaySettings, ...body.displaySettings }
        : currentConfig.displaySettings,
    };

    await saveAIConfig(updatedConfig);

    return NextResponse.json({
      message: "AI configuration updated successfully",
      lastUpdated: updatedConfig.lastUpdated,
    });
  } catch (error) {
    console.error("Failed to update AI config:", error);
    return NextResponse.json(
      { error: "Failed to update AI configuration" },
      { status: 500 }
    );
  }
}
