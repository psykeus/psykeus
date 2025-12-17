/**
 * Admin Email Logs API
 *
 * GET - List email logs with filtering
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import {
  parsePaginationParams,
  handleDbError,
} from "@/lib/api/helpers";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const { page, pageSize, from, to } = parsePaginationParams(searchParams, {
      defaultPageSize: 50,
      maxPageSize: 100,
    });
    const status = searchParams.get("status");
    const emailType = searchParams.get("type");
    const email = searchParams.get("email");

    const supabase = createServiceClient();

    let query = supabase
      .from("email_logs")
      .select("*, users(email, name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) {
      query = query.eq("status", status);
    }
    if (emailType) {
      query = query.eq("email_type", emailType);
    }
    if (email) {
      query = query.ilike("recipient_email", `%${email}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[EmailLogs] Error fetching:", error);
      return NextResponse.json({ error: "Failed to fetch email logs" }, { status: 500 });
    }

    // Get stats
    const { data: stats } = await supabase
      .from("email_logs")
      .select("status")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const last24hStats = {
      total: stats?.length || 0,
      sent: stats?.filter((s) => s.status === "sent").length || 0,
      failed: stats?.filter((s) => s.status === "failed").length || 0,
      pending: stats?.filter((s) => s.status === "pending").length || 0,
    };

    return NextResponse.json({
      logs: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
      stats: last24hStats,
    });
  } catch (error) {
    return handleDbError(error, "fetch email logs");
  }
}
