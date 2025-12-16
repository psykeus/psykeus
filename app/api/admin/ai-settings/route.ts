import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdmin } from "@/lib/auth";
import { loadAIConfig, saveAIConfig, type AIConfig } from "@/lib/ai-config";
import { forbiddenResponse, handleDbError } from "@/lib/api/helpers";

export async function GET() {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
  }

  try {
    const config = await loadAIConfig();
    return NextResponse.json(config);
  } catch (error) {
    return handleDbError(error, "load AI configuration");
  }
}

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
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
    return handleDbError(error, "save AI configuration");
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user || !isAdmin(user)) {
    return forbiddenResponse("Admin access required");
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
    return handleDbError(error, "update AI configuration");
  }
}
