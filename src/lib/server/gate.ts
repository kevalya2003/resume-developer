import "server-only";

import { NextResponse } from "next/server";
import { declaredTooLarge, PayloadTooLargeError, readBoundedText } from "../limits/body";
import { RateLimiter } from "../limits/rate-limit";
import { QueueTimeoutError, Semaphore } from "../limits/semaphore";

/**
 * The front door for the two endpoints that do real work.
 *
 * Both render a PDF in a headless browser, both are unauthenticated, and the
 * app is meant to be self-hostable by someone who is not going to put a WAF in
 * front of it. So the protection has to live here: a size ceiling so a body
 * cannot exhaust memory, a token bucket so one caller cannot monopolise the
 * instance, and a concurrency limit so simultaneous callers queue instead of
 * opening more browser contexts than the machine can hold.
 */

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/**
 * A generous resume is a few tens of kilobytes of JSON. Half a megabyte leaves
 * enormous headroom for someone pasting a long job description while still
 * being far too small to hurt.
 */
export const MAX_BODY_BYTES = intFromEnv("RESUME_MAX_BODY_BYTES", 512 * 1024);

const CONCURRENCY = intFromEnv("RESUME_RENDER_CONCURRENCY", 2);
const QUEUE_TIMEOUT_MS = intFromEnv("RESUME_QUEUE_TIMEOUT_MS", 20_000);
/**
 * Twenty exports in a burst, refilling at twenty a minute. Someone iterating on
 * wording exports far more often than they would guess, so a tighter allowance
 * mostly punishes real use; this is still low enough that a script cannot keep
 * the renderer saturated.
 */
const RATE_CAPACITY = intFromEnv("RESUME_RATE_CAPACITY", 20);
const RATE_REFILL_PER_MINUTE = intFromEnv("RESUME_RATE_REFILL_PER_MINUTE", 20);

// Parked on globalThis for the same reason as the browser instance: in dev the
// module is re-evaluated on every hot reload, and a fresh limiter each time
// would mean no limit at all.
const globalForGate = globalThis as unknown as {
  __resumeLimiter?: RateLimiter;
  __resumeSlots?: Semaphore;
};

const limiter = (globalForGate.__resumeLimiter ??= new RateLimiter({
  capacity: RATE_CAPACITY,
  refillPerSecond: RATE_REFILL_PER_MINUTE / 60,
}));

const slots = (globalForGate.__resumeSlots ??= new Semaphore(CONCURRENCY));

/**
 * Identifies the caller for rate limiting.
 *
 * This trusts `x-forwarded-for`, which is only sound when the app sits behind a
 * proxy that overwrites it. Deployed naked on a public port the header is
 * caller-controlled and the limit becomes advisory — noted in the README, and
 * the concurrency ceiling still holds regardless because it counts work rather
 * than callers.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export type Gated<T> = { ok: true; value: T } | { ok: false; response: Response };

/**
 * Applies the size ceiling and the token bucket, and returns parsed JSON.
 * Everything that can reject a request cheaply happens before any browser work
 * is scheduled.
 */
export async function readJsonRequest(request: Request): Promise<Gated<unknown>> {
  const key = clientKey(request);
  const verdict = limiter.take(key);
  if (!verdict.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many renders from this address. Try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(verdict.retryAfterSeconds),
            "X-RateLimit-Remaining": String(verdict.remaining),
          },
        },
      ),
    };
  }

  if (declaredTooLarge(request.headers.get("content-length"), MAX_BODY_BYTES)) {
    return { ok: false, response: tooLarge() };
  }

  let raw: string;
  try {
    raw = await readBoundedText(request.body, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return { ok: false, response: tooLarge() };
    return {
      ok: false,
      response: NextResponse.json({ error: "Could not read the request body." }, { status: 400 }),
    };
  }

  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Request body must be JSON." }, { status: 400 }),
    };
  }
}

function tooLarge(): Response {
  return NextResponse.json(
    { error: `Request body must be under ${Math.floor(MAX_BODY_BYTES / 1024)}KB.` },
    { status: 413 },
  );
}

/**
 * Runs the callback holding one of the render slots, queueing if they are all
 * taken and giving up rather than queueing forever.
 */
export async function withRenderSlot<T>(run: () => Promise<T>): Promise<Gated<T>> {
  let release: (() => void) | undefined;
  try {
    release = await slots.acquire(QUEUE_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof QueueTimeoutError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "The renderer is busy. Try again in a moment." },
          { status: 503, headers: { "Retry-After": "5" } },
        ),
      };
    }
    throw error;
  }

  try {
    return { ok: true, value: await run() };
  } finally {
    release();
  }
}

export function rendererLoad(): { active: number; queued: number; limit: number } {
  return { active: slots.active, queued: slots.queued, limit: CONCURRENCY };
}
