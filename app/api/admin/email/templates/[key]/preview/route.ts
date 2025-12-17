/**
 * Email Template Preview API
 * POST - Preview template with sample or provided data
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { previewTemplate } from "@/lib/email/email-template-service";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ key: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();

    const { key } = await params;
    const body = await request.json().catch(() => ({}));

    // Use provided variables or use sample data
    const variables = body.variables || undefined;

    const preview = await previewTemplate(key, variables);

    return NextResponse.json({
      success: true,
      preview,
    });
  } catch (error) {
    console.error("Failed to preview email template:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to preview email template" },
      { status: 500 }
    );
  }
}
