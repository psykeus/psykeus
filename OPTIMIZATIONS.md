# Performance Optimizations Roadmap

**Created**: 2025-12-06 20:15 UTC
**Model**: Claude Opus 4.5 (claude-opus-4-5-20251101)
**Last Updated**: 2025-12-06 21:30 UTC

---

## Implementation Status

| Phase | Status | Completed Items |
|-------|--------|-----------------|
| **Phase 1** | ✅ Complete | N+1 queries fixed, middleware optimized, cache headers added, DB indexes created |
| **Phase 2** | ✅ Complete | FavoriteButton optimized, ModelViewer fixed, scroll throttled, image priorities set |
| **Phase 3** | ✅ Complete | ISR added, preview timeout added, SWR hooks created |
| **Phase 4** | 🔄 Partial | Feature flag cache TTL increased (5 min) |

### Files Modified
- `app/api/admin/duplicates/manage/route.ts` - Bulk update optimization
- `app/api/favorites/[designId]/route.ts` - Parallel queries
- `app/api/designs/route.ts` - Tag join optimization + cache headers
- `app/api/admin/analytics/popular/route.ts` - RPC function + cache headers
- `lib/supabase/middleware.ts` - Combined session/role RPC
- `app/api/designs/[slug]/route.ts` - Cache headers
- `app/api/admin/tags/route.ts` - Cache headers
- `components/BackToTop.tsx` - Throttled scroll
- `components/DesignCard.tsx` - Initial favorite props + priority
- `components/ModelViewer.tsx` - Scene persistence with refs
- `app/page.tsx` - Server-side favorite fetching
- `app/designs/page.tsx` - Server-side favorite fetching
- `app/designs/[slug]/page.tsx` - ISR with 1-hour revalidation
- `lib/preview-generator.ts` - 30-second timeout
- `lib/feature-flags.ts` - 5-minute cache TTL
- `hooks/use-designs.ts` - SWR hooks (new)
- `components/SWRProvider.tsx` - Global SWR config (new)
- `supabase/migrations/0010_performance_optimizations.sql` - RPC functions + indexes (new)

---

## Executive Summary

This document identifies **35+ performance optimization opportunities** across the CNC Design Library application. Implementation of these recommendations is expected to achieve:

- **50-70% reduction** in API response times
- **3-5x higher** concurrent user capacity
- **Improved Core Web Vitals** (LCP, FID, CLS)
- **Reduced database load** through caching and query optimization

Optimizations are organized into four phases by priority and impact.

---

## Phase 1: Critical Issues (Immediate)

These issues significantly impact user experience and should be addressed first.

### 1.1 Database N+1 Queries

#### Issue: Loop-based Updates in Duplicate Management
**File**: `app/api/admin/duplicates/manage/route.ts` (lines 113-122)
**Impact**: 80-90% latency reduction possible
**Effort**: Low

**Current Code**:
```typescript
// Updates each design individually in a loop
for (const designId of designIds) {
  await supabase
    .from("designs")
    .update({ duplicate_of: primaryId })
    .eq("id", designId);
}
```

**Recommended**:
```typescript
// Single bulk update
await supabase
  .from("designs")
  .update({ duplicate_of: primaryId })
  .in("id", designIds);
```

#### Issue: Separate Count Queries in Favorites
**File**: `app/api/favorites/[designId]/route.ts` (lines 67-70, 179-182, 251-254)
**Impact**: 30-50% improvement per request
**Effort**: Low

**Current Code**:
```typescript
// Two separate queries
const { data: favorite } = await supabase
  .from("favorites")
  .select("id")
  .eq("user_id", user.id)
  .eq("design_id", designId)
  .single();

const { count } = await supabase
  .from("favorites")
  .select("*", { count: "exact", head: true })
  .eq("design_id", designId);
```

**Recommended**:
```typescript
// Combined query with parallel execution
const [favoriteResult, countResult] = await Promise.all([
  supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("design_id", designId)
    .maybeSingle(),
  supabase
    .from("favorites")
    .select("*", { count: "exact", head: true })
    .eq("design_id", designId)
]);
```

#### Issue: 3-Query Tag Filtering Pattern
**File**: `app/api/designs/route.ts` (lines 78-103)
**Impact**: 40-60% improvement
**Effort**: Medium

