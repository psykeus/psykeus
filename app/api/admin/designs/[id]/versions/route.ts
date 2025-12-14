import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get all versions for a design
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data: versions, error } = await supabase
    .from("design_files")
    .select("*")
    .eq("design_id", id)
    .order("version_number", { ascending: false });

  if (error) {
    console.error("Error fetching versions:", error);
    return NextResponse.json(
      { error: "Failed to load versions" },
      { status: 500 }
    );
  }

  return NextResponse.json({ versions });
}

// POST - Activate a specific version
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { version_id } = body;

  if (!version_id) {
    return NextResponse.json(
      { error: "version_id is required" },
      { status: 400 }
    );
  }

  // Verify version belongs to this design
  const { data: version, error: versionError } = await supabase
    .from("design_files")
    .select("id")
    .eq("id", version_id)
    .eq("design_id", id)
    .single();

  if (versionError || !version) {
    return NextResponse.json(
      { error: "Version not found for this design" },
      { status: 404 }
    );
  }

  // Deactivate all versions for this design
  await supabase
    .from("design_files")
    .update({ is_active: false })
    .eq("design_id", id);

  // Activate the selected version
  const { error: activateError } = await supabase
    .from("design_files")
    .update({ is_active: true })
    .eq("id", version_id);

  if (activateError) {
    console.error("Error activating version:", activateError);
    return NextResponse.json(
      { error: "Failed to activate version" },
      { status: 500 }
    );
  }

  // Update current_version_id on design
  const { error: designError } = await supabase
    .from("designs")
    .update({
      current_version_id: version_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (designError) {
    console.error("Error updating design:", designError);
    return NextResponse.json(
      { error: "Failed to update design" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Version activated", version_id });
}
