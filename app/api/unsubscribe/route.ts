/**
 * Email Unsubscribe API
 *
 * GET - Verify unsubscribe token and show options
 * POST - Process unsubscribe request
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { createServiceClient } from "@/lib/supabase/server";
import { parseJsonBody, handleDbError } from "@/lib/api/helpers";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Missing unsubscribe token" },
        { status: 400 }
      );
    }

    const result = verifyUnsubscribeToken(token);
    if (!result) {
      return NextResponse.json(
        { error: "Invalid or expired unsubscribe link" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get user info
    const { data: user } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("id", result.userId)
      .single();

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get current preferences
    const { data: prefs } = await supabase
      .from("user_email_preferences")
      .select("*")
      .eq("user_id", result.userId)
      .single();

    return NextResponse.json({
      valid: true,
      userId: result.userId,
      email: user.email,
      preferences: prefs || {
        email_unsubscribed: false,
        email_welcome: true,
        email_subscription_confirmation: true,
        email_subscription_expiring: true,
        email_download_limit_warning: true,
        email_account_status_change: true,
        email_import_completion: true,
        email_admin_broadcast: true,
      },
    });
  } catch (error) {
    return handleDbError(error, "verify unsubscribe token");
  }
}

export async function POST(request: NextRequest) {
  try {
    const bodyResult = await parseJsonBody<{
      token: string;
      unsubscribeAll?: boolean;
      preferences?: {
        email_welcome?: boolean;
        email_subscription_confirmation?: boolean;
        email_subscription_expiring?: boolean;
        email_download_limit_warning?: boolean;
        email_account_status_change?: boolean;
        email_import_completion?: boolean;
        email_admin_broadcast?: boolean;
      };
    }>(request);
    if (!bodyResult.success) return bodyResult.response!;
    const body = bodyResult.data!;

    if (!body.token) {
      return NextResponse.json(
        { error: "Missing unsubscribe token" },
        { status: 400 }
      );
    }

    const result = verifyUnsubscribeToken(body.token);
    if (!result) {
      return NextResponse.json(
        { error: "Invalid or expired unsubscribe link" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.unsubscribeAll) {
      updates.email_unsubscribed = true;
      updates.unsubscribed_at = new Date().toISOString();
    } else if (body.preferences) {
      Object.assign(updates, body.preferences);
    }

    // Upsert preferences
    const { error } = await supabase
      .from("user_email_preferences")
      .upsert({
        user_id: result.userId,
        ...updates,
      }, {
        onConflict: "user_id",
      });

    if (error) {
      console.error("[Unsubscribe] Error updating preferences:", error);
      return NextResponse.json(
        { error: "Failed to update preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: body.unsubscribeAll
        ? "You have been unsubscribed from all emails"
        : "Your email preferences have been updated",
    });
  } catch (error) {
    return handleDbError(error, "process unsubscribe");
  }
}
