/**
 * Bounds how many renders run at once.
 *
 * Each render holds a browser context, and a context costs tens of megabytes.
 * Rate limiting alone does not prevent that: a handful of callers each inside
 * their allowance can still arrive together and open more contexts than the
 * machine has memory for. This puts a hard ceiling on concurrent work and makes
 * everything else wait in line, so overload degrades into latency rather than
 * into the process being killed.
 *
 * Waiters time out, because a request that has been queued for thirty seconds
 * is one the caller has almost certainly abandoned, and finishing it only
 * steals a slot from someone still waiting.
 */

export class QueueTimeoutError extends Error {
  constructor(waitedMs: number) {
    super(`Timed out after ${waitedMs}ms waiting for a render slot.`);
    this.name = "QueueTimeoutError";
  }
}

export type Release = () => void;

interface Waiter {
  resolve: (release: Release) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class Semaphore {
  private readonly limit: number;
  private inFlight = 0;
  private readonly waiting: Waiter[] = [];

  constructor(limit: number) {
    if (limit < 1) throw new Error("Semaphore limit must be at least 1.");
    this.limit = limit;
  }

  get active(): number {
    return this.inFlight;
  }

  get queued(): number {
    return this.waiting.length;
  }

  async acquire(timeoutMs: number): Promise<Release> {
    if (this.inFlight < this.limit) {
      this.inFlight += 1;
      return this.releaseOnce();
    }

    return new Promise<Release>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.waiting.indexOf(waiter);
          if (index !== -1) this.waiting.splice(index, 1);
          reject(new QueueTimeoutError(timeoutMs));
        }, timeoutMs),
      };
      this.waiting.push(waiter);
    });
  }

  /**
   * Guards against a caller releasing twice, which would let the ceiling drift
   * upwards until it stopped meaning anything.
   */
  private releaseOnce(): Release {
    let released = false;
    return () => {
      if (released) return;
      released = true;

      const next = this.waiting.shift();
      if (next) {
        clearTimeout(next.timer);
        // The slot passes straight to the next waiter; inFlight is unchanged
        // because one holder is simply replaced by another.
        next.resolve(this.releaseOnce());
        return;
      }
      this.inFlight -= 1;
    };
  }
}
