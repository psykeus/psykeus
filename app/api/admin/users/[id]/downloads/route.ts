/**
 * Admin User Downloads API
 *
 * GET - Get user download history
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { IdRouteParams } from "@/lib/types";

export async function GET(request: NextRequest, { params }: IdRouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const supabase = createServiceClient();

    const { data: downloads, error } = await supabase
      .from("downloads")
      .select(`
        id,
        design_id,
        downloaded_at,
        designs:design_id (
          title,
          slug
        )
      `)
      .eq("user_id", id)
      .order("downloaded_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[User Downloads API] Error:", error);
      return NextResponse.json(
        { error: "Failed to fetch downloads" },
        { status: 500 }
      );
    }

    // Transform the data to flatten the design info
    const formattedDownloads = (downloads || []).map((d) => {
      // Supabase returns the joined record directly when using foreign key syntax
      const design = d.designs as unknown as { title: string; slug: string } | null;
      return {
        id: d.id,
        design_id: d.design_id,
        downloaded_at: d.downloaded_at,
        design: design ? {
          title: design.title,
          slug: design.slug,
        } : null,
      };
    });

    return NextResponse.json({ downloads: formattedDownloads });
  } catch (error) {
    console.error("[User Downloads API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch downloads" },
      { status: 500 }
    );
  }
}
