import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";

export async function GET() {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const { data: downloads, error } = await supabase
    .from("downloads")
    .select(
      `
      id,
      downloaded_at,
      designs (
        id,
        slug,
        title,
        preview_path
      )
    `
    )
    .eq("user_id", user.id)
    .order("downloaded_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching downloads:", error);
    return NextResponse.json(
      { error: "Failed to load downloads" },
      { status: 500 }
    );
  }

  return NextResponse.json({ downloads });
}
