/**
 * Email Templates List API
 * GET - Get all email templates
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAllTemplates, getTemplateVariables } from "@/lib/email/email-template-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();

    const templates = await getAllTemplates();

    // Add variable definitions to each template
    const templatesWithVariables = templates.map((template) => ({
      ...template,
      variableDefinitions: getTemplateVariables(template.template_key),
    }));

    return NextResponse.json({
      success: true,
      templates: templatesWithVariables,
    });
  } catch (error) {
    console.error("Failed to get email templates:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to get email templates" },
      { status: 500 }
    );
  }
}
