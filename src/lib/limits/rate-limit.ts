/**
 * A token bucket per caller.
 *
 * Rendering a PDF launches real browser work, so an unauthenticated endpoint
 * that does it on demand is a cheap way to exhaust the box. A bucket rather
 * than a fixed window because the honest usage pattern is bursty — someone
 * tweaks a bullet, exports, tweaks again — and a fixed window punishes that
 * while still letting a steady grind through.
 *
 * Deliberately in-process: it protects one instance from being overwhelmed,
 * which is the failure this is guarding against. Enforcing a global quota
 * across replicas needs shared state and is a different problem.
 */

export interface RateLimitOptions {
  /** Maximum burst. */
  capacity: number;
  refillPerSecond: number;
  /** Injectable so tests do not have to sleep. */
  now?: () => number;
  /**
   * Buckets are dropped once they have been full and idle this long. Without
   * it, a caller rotating addresses would grow the map without bound — which
   * is the same denial of service by another route.
   */
  idleEvictionMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Whole seconds until one token is available, for the Retry-After header. */
  retryAfterSeconds: number;
}

interface Bucket {
  tokens: number;
  updated: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  private readonly refillPerSecond: number;
  private readonly now: () => number;
  private readonly idleEvictionMs: number;
  private lastSweep = 0;

  constructor(options: RateLimitOptions) {
    this.capacity = options.capacity;
    this.refillPerSecond = options.refillPerSecond;
    this.now = options.now ?? Date.now;
    this.idleEvictionMs = options.idleEvictionMs ?? 10 * 60 * 1000;
  }

  take(key: string, cost = 1): RateLimitResult {
    const now = this.now();
    this.sweep(now);

    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updated: now };
    const elapsedSeconds = Math.max(0, now - bucket.updated) / 1000;
    const tokens = Math.min(this.capacity, bucket.tokens + elapsedSeconds * this.refillPerSecond);

    if (tokens < cost) {
      this.buckets.set(key, { tokens, updated: now });
      const shortfall = cost - tokens;
      return {
        allowed: false,
        remaining: Math.floor(tokens),
        retryAfterSeconds: Math.max(1, Math.ceil(shortfall / this.refillPerSecond)),
      };
    }

    const left = tokens - cost;
    this.buckets.set(key, { tokens: left, updated: now });
    return { allowed: true, remaining: Math.floor(left), retryAfterSeconds: 0 };
  }

  /** Exposed for tests and for a health endpoint to report on. */
  get size(): number {
    return this.buckets.size;
  }

  /**
   * Sweeping on write rather than on an interval keeps the module free of
   * timers, which matters because a lingering interval keeps a serverless
   * instance alive and makes the unit tests hang.
   */
  private sweep(now: number): void {
    if (now - this.lastSweep < this.idleEvictionMs) return;
    this.lastSweep = now;

    for (const [key, bucket] of this.buckets) {
      const elapsedSeconds = (now - bucket.updated) / 1000;
      const refilled = bucket.tokens + elapsedSeconds * this.refillPerSecond;
      const idleFor = now - bucket.updated;
      if (refilled >= this.capacity && idleFor >= this.idleEvictionMs) {
        this.buckets.delete(key);
      }
    }
  }
}
