import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { isFavoritesEnabled, getFavoritesConfig } from "@/lib/feature-flags";
import { favoriteParamsSchema, formatZodError } from "@/lib/validations";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { featureDisabledResponse, handleDbError } from "@/lib/api/helpers";

interface RouteParams {
  params: Promise<{ designId: string }>;
}

/**
 * GET /api/favorites/[designId]
 * Check if the current user has favorited a design
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Check if feature is enabled
  if (!(await isFavoritesEnabled())) {
    return featureDisabledResponse("Favorites");
  }

  // Validate params
  const rawParams = await params;
  const validation = favoriteParamsSchema.safeParse(rawParams);
  if (!validation.success) {
    return NextResponse.json(
      { error: formatZodError(validation.error) },
      { status: 400 }
    );
  }
  const { designId } = validation.data;

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
      { isFavorited: false, favoriteCount: 0 },
      { headers: rateLimit.headers }
    );
  }

  const supabase = await createClient();

  // Run both queries in parallel for better performance
  const [favoriteResult, countResult] = await Promise.all([
    supabase
      .from("user_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("design_id", designId)
      .maybeSingle(),
    supabase
      .from("user_favorites")
      .select("*", { count: "exact", head: true })
      .eq("design_id", designId),
  ]);

  return NextResponse.json(
    { isFavorited: !!favoriteResult.data, favoriteCount: countResult.count || 0 },
    { headers: rateLimit.headers }
  );
}

/**
 * POST /api/favorites/[designId]
 * Add a design to user's favorites
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Check if feature is enabled
  if (!(await isFavoritesEnabled())) {
    return featureDisabledResponse("Favorites");
  }

  // Validate params
  const rawParams = await params;
  const validation = favoriteParamsSchema.safeParse(rawParams);
  if (!validation.success) {
    return NextResponse.json(
      { error: formatZodError(validation.error) },
      { status: 400 }
    );
  }
  const { designId } = validation.data;

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
  const config = await getFavoritesConfig();

  // Run count and design existence checks in parallel
  const [countResult, designResult] = await Promise.all([
    supabase
      .from("user_favorites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("designs")
      .select("id")
      .eq("id", designId)
      .single(),
  ]);

  if (countResult.count && countResult.count >= config.maxPerUser) {
    return NextResponse.json(
      { error: `Maximum favorites limit (${config.maxPerUser}) reached` },
      { status: 400, headers: rateLimit.headers }
    );
  }

  if (!designResult.data) {
    return NextResponse.json(
      { error: "Design not found" },
      { status: 404, headers: rateLimit.headers }
    );
  }

  // Add to favorites
  const { data, error } = await supabase
    .from("user_favorites")
    .insert({
      user_id: user.id,
      design_id: designId,
    })
    .select()
    .single();

  if (error) {
    // Handle duplicate (already favorited)
    if (error.code === "23505") {
      return NextResponse.json(
        { message: "Already favorited" },
        { headers: rateLimit.headers }
      );
    }

    return handleDbError(error, "add favorite", rateLimit.headers);
  }

  // Get updated count
  const { count } = await supabase
    .from("user_favorites")
    .select("*", { count: "exact", head: true })
    .eq("design_id", designId);

  return NextResponse.json(
    { message: "Added to favorites", favorite: data, favoriteCount: count || 0 },
    { headers: rateLimit.headers }
  );
}

/**
 * DELETE /api/favorites/[designId]
 * Remove a design from user's favorites
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Check if feature is enabled
  if (!(await isFavoritesEnabled())) {
    return featureDisabledResponse("Favorites");
  }

  // Validate params
  const rawParams = await params;
  const validation = favoriteParamsSchema.safeParse(rawParams);
  if (!validation.success) {
    return NextResponse.json(
      { error: formatZodError(validation.error) },
      { status: 400 }
    );
  }
  const { designId } = validation.data;

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

  const { error } = await supabase
    .from("user_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("design_id", designId);

  if (error) {
    return handleDbError(error, "remove favorite", rateLimit.headers);
  }

  // Get updated count
  const { count } = await supabase
    .from("user_favorites")
    .select("*", { count: "exact", head: true })
    .eq("design_id", designId);

  return NextResponse.json(
    { message: "Removed from favorites", favoriteCount: count || 0 },
    { headers: rateLimit.headers }
  );
}