**Current Code**:
```typescript
// Step 1: Get tag IDs
const { data: tagRecords } = await supabase
  .from("tags")
  .select("id")
  .in("name", tagNames);

// Step 2: Get design IDs with those tags
const { data: designTags } = await supabase
  .from("design_tags")
  .select("design_id")
  .in("tag_id", tagIds);

// Step 3: Filter designs by those IDs
query = query.in("id", designIds);
```

**Recommended**:
```sql
-- Create a database function for tag filtering
CREATE OR REPLACE FUNCTION get_designs_by_tags(tag_names text[])
RETURNS SETOF uuid AS $$
  SELECT DISTINCT dt.design_id
  FROM design_tags dt
  JOIN tags t ON t.id = dt.tag_id
  WHERE t.name = ANY(tag_names)
$$ LANGUAGE sql STABLE;
```

```typescript
// Single RPC call
const { data: designIds } = await supabase
  .rpc("get_designs_by_tags", { tag_names: tagNames });
```

#### Issue: In-Memory Aggregation for Analytics
**File**: `app/api/admin/analytics/popular/route.ts` (lines 54-103)
**Impact**: 70-95% improvement
**Effort**: Medium

**Current Code**:
```typescript
// Fetches ALL downloads, then aggregates in JavaScript
const { data: downloads } = await supabase
  .from("downloads")
  .select("design_id, created_at")
  .gte("created_at", startDate.toISOString());

// Manual counting and sorting in memory
const counts = new Map();
downloads.forEach(d => {
  counts.set(d.design_id, (counts.get(d.design_id) || 0) + 1);
});
```

**Recommended**:
```sql
-- Create materialized view (refresh periodically)
CREATE MATERIALIZED VIEW popular_designs_daily AS
SELECT
  design_id,
  date_trunc('day', created_at) as day,
  COUNT(*) as download_count
FROM downloads
GROUP BY design_id, date_trunc('day', created_at);

CREATE INDEX idx_popular_designs_day ON popular_designs_daily(day DESC);
```

```typescript
// Query aggregated data directly
const { data } = await supabase
  .from("popular_designs_daily")
  .select("design_id, download_count")
  .gte("day", startDate.toISOString())
  .order("download_count", { ascending: false })
  .limit(limit);
```

---

### 1.2 Middleware Performance

**File**: `lib/supabase/middleware.ts` (lines 50-119)
**Impact**: Reduces 3 database calls to 0-1 per request
**Effort**: Medium

**Current Issue**:
Every request makes 3 sequential Supabase calls:
1. `supabase.auth.getUser()` - Auth check
2. `supabase.from("users").select()` - Get user record
3. `supabase.from("users").select()` - Check admin role

**Recommended Solution**:
Cache user role in JWT claims or session cookie.

```typescript
// In auth callback, set custom claims
const { data: userData } = await supabase
  .from("users")
  .select("role")
  .eq("id", user.id)
  .single();

// Store role in session metadata (one-time on login)
await supabase.auth.updateUser({
  data: { role: userData.role }
});

// In middleware, read from JWT (no DB call)
const role = session.user.user_metadata.role;
const isAdmin = role === "admin" || role === "super_admin";
```

**Caveat**: Role changes require re-authentication or cache invalidation.

---

### 1.3 Missing HTTP Cache Headers

**Impact**: Significant reduction in server load for static-ish content
**Effort**: Low

**Current Issue**: No API routes set Cache-Control headers.

**Recommended**:
```typescript
// For public, rarely-changing data (e.g., design list)
return NextResponse.json(data, {
  headers: {
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
  }
});

// For user-specific data
return NextResponse.json(data, {
  headers: {
    "Cache-Control": "private, max-age=0, must-revalidate"
  }
});

// For static resources (tags, categories)
return NextResponse.json(data, {
  headers: {
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"
  }
});
```

---

## Phase 2: High Priority

### 2.1 Frontend Component Optimizations

#### FavoriteButton API Cascade
**File**: `components/FavoriteButton.tsx` (lines 34-59)
**Impact**: Eliminates 24+ API calls per design list page
**Effort**: Medium

**Current Issue**:
Each FavoriteButton makes an API call on mount to check favorite status.

**Recommended**:
```typescript
// In parent page/component, fetch all favorites once
const { data: userFavorites } = await supabase
  .from("favorites")
  .select("design_id")
  .eq("user_id", user.id);

const favoriteSet = new Set(userFavorites?.map(f => f.design_id));

// Pass to DesignCard
<DesignCard design={design} isFavorite={favoriteSet.has(design.id)} />

// FavoriteButton receives initial state as prop
interface Props {
  designId: string;
  initialFavorite?: boolean;
  initialCount?: number;
}
```

