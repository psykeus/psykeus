/**
 * Single Email Template API
 * GET - Get template by key
 * PUT - Update template
 * DELETE - Reset template to default
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getTemplate,
  updateTemplate,
  resetTemplateToDefault,
  getTemplateVariables,
} from "@/lib/email/email-template-service";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ key: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();

    const { key } = await params;
    const template = await getTemplate(key);

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template: {
        ...template,
        variableDefinitions: getTemplateVariables(key),
      },
    });
  } catch (error) {
    console.error("Failed to get email template:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to get email template" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();

    const { key } = await params;
    const body = await request.json();

    // Validate at least one field is being updated
    if (!body.subject && !body.html_content && !body.text_content && body.is_active === undefined) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const template = await updateTemplate(key, {
      subject: body.subject,
      html_content: body.html_content,
      text_content: body.text_content,
      is_active: body.is_active,
    });

    return NextResponse.json({
      success: true,
      message: "Template updated successfully",
      template: {
        ...template,
        variableDefinitions: getTemplateVariables(key),
      },
    });
  } catch (error) {
    console.error("Failed to update email template:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update email template" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();

    const { key } = await params;

    const template = await resetTemplateToDefault(key);

    return NextResponse.json({
      success: true,
      message: "Template reset to default",
      template: {
        ...template,
        variableDefinitions: getTemplateVariables(key),
      },
    });
  } catch (error) {
    console.error("Failed to reset email template:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset email template" },
      { status: 500 }
    );
  }
}
