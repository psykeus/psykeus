import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { isCollectionsEnabled, getCollectionsConfig } from "@/lib/feature-flags";
import { collectionParamsSchema, addCollectionItemSchema, removeCollectionItemSchema, updateCollectionItemSchema, formatZodError } from "@/lib/validations";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/collections/[id]/items
 * Add a design to a collection
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!(await isCollectionsEnabled())) {
    return NextResponse.json(
      { error: "Collections feature is disabled" },
      { status: 403 }
    );
  }

  // Validate params
  const rawParams = await params;
  const paramsValidation = collectionParamsSchema.safeParse(rawParams);
  if (!paramsValidation.success) {
    return NextResponse.json(
      { error: formatZodError(paramsValidation.error) },
      { status: 400 }
    );
  }
  const { id: collectionId } = paramsValidation.data;

  const user = await getUser();

  // Rate limiting
  const identifier = getClientIdentifier(request, user?.id);
  const rateLimit = checkRateLimit(identifier, RATE_LIMITS.browse);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimit.headers }
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: rateLimit.headers }
    );
  }

  const supabase = createServiceClient();
  const config = await getCollectionsConfig();

  // Verify ownership
  const { data: collection } = await supabase
    .from("collections")
    .select("user_id")
    .eq("id", collectionId)
    .single();

  if (!collection || collection.user_id !== user.id) {
    return NextResponse.json(
      { error: "Collection not found or access denied" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const bodyValidation = addCollectionItemSchema.safeParse(body);
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: formatZodError(bodyValidation.error) },
      { status: 400, headers: rateLimit.headers }
    );
  }
  const { design_id, notes } = bodyValidation.data;

  // Verify design exists
  const { data: design } = await supabase
    .from("designs")
    .select("id")
    .eq("id", design_id)
    .single();

  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  // Check current item count in collection
  const { count: currentCount } = await supabase
    .from("collection_items")
    .select("*", { count: "exact", head: true })
    .eq("collection_id", collectionId);

  if (currentCount && currentCount >= config.maxItemsPerCollection) {
    return NextResponse.json(
      {
        error: `Maximum items per collection (${config.maxItemsPerCollection}) reached`,
      },
      { status: 400 }
    );
  }

  // Get next sort order
  const { data: lastItem } = await supabase
    .from("collection_items")
    .select("sort_order")
    .eq("collection_id", collectionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (lastItem?.sort_order ?? -1) + 1;

  // Add to collection
  const { data, error } = await supabase
    .from("collection_items")
    .insert({
      collection_id: collectionId,
      design_id,
      notes: notes?.trim() || null,
      sort_order: nextSortOrder,
    })
    .select()
    .single();

  if (error) {
    // Handle duplicate
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Design already in this collection" },
        { status: 400 }
      );
    }

    console.error("Error adding to collection:", error);
    return NextResponse.json(
      { error: "Failed to add to collection" },
      { status: 500 }
    );
  }

  return NextResponse.json({ item: data }, { status: 201 });
}

/**
 * DELETE /api/collections/[id]/items
 * Remove a design from a collection
 * Body: { design_id: string } or { item_id: string }
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!(await isCollectionsEnabled())) {
    return NextResponse.json(
      { error: "Collections feature is disabled" },
      { status: 403 }
    );
  }

  // Validate params
  const rawParams = await params;
  const paramsValidation = collectionParamsSchema.safeParse(rawParams);
  if (!paramsValidation.success) {
    return NextResponse.json(
      { error: formatZodError(paramsValidation.error) },
      { status: 400 }
    );
  }
  const { id: collectionId } = paramsValidation.data;

  const user = await getUser();

  // Rate limiting
  const identifier = getClientIdentifier(request, user?.id);
  const rateLimit = checkRateLimit(identifier, RATE_LIMITS.browse);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimit.headers }
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: rateLimit.headers }
    );
  }

  const supabase = createServiceClient();

  // Verify ownership
  const { data: collection } = await supabase
    .from("collections")
    .select("user_id")
    .eq("id", collectionId)
    .single();

  if (!collection || collection.user_id !== user.id) {
    return NextResponse.json(
      { error: "Collection not found or access denied" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const bodyValidation = removeCollectionItemSchema.safeParse(body);
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: formatZodError(bodyValidation.error) },
      { status: 400, headers: rateLimit.headers }
    );
  }
  const { design_id, item_id } = bodyValidation.data;

  let query = supabase.from("collection_items").delete();

  if (item_id) {
    query = query.eq("id", item_id).eq("collection_id", collectionId);
  } else {
    query = query.eq("design_id", design_id).eq("collection_id", collectionId);
  }

  const { error } = await query;

  if (error) {
    console.error("Error removing from collection:", error);
    return NextResponse.json(
      { error: "Failed to remove from collection" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Removed from collection" });
}

/**
 * PATCH /api/collections/[id]/items
 * Update item order or notes
 * Body: { item_id: string, sort_order?: number, notes?: string }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!(await isCollectionsEnabled())) {
    return NextResponse.json(
      { error: "Collections feature is disabled" },
      { status: 403 }
    );
  }

  // Validate params
  const rawParams = await params;
  const paramsValidation = collectionParamsSchema.safeParse(rawParams);
  if (!paramsValidation.success) {
    return NextResponse.json(
      { error: formatZodError(paramsValidation.error) },
      { status: 400 }
    );
  }
  const { id: collectionId } = paramsValidation.data;

  const user = await getUser();

  // Rate limiting
  const identifier = getClientIdentifier(request, user?.id);
  const rateLimit = checkRateLimit(identifier, RATE_LIMITS.browse);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimit.headers }
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: rateLimit.headers }
    );
  }

  const supabase = createServiceClient();

  // Verify ownership
  const { data: collection } = await supabase
    .from("collections")
    .select("user_id")
    .eq("id", collectionId)
    .single();

  if (!collection || collection.user_id !== user.id) {
    return NextResponse.json(
      { error: "Collection not found or access denied" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const bodyValidation = updateCollectionItemSchema.safeParse(body);
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: formatZodError(bodyValidation.error) },
      { status: 400, headers: rateLimit.headers }
    );
  }
  const { item_id, sort_order, notes } = bodyValidation.data;

  const updates: Record<string, unknown> = {};

  if (sort_order !== undefined) {
    updates.sort_order = sort_order;
  }

  if (notes !== undefined) {
    updates.notes = notes?.trim() || null;
  }

  const { data, error } = await supabase
    .from("collection_items")
    .update(updates)
    .eq("id", item_id)
    .eq("collection_id", collectionId)
    .select()
    .single();

  if (error) {
    console.error("Error updating collection item:", error);
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    );
  }

  return NextResponse.json({ item: data });
}
