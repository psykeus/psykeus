import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { isCollectionsEnabled } from "@/lib/feature-flags";
import { collectionParamsSchema, updateCollectionSchema, formatZodError } from "@/lib/validations";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { featureDisabledResponse, handleDbError } from "@/lib/api/helpers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/collections/[id]
 * Get a single collection with its items
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!(await isCollectionsEnabled())) {
    return featureDisabledResponse("Collections");
  }

  // Validate params
  const rawParams = await params;
  const validation = collectionParamsSchema.safeParse(rawParams);
  if (!validation.success) {
    return NextResponse.json(
      { error: formatZodError(validation.error) },
      { status: 400 }
    );
  }
  const { id } = validation.data;

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

  const supabase = await createClient();

  // Fetch collection
  const { data: collection, error } = await supabase
    .from("collections")
    .select(
      `
      id,
      user_id,
      name,
      description,
      is_public,
      cover_image_url,
      created_at,
      updated_at
    `
    )
    .eq("id", id)
    .single();

  if (error || !collection) {
    return NextResponse.json(
      { error: "Collection not found" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  // Check access permissions
  const isOwner = user?.id === collection.user_id;
  if (!collection.is_public && !isOwner) {
    return NextResponse.json(
      { error: "You don't have access to this collection" },
      { status: 403, headers: rateLimit.headers }
    );
  }

  // Fetch collection items with design details
  const { data: items } = await supabase
    .from("collection_items")
    .select(
      `
      id,
      added_at,
      sort_order,
      notes,
      designs (
        id,
        slug,
        title,
        preview_path,
        difficulty,
        style,
        is_public
      )
    `
    )
    .eq("collection_id", id)
    .order("sort_order", { ascending: true });

  type DesignData = {
    id: string;
    slug: string;
    title: string;
    preview_path: string | null;
    difficulty: string | null;
    style: string | null;
    is_public: boolean;
  };

  // Filter to only show public designs (or all if owner)
  const filteredItems = items
    ?.map((item) => {
      const design = item.designs as unknown as DesignData | null;
      if (!design) return null;
      if (!design.is_public && !isOwner) return null;
      return {
        id: item.id,
        added_at: item.added_at,
        sort_order: item.sort_order,
        notes: item.notes,
        design,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return NextResponse.json(
    {
      collection: { ...collection, isOwner },
      items: filteredItems || [],
    },
    { headers: rateLimit.headers }
  );
}

/**
 * PATCH /api/collections/[id]
 * Update a collection
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!(await isCollectionsEnabled())) {
    return featureDisabledResponse("Collections");
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
  const { id } = paramsValidation.data;

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
  const { data: existing } = await supabase
    .from("collections")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json(
      { error: "Collection not found or access denied" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  // Validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const validation = updateCollectionSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: formatZodError(validation.error) },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const updates = validation.data;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No updates provided" },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const { data, error } = await supabase
    .from("collections")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return handleDbError(error, "update collection", rateLimit.headers);
  }

  return NextResponse.json(
    { collection: data },
    { headers: rateLimit.headers }
  );
}

/**
 * DELETE /api/collections/[id]
 * Delete a collection
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!(await isCollectionsEnabled())) {
    return featureDisabledResponse("Collections");
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
  const { id } = paramsValidation.data;

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
  const { data: existing } = await supabase
    .from("collections")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json(
      { error: "Collection not found or access denied" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  const { error } = await supabase.from("collections").delete().eq("id", id);

  if (error) {
    return handleDbError(error, "delete collection", rateLimit.headers);
  }

  return NextResponse.json(
    { message: "Collection deleted" },
    { headers: rateLimit.headers }
  );
}
