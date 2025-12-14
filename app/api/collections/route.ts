import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { isCollectionsEnabled, getCollectionsConfig } from "@/lib/feature-flags";
import { createCollectionSchema, formatZodError } from "@/lib/validations";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * GET /api/collections
 * List current user's collections
 */
export async function GET(request: NextRequest) {
  if (!(await isCollectionsEnabled())) {
    return NextResponse.json(
      { error: "Collections feature is disabled" },
      { status: 403 }
    );
  }

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

  const supabase = await createClient();

  const { data: collections, error } = await supabase
    .from("collections")
    .select(
      `
      id,
      name,
      description,
      is_public,
      cover_image_url,
      created_at,
      updated_at,
      collection_items (count)
    `
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      { error: "Failed to load collections" },
      { status: 500, headers: rateLimit.headers }
    );
  }

  // Transform to include item count
  const transformedCollections = collections?.map((c) => ({
    ...c,
    item_count:
      (c.collection_items as unknown as { count: number }[])?.[0]?.count || 0,
    collection_items: undefined,
  }));

  return NextResponse.json(
    { collections: transformedCollections },
    { headers: rateLimit.headers }
  );
}

/**
 * POST /api/collections
 * Create a new collection
 */
export async function POST(request: NextRequest) {
  if (!(await isCollectionsEnabled())) {
    return NextResponse.json(
      { error: "Collections feature is disabled" },
      { status: 403 }
    );
  }

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

  const validation = createCollectionSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: formatZodError(validation.error) },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const { name, description, is_public } = validation.data;

  const supabase = createServiceClient();
  const config = await getCollectionsConfig();

  // Check user's current collection count
  const { count: currentCount } = await supabase
    .from("collections")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (currentCount && currentCount >= config.maxPerUser) {
    return NextResponse.json(
      { error: `Maximum collections limit (${config.maxPerUser}) reached` },
      { status: 400, headers: rateLimit.headers }
    );
  }

  const { data, error } = await supabase
    .from("collections")
    .insert({
      user_id: user.id,
      name,
      description,
      is_public,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json(
      { error: "Failed to create collection" },
      { status: 500, headers: rateLimit.headers }
    );
  }

  return NextResponse.json(
    { collection: data },
    { status: 201, headers: rateLimit.headers }
  );
}
