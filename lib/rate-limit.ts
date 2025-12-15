/**
 * Rate limiter with Redis support and in-memory fallback
 *
 * Supports distributed rate limiting via Redis when REDIS_URL is configured.
 * Falls back to in-memory rate limiting for single-instance deployments.
 */

// =============================================================================
// Types
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  headers: Record<string, string>;
}

/**
 * Rate limit store interface - allows swapping implementations
 */
interface RateLimitStore {
  get(key: string): Promise<RateLimitEntry | null>;
  set(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void>;
  increment(key: string): Promise<number>;
}

// =============================================================================
// In-Memory Store (default fallback)
// =============================================================================

class InMemoryStore implements RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries periodically
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.resetAt < now) {
          this.store.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    const entry = this.store.get(key);
    if (!entry || entry.resetAt < Date.now()) {
      return null;
    }
    return entry;
  }

  async set(key: string, entry: RateLimitEntry, _ttlMs?: number): Promise<void> {
    this.store.set(key, entry);
  }

  async increment(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (entry) {
      entry.count++;
      return entry.count;
    }
    return 1;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// =============================================================================
// Redis Store (optional - for distributed deployments)
// =============================================================================

class RedisStore implements RateLimitStore {
  private redis: InstanceType<typeof import("ioredis").default> | null = null;
  private connectionPromise: Promise<void> | null = null;
  private fallbackStore: InMemoryStore;

  constructor() {
    this.fallbackStore = new InMemoryStore();
    this.initRedis();
  }

  private async initRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return;
    }

    this.connectionPromise = (async () => {
      try {
        // Dynamic import to avoid bundling ioredis if not used
        const Redis = (await import("ioredis")).default;
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
        });

        await this.redis.connect();
        console.log("[RateLimit] Connected to Redis");
      } catch (error) {
        console.warn("[RateLimit] Redis connection failed, using in-memory fallback:", error);
        this.redis = null;
      }
    })();
  }

  private async ensureConnection(): Promise<boolean> {
    if (this.connectionPromise) {
      await this.connectionPromise;
    }
    return this.redis !== null;
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    if (!(await this.ensureConnection())) {
      return this.fallbackStore.get(key);
    }

    try {
      const data = await this.redis!.get(`ratelimit:${key}`);
      if (!data) return null;

      const entry = JSON.parse(data) as RateLimitEntry;
      if (entry.resetAt < Date.now()) {
        return null;
      }
      return entry;
    } catch {
      return this.fallbackStore.get(key);
    }
  }

  async set(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void> {
    if (!(await this.ensureConnection())) {
      return this.fallbackStore.set(key, entry, ttlMs);
    }

    try {
      await this.redis!.set(
        `ratelimit:${key}`,
        JSON.stringify(entry),
        "PX",
        ttlMs
      );
    } catch {
      await this.fallbackStore.set(key, entry, ttlMs);
    }
  }

  async increment(key: string): Promise<number> {
    if (!(await this.ensureConnection())) {
      return this.fallbackStore.increment(key);
    }

    try {
      const data = await this.redis!.get(`ratelimit:${key}`);
      if (!data) return 1;

      const entry = JSON.parse(data) as RateLimitEntry;
      entry.count++;

      const ttl = await this.redis!.pttl(`ratelimit:${key}`);
      if (ttl > 0) {
        await this.redis!.set(
          `ratelimit:${key}`,
          JSON.stringify(entry),
          "PX",
          ttl
        );
      }

      return entry.count;
    } catch {
      return this.fallbackStore.increment(key);
    }
  }
}

// =============================================================================
// Store Instance (Lazy-loaded to avoid build-time Redis connection)
// =============================================================================

let _store: RateLimitStore | null = null;

function getStore(): RateLimitStore {
  if (!_store) {
    // Only initialize at runtime, not during build
    _store = process.env.REDIS_URL
      ? new RedisStore()
      : new InMemoryStore();
  }
  return _store;
}

// =============================================================================
// Rate Limit Functions
// =============================================================================

/**
 * Build rate limit response headers
 */
function buildHeaders(
  limit: number,
  remaining: number,
  resetAt: number
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param config - Rate limit configuration
 */
export async function checkRateLimitAsync(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const store = getStore();
  const now = Date.now();
  const entry = await store.get(identifier);

  // No existing entry or expired - start fresh
  if (!entry) {
    const resetAt = now + config.windowSeconds * 1000;
    await store.set(identifier, { count: 1, resetAt }, config.windowSeconds * 1000);
    return {
      success: true,
      remaining: config.limit - 1,
      resetAt,
      headers: buildHeaders(config.limit, config.limit - 1, resetAt),
    };
  }

  // Entry exists and is still valid
  const newCount = await store.increment(identifier);
  const remaining = Math.max(0, config.limit - newCount);
  const success = newCount <= config.limit;

  return {
    success,
    remaining: success ? remaining : 0,
    resetAt: entry.resetAt,
    headers: buildHeaders(config.limit, success ? remaining : 0, entry.resetAt),
  };
}

/**
 * Synchronous rate limit check (uses in-memory only)
 * For backwards compatibility with existing code
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param config - Rate limit configuration
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  // Use synchronous in-memory implementation for backwards compatibility
  const memoryStore = new Map<string, RateLimitEntry>();

  // This is a simplified sync version - for full Redis support use checkRateLimitAsync
  const now = Date.now();
  const key = identifier;

  // We need a module-level store for the sync version
  const entry = syncStore.get(key);

  // No existing entry or expired - start fresh
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowSeconds * 1000;
    syncStore.set(key, { count: 1, resetAt });
    return {
      success: true,
      remaining: config.limit - 1,
      resetAt,
      headers: buildHeaders(config.limit, config.limit - 1, resetAt),
    };
  }

  // Entry exists and is still valid
  const remaining = Math.max(0, config.limit - entry.count - 1);
  const success = entry.count < config.limit;

  if (success) {
    entry.count++;
  }

  return {
    success,
    remaining: success ? remaining : 0,
    resetAt: entry.resetAt,
    headers: buildHeaders(config.limit, success ? remaining : 0, entry.resetAt),
  };
}

// Synchronous store for backwards-compatible checkRateLimit function
const syncStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of syncStore.entries()) {
    if (entry.resetAt < now) {
      syncStore.delete(key);
    }
  }
}, 60000);

/**
 * Get client identifier from request
 * Prefers authenticated user ID, falls back to IP
 */
export function getClientIdentifier(
  request: Request,
  userId?: string
): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Get IP from various headers (proxy-aware)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return `ip:${forwarded.split(",")[0].trim()}`;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return `ip:${realIp}`;
  }

  // Fallback for local development
  return "ip:127.0.0.1";
}

// Preset configurations for different endpoints
export const RATE_LIMITS = {
  // Public browsing - generous limit
  browse: { limit: 100, windowSeconds: 60 },
  // Search queries - slightly lower
  search: { limit: 60, windowSeconds: 60 },
  // Downloads - prevent mass downloading
  download: { limit: 30, windowSeconds: 60 },
  // Auth endpoints - prevent brute force
  auth: { limit: 10, windowSeconds: 60 },
  // Admin endpoints - reasonable limit
  admin: { limit: 120, windowSeconds: 60 },
  // Upload - very limited
  upload: { limit: 20, windowSeconds: 60 },
} as const;
