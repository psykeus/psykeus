/**
 * Test SMTP Connection API
 * POST - Test SMTP connection with current or provided settings
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { testSmtpConnection } from "@/lib/email/email-settings-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => ({}));

    // If settings provided, use them for testing
    const settings = body.smtp_host
      ? {
          smtp_host: body.smtp_host,
          smtp_port: parseInt(body.smtp_port, 10),
          smtp_user: body.smtp_user,
          smtp_password: body.smtp_password,
          smtp_from_email: body.smtp_from_email,
          smtp_from_name: body.smtp_from_name,
          smtp_secure: body.smtp_secure === true,
        }
      : undefined;

    const result = await testSmtpConnection(settings);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to test SMTP connection:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to test connection",
      },
      { status: 500 }
    );
  }
}
