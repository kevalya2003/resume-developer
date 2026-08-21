import { expect, test } from "@playwright/test";
import { cloneSample } from "../../src/lib/sample-resume";
import { defaultComposition } from "../../src/lib/templates/tokens";

/**
 * The render endpoints are unauthenticated and each one starts real browser
 * work, so the protection around them is load-bearing rather than decorative.
 * These drive the actual HTTP surface, because the interesting part is not that
 * the limiter counts correctly — the unit suite covers that — but that it is
 * wired into the request path ahead of anything expensive.
 *
 * Each test presents its own forwarded-for address so it gets a private bucket
 * and cannot spend the allowance the rest of the suite is relying on.
 */

let addressCounter = 0;
function freshAddress(): string {
  addressCounter += 1;
  return `203.0.113.${addressCounter}`;
}

test.describe("request limits", () => {
  test("refuses a body far larger than any resume", async ({ request }) => {
    // A megabyte of padding inside an otherwise valid document.
    const resume = cloneSample();
    resume.basics.headline = "x".repeat(1024 * 1024);

    const response = await request.post("/api/render", {
      headers: { "x-forwarded-for": freshAddress() },
      data: { resume, composition: defaultComposition, scale: 1 },
    });

    expect(response.status()).toBe(413);
    expect((await response.json()).error).toMatch(/under \d+KB/);
  });

  test("stops a caller who keeps asking, and says when to come back", async ({ request }) => {
    const address = freshAddress();
    let limited: number | null = null;

    // Malformed bodies are rejected long before any rendering, so this costs
    // the server almost nothing while still spending the caller's allowance —
    // which is the property being asserted.
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const response = await request.post("/api/render", {
        headers: { "x-forwarded-for": address, "content-type": "application/json" },
        data: { nonsense: true },
      });

      if (response.status() === 429) {
        expect(Number(response.headers()["retry-after"]), "retry-after").toBeGreaterThan(0);
        limited = attempt;
        break;
      }
      expect(response.status(), "should be rejected as invalid until rate limited").toBe(400);
    }

    expect(limited, "a caller hammering the endpoint should eventually be limited").not.toBeNull();
  });

  test("limits each caller separately", async ({ request }) => {
    const address = freshAddress();
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const response = await request.post("/api/render", {
        headers: { "x-forwarded-for": address },
        data: { nonsense: true },
      });
      if (response.status() === 429) break;
    }

    // A different caller must be unaffected by the one above.
    const other = await request.post("/api/render", {
      headers: { "x-forwarded-for": freshAddress() },
      data: { nonsense: true },
    });
    expect(other.status()).toBe(400);
  });

  test("rejects a malformed body without spending a render slot", async ({ request }) => {
    const response = await request.post("/api/render", {
      headers: { "x-forwarded-for": freshAddress(), "content-type": "application/json" },
      data: "not json at all",
    });
    expect([400, 413]).toContain(response.status());

    // The renderer must still be idle and able to serve a real request.
    const health = await request.get("/api/health");
    expect((await health.json()).load.active).toBe(0);
  });
});

test.describe("health", () => {
  test("reports the fonts and the renderer load", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    // The check that matters: a build without synced fonts would serve PDFs in
    // the wrong typeface rather than failing, so health has to notice.
    expect(body.fonts).toBe("complete");
    expect(body.load.limit).toBeGreaterThan(0);
  });

  test("is cheap enough to poll, because it never starts a browser", async ({ request }) => {
    const started = Date.now();
    for (let i = 0; i < 5; i += 1) {
      expect((await request.get("/api/health")).status()).toBe(200);
    }
    // A Chromium launch alone is roughly a second; five probes well under that
    // shows the probe is not doing any.
    expect(Date.now() - started).toBeLessThan(1500);
  });
});
