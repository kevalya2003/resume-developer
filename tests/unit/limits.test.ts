import { describe, expect, it } from "vitest";
import { declaredTooLarge, PayloadTooLargeError, readBoundedText } from "@/lib/limits/body";
import { RateLimiter } from "@/lib/limits/rate-limit";
import { QueueTimeoutError, Semaphore } from "@/lib/limits/semaphore";

/**
 * These protect the two endpoints that launch a browser. The failure they guard
 * against is not a wrong answer but an unavailable service, so the tests are
 * about exhaustion: too many requests, too much body, too much at once.
 */

class Clock {
  constructor(private ms = 0) {}
  now = () => this.ms;
  advance(seconds: number) {
    this.ms += seconds * 1000;
  }
}

describe("rate limiter", () => {
  it("allows a burst up to capacity and then refuses", () => {
    const clock = new Clock();
    const limiter = new RateLimiter({ capacity: 3, refillPerSecond: 1, now: clock.now });

    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(false);
  });

  it("refills over time", () => {
    const clock = new Clock();
    const limiter = new RateLimiter({ capacity: 2, refillPerSecond: 0.5, now: clock.now });

    limiter.take("a");
    limiter.take("a");
    expect(limiter.take("a").allowed).toBe(false);

    clock.advance(2);
    expect(limiter.take("a").allowed).toBe(true);
  });

  it("never refills past capacity, so idling does not buy a bigger burst", () => {
    const clock = new Clock();
    const limiter = new RateLimiter({ capacity: 2, refillPerSecond: 1, now: clock.now });

    clock.advance(3600);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(false);
  });

  it("keeps callers independent", () => {
    const clock = new Clock();
    const limiter = new RateLimiter({ capacity: 1, refillPerSecond: 1, now: clock.now });

    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(false);
    expect(limiter.take("b").allowed).toBe(true);
  });

  it("reports a retry delay a client can act on", () => {
    const clock = new Clock();
    const limiter = new RateLimiter({ capacity: 1, refillPerSecond: 0.5, now: clock.now });

    limiter.take("a");
    const denied = limiter.take("a");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBe(2);
  });

  it("evicts idle callers so rotating addresses cannot grow the map for ever", () => {
    const clock = new Clock();
    const limiter = new RateLimiter({
      capacity: 1,
      refillPerSecond: 1,
      now: clock.now,
      idleEvictionMs: 1000,
    });

    for (let i = 0; i < 50; i += 1) {
      clock.advance(0.001);
      limiter.take(`caller-${i}`);
    }
    expect(limiter.size).toBe(50);

    // Long enough that every bucket has refilled and gone idle.
    clock.advance(60);
    limiter.take("someone-new");
    expect(limiter.size).toBe(1);
  });
});

describe("semaphore", () => {
  it("runs up to the limit immediately", async () => {
    const slots = new Semaphore(2);
    await slots.acquire(50);
    await slots.acquire(50);
    expect(slots.active).toBe(2);
    expect(slots.queued).toBe(0);
  });

  it("queues beyond the limit and hands the slot on when one is released", async () => {
    const slots = new Semaphore(1);
    const first = await slots.acquire(1000);

    let granted = false;
    const second = slots.acquire(1000).then((release) => {
      granted = true;
      return release;
    });

    expect(granted).toBe(false);
    expect(slots.queued).toBe(1);

    first();
    await second;
    expect(granted).toBe(true);
    expect(slots.active).toBe(1);
  });

  it("gives up rather than queueing for ever", async () => {
    const slots = new Semaphore(1);
    await slots.acquire(1000);

    await expect(slots.acquire(10)).rejects.toBeInstanceOf(QueueTimeoutError);
    // The abandoned waiter must not still be holding a place in the queue.
    expect(slots.queued).toBe(0);
  });

  it("ignores a double release, which would otherwise lift the ceiling", async () => {
    const slots = new Semaphore(1);
    const release = await slots.acquire(50);

    release();
    release();

    expect(slots.active).toBe(0);
    await slots.acquire(50);
    expect(slots.active).toBe(1);
  });

  it("serialises work so no more than the limit runs at once", async () => {
    const slots = new Semaphore(2);
    let running = 0;
    let peak = 0;

    await Promise.all(
      Array.from({ length: 8 }, async () => {
        const release = await slots.acquire(1000);
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
        release();
      }),
    );

    expect(peak).toBe(2);
  });
});

describe("bounded body reader", () => {
  function streamOf(...parts: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        for (const part of parts) controller.enqueue(encoder.encode(part));
        controller.close();
      },
    });
  }

  it("reads a body that is within the limit", async () => {
    expect(await readBoundedText(streamOf('{"a":', "1}"), 1024)).toBe('{"a":1}');
  });

  it("rejects once the running total passes the limit", async () => {
    await expect(readBoundedText(streamOf("x".repeat(100)), 50)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });

  it("stops at the limit rather than after buffering everything", async () => {
    // The third chunk must never be pulled: that is the difference between a
    // bounded cost and one the sender chooses.
    let pulled = 0;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(encoder.encode("x".repeat(40)));
      },
    });

    await expect(readBoundedText(stream, 50)).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(pulled).toBe(2);
  });

  it("handles a multi-byte character split across chunks", async () => {
    // "é" is two bytes; splitting it must not produce a replacement character.
    const encoder = new TextEncoder();
    const bytes = encoder.encode("café");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 4));
        controller.enqueue(bytes.slice(4));
        controller.close();
      },
    });

    expect(await readBoundedText(stream, 1024)).toBe("café");
  });

  it("treats an absent body as empty", async () => {
    expect(await readBoundedText(null, 1024)).toBe("");
  });

  it("believes an oversized content-length but does not require one", () => {
    expect(declaredTooLarge("2048", 1024)).toBe(true);
    expect(declaredTooLarge("512", 1024)).toBe(false);
    expect(declaredTooLarge(null, 1024)).toBe(false);
    expect(declaredTooLarge("not-a-number", 1024)).toBe(false);
  });
});