#### ModelViewer Scene Recreation
**File**: `components/ModelViewer.tsx` (lines 45-318)
**Impact**: Smoother 3D interactions, reduced memory churn
**Effort**: Medium

**Current Issue**:
Three.js scene is recreated on component re-renders.

**Recommended**:
```typescript
// Separate scene initialization from updates
const sceneRef = useRef<THREE.Scene | null>(null);
const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

useEffect(() => {
  // Initialize once
  if (!sceneRef.current) {
    sceneRef.current = new THREE.Scene();
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    // ... setup
  }

  return () => {
    // Cleanup only on unmount
    rendererRef.current?.dispose();
  };
}, []); // Empty deps = init once

useEffect(() => {
  // Update model when URL changes
  if (sceneRef.current && modelUrl) {
    loadModel(modelUrl, sceneRef.current);
  }
}, [modelUrl]);
```

#### Missing LCP Image Priority
**File**: `components/DesignPreview.tsx`
**Impact**: Improved Largest Contentful Paint
**Effort**: Low

**Recommended**:
```typescript
<Image
  src={previewUrl}
  alt={design.title}
  fill
  priority={isAboveFold} // Pass from parent
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

#### Unthrottled Scroll Listener
**File**: `components/BackToTop.tsx`
**Impact**: Reduced main thread blocking
**Effort**: Low

**Recommended**:
```typescript
import { useCallback, useEffect, useState } from "react";

function useThrottledScroll(callback: () => void, delay = 200) {
  useEffect(() => {
    let lastCall = 0;
    const handleScroll = () => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        callback();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [callback, delay]);
}
```

---

### 2.2 Missing Database Indexes

**Impact**: 50-80% faster queries on filtered/sorted operations
**Effort**: Low

Add to new migration file:

```sql
-- Most common query pattern: public designs by date
CREATE INDEX CONCURRENTLY idx_designs_public_created
ON designs(is_public, created_at DESC)
WHERE is_public = true;

-- Design files lookup
CREATE INDEX CONCURRENTLY idx_design_files_active_role
ON design_files(design_id, file_role, is_active)
WHERE is_active = true;

-- Slug lookups (design detail pages)
CREATE INDEX CONCURRENTLY idx_designs_slug
ON designs(slug)
WHERE slug IS NOT NULL;

-- Tag filtering
CREATE INDEX CONCURRENTLY idx_design_tags_tag_id
ON design_tags(tag_id);

-- Favorites by user
CREATE INDEX CONCURRENTLY idx_favorites_user_design
ON favorites(user_id, design_id);
```

**Note**: Use `CONCURRENTLY` to avoid locking tables during creation.

---

## Phase 3: Medium Priority

### 3.1 Client-Side Data Fetching

**Impact**: Request deduplication, automatic caching
**Effort**: Medium-High

**Recommended**: Implement SWR or React Query

```typescript
// hooks/useDesigns.ts
import useSWR from "swr";

export function useDesigns(filters: DesignFilters) {
  const key = `/api/designs?${new URLSearchParams(filters)}`;

  return useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });
}

// In component
const { data, isLoading, mutate } = useDesigns(filters);
```

### 3.2 Incremental Static Regeneration (ISR)

**File**: `app/designs/[slug]/page.tsx`
**Impact**: Near-instant page loads for popular designs
**Effort**: Low

```typescript
export const revalidate = 3600; // Revalidate every hour

