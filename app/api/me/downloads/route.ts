import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { unauthorizedResponse, handleDbError } from "@/lib/api/helpers";

export async function GET() {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return unauthorizedResponse();
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
    return handleDbError(error, "load downloads");
  }

  return NextResponse.json({ downloads });
}
