/**
 * Email Settings API
 * GET - Get current SMTP settings (password masked)
 * PUT - Update SMTP settings
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getEmailSettingsPublic,
  updateEmailSettings,
  isUsingEnvSettings,
} from "@/lib/email/email-settings-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();

    const settings = await getEmailSettingsPublic();
    const usingEnv = await isUsingEnvSettings();

    return NextResponse.json({
      success: true,
      settings,
      isUsingEnvSettings: usingEnv,
    });
  } catch (error) {
    console.error("Failed to get email settings:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to get email settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      "smtp_host",
      "smtp_port",
      "smtp_user",
      "smtp_from_email",
      "smtp_from_name",
    ];

    for (const field of requiredFields) {
      if (!body[field] && body[field] !== false && body[field] !== 0) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const settings = await updateEmailSettings({
      smtp_host: body.smtp_host,
      smtp_port: parseInt(body.smtp_port, 10),
      smtp_user: body.smtp_user,
      smtp_password: body.smtp_password || undefined, // Only pass if provided
      smtp_from_email: body.smtp_from_email,
      smtp_from_name: body.smtp_from_name,
      smtp_secure: body.smtp_secure === true,
    });

    return NextResponse.json({
      success: true,
      message: "Email settings updated successfully",
      settings: {
        ...settings,
        smtp_password: undefined, // Don't return password
        smtp_password_masked: "***",
      },
    });
  } catch (error) {
    console.error("Failed to update email settings:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update email settings" },
      { status: 500 }
    );
  }
}
