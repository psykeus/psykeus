import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser, isAdmin } from "@/lib/auth";
import { z } from "zod";

// Increased limit to support bulk operations on all designs
// Operations are batched internally for database efficiency
const MAX_BULK_SIZE = 10000;
const BATCH_SIZE = 500;

const bulkActionSchema = z.object({
  designIds: z.array(z.string().uuid()).min(1).max(MAX_BULK_SIZE),
  action: z.enum(["publish", "unpublish", "delete"]),
});

export async function POST(request: NextRequest) {
  const user = await getUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validation = bulkActionSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request", details: validation.error.issues },
      { status: 400 }
    );
  }

  const { designIds, action } = validation.data;
  const supabase = createServiceClient();

  try {
    // Process in batches for efficiency
    let processedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < designIds.length; i += BATCH_SIZE) {
      const batch = designIds.slice(i, i + BATCH_SIZE);
      let result;

      switch (action) {
        case "publish":
          result = await supabase
            .from("designs")
            .update({ is_public: true, updated_at: new Date().toISOString() })
            .in("id", batch);
          break;

        case "unpublish":
          result = await supabase
            .from("designs")
            .update({ is_public: false, updated_at: new Date().toISOString() })
            .in("id", batch);
          break;

        case "delete":
          result = await supabase
            .from("designs")
            .delete()
            .in("id", batch);
          break;
      }

      if (result.error) {
        console.error(`Bulk action batch error (${i}-${i + batch.length}):`, result.error);
        errorCount += batch.length;
      } else {
        processedCount += batch.length;
      }
    }

    if (errorCount > 0 && processedCount === 0) {
      return NextResponse.json(
        { error: "Failed to perform bulk action" },
        { status: 500 }
      );
    }

    const actionVerb = action === "publish" ? "published" : action === "unpublish" ? "unpublished" : "deleted";

    return NextResponse.json({
      success: true,
      message: errorCount > 0
        ? `${actionVerb} ${processedCount} design(s), ${errorCount} failed`
        : `Successfully ${actionVerb} ${processedCount} design(s)`,
      count: processedCount,
      errors: errorCount,
    });
  } catch (error) {
    console.error("Bulk action error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