// Or with on-demand revalidation
export async function generateStaticParams() {
  const { data: designs } = await supabase
    .from("designs")
    .select("slug")
    .eq("is_public", true)
    .order("download_count", { ascending: false })
    .limit(100);

  return designs?.map(d => ({ slug: d.slug })) || [];
}
```

### 3.3 Preview Generation Timeout

**File**: `lib/preview-generator.ts`
**Impact**: Prevents hung workers
**Effort**: Low

```typescript
async function generatePreviewWithTimeout(
  filePath: string,
  options: PreviewOptions,
  timeoutMs = 30000
): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await generatePreview(filePath, options, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
```

---

## Phase 4: Low Priority

### 4.1 Edge Runtime for Stateless Routes

**Impact**: Lower latency, reduced cold starts
**Effort**: Low per route

Routes that don't need Node.js APIs can use Edge:

```typescript
// app/api/designs/route.ts (if no file operations)
export const runtime = "edge";
```

**Candidates**:
- `/api/designs` (list)
- `/api/tags`
- `/api/favorites/[designId]` (status check)

**Caveat**: Edge runtime has limited API surface. Test thoroughly.

### 4.2 Animation Performance

**Impact**: Reduced layout thrashing
**Effort**: Low

Audit components using:
- `animate-` Tailwind classes
- CSS transitions on mount

For heavy animations, use `will-change` or `transform` instead of layout properties.

### 4.3 Feature Flag Cache TTL

**File**: `lib/feature-flags.ts`
**Impact**: Fewer config file reads
**Effort**: Low

```typescript
// Increase from current ~60s to 300-600s
const FLAG_CACHE_TTL = 300; // 5 minutes

let cachedConfig: AIConfig | null = null;
let cacheTimestamp = 0;

export async function getFlags(): Promise<FeatureFlags> {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < FLAG_CACHE_TTL * 1000) {
    return cachedConfig.featureFlags;
  }

  cachedConfig = await loadAIConfig();
  cacheTimestamp = now;
  return cachedConfig.featureFlags;
}
```

---

## Production Considerations

### Redis for Multi-Instance Deployment

For horizontal scaling, shared caching is essential:

```typescript
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

// Cache user sessions
await redis.setex(`user:${userId}:role`, 3600, role);

// Cache popular designs
await redis.setex("popular:daily", 300, JSON.stringify(designs));
```

### Connection Pooling

Supabase uses PgBouncer, but verify:

```typescript
// In supabase client config
const supabase = createClient(url, key, {
  db: {
    schema: "public",
  },
  global: {
    headers: { "x-connection-pool": "transaction" }
  }
});
```

### CDN Strategy for Supabase Storage

Currently `cdnIntegration.enabled: false` in config. When enabling:

1. Configure Cloudflare or similar CDN
2. Set proper cache headers on storage objects
3. Update `cdnUrl` in `config/ai-config.json`

```typescript
function getAssetUrl(path: string): string {
  const config = getAIConfig();
  if (config.featureFlags.cdnIntegration.enabled) {
    return `${config.featureFlags.cdnIntegration.cdnUrl}/${path}`;
  }
  return supabase.storage.from("designs").getPublicUrl(path).data.publicUrl;
}
```

---

## Implementation Order

| Phase | Item | Effort | Impact | Dependencies |
|-------|------|--------|--------|--------------|
| 1.1 | Bulk update in duplicates | Low | High | None |
| 1.1 | Parallelize favorites queries | Low | Medium | None |
| 1.3 | Add Cache-Control headers | Low | High | None |
| 2.2 | Add database indexes | Low | High | DB access |
| 2.1 | FavoriteButton prop drilling | Medium | High | None |
| 1.2 | Middleware role caching | Medium | High | Auth changes |
| 1.1 | Tag filtering RPC | Medium | Medium | DB function |
| 2.1 | ModelViewer optimization | Medium | Medium | None |
| 3.2 | ISR on design pages | Low | Medium | None |
| 1.1 | Analytics materialized view | Medium | High | DB access |
| 3.1 | SWR/React Query | High | High | Refactoring |
| 4.1 | Edge runtime migration | Low each | Low | Testing |

---

## Monitoring & Validation

After implementing optimizations, measure impact using:

1. **Vercel Analytics** - Core Web Vitals, response times
2. **Supabase Dashboard** - Query performance, connection usage
3. **Browser DevTools** - Network waterfall, Lighthouse audits

Set baseline metrics before starting and compare after each phase.

---

## Caveats & Notes

1. **Role Caching** (1.2): Users must re-authenticate to pick up role changes. Consider adding a "refresh session" mechanism for admins.

2. **Materialized Views** (1.1): Require periodic refresh. Set up a cron job or Supabase scheduled function.

3. **Edge Runtime** (4.1): Some Supabase operations may not work. Test each route thoroughly.

4. **ISR** (3.2): Stale content possible. Implement on-demand revalidation for admin edits.

5. **Index Creation** (2.2): Use `CONCURRENTLY` to avoid table locks in production.

6. **Breaking Changes**: FavoriteButton API change (2.1) requires updating all usages.
