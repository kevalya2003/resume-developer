import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { cloneSample } from "../../src/lib/sample-resume";
import { defaultComposition } from "../../src/lib/templates/tokens";

/**
 * These exercise the two claims the product actually makes: that the exported
 * PDF holds the page count you asked for, and that the text an applicant
 * tracking system reads back matches what you wrote. Both require a real
 * browser and a real render, so they live here rather than in the unit suite.
 */

async function countPdfPages(bytes: Buffer): Promise<number> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const doc = await task.promise;
  const pages = doc.numPages;
  await task.destroy();
  return pages;
}

async function renderPdf(request: APIRequestContext, scale = 1) {
  const response = await request.post("/api/render", {
    data: { resume: cloneSample(), composition: defaultComposition, scale },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  return Buffer.from(await response.body());
}

test.describe("editor", () => {
  test("loads with the sample document and a live preview", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Resume Developer" })).toBeVisible();
    await expect(page.locator(".rd-page .rd-name")).toHaveText("Priya Raman");
    await expect(page.locator(".rd-page .rd-h2").first()).toHaveText("Summary");
  });

  test("edits flow straight into the preview", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Name", { exact: true }).fill("Kevalya Gupta");

    await expect(page.locator(".rd-page .rd-name")).toHaveText("Kevalya Gupta");
  });

  test("changing the template changes the rendered composition", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Template" }).click();

    await page.getByRole("button", { name: /^Technical/ }).click();
    await page.getByRole("button", { name: /^EB Garamond/ }).click();

    const root = page.locator(".rd-root").first();
    await expect(root).toHaveAttribute("data-composition", /^technical-garamond-/);
  });

  test("auto-fit reports a verdict for the sample resume", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Fits (at full size|after tightening)/)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("content survives a reload because it is stored locally", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Name", { exact: true }).fill("Persisted Name");
    await expect(page.locator(".rd-page .rd-name")).toHaveText("Persisted Name");

    // The editor debounces its write, so give it a beat before reloading.
    await page.waitForTimeout(800);
    await page.reload();

    await expect(page.locator(".rd-page .rd-name")).toHaveText("Persisted Name");
  });
});

test.describe("export", () => {
  test("renders a single-page A4 PDF", async ({ request }) => {
    const pdf = await renderPdf(request);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(await countPdfPages(pdf)).toBe(1);
  });

  test("rejects a malformed document rather than rendering nonsense", async ({ request }) => {
    const response = await request.post("/api/render", {
      data: { resume: { version: 2 }, composition: defaultComposition, scale: 1 },
    });
    expect(response.status()).toBe(400);
  });

  test("every layout renders to a valid PDF", async ({ request }) => {
    for (const layout of ["classic", "modern", "compact", "banner", "editorial", "technical"]) {
      const response = await request.post("/api/render", {
        data: {
          resume: cloneSample(),
          composition: { ...defaultComposition, layout },
          scale: 0.95,
        },
      });
      expect(response.status(), `layout ${layout} should render`).toBe(200);
      const bytes = Buffer.from(await response.body());
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    }
  });
});

test.describe("fit agreement between preview and export", () => {
  /**
   * The regression test for the class of bug where the browser measures with
   * one set of fonts and the server prints with another. The document below is
   * long enough that auto-fit must tighten it, so the exported page count
   * depends entirely on the server reproducing the browser's line breaking. If
   * the two ever diverge, this comes back as a two-page PDF.
   */
  function denseResume() {
    const resume = cloneSample();
    const filler = [
      "Rewrote the nightly job so a failure reports which service regressed, cutting triage from an hour to a glance.",
      "Replaced shared fixtures with per-worker tenants, which removed the last source of cross-test interference.",
      "Added schema assertions to the ingestion path so malformed events fail loudly at the boundary.",
      "Cut container start-up from 90 seconds to 12 by pinning base images and caching the dependency layer.",
      "Introduced a quarantine list so known-flaky tests stop masking real regressions in the signal.",
      "Documented the environment matrix so a new engineer can run the suite locally on their first day.",
      "Backfilled coverage for the payments edge cases that had only ever been tested by hand.",
      "Moved secrets out of the job configuration into the vault, removing them from every build log.",
      "Split the monolithic suite into tagged subsets so a pull request runs in four minutes, not forty.",
      "Wired the results into a dashboard so the trend is visible without opening a build.",
      "Added retries only at the network boundary, so a genuine assertion failure can no longer be retried away.",
      "Standardised test data creation behind a factory, which removed 300 lines of duplicated setup.",
      "Captured browser traces on failure so an intermittent break leaves behind something to read.",
      "Aligned the staging schema with production so environment drift stopped producing phantom failures.",
      "Pinned the browser version in CI so an upstream release can no longer break the suite overnight.",
      "Replaced sleep-based waits with explicit conditions, which removed the bulk of the intermittent failures.",
      "Published a weekly flake report so the worst offenders get fixed instead of quietly retried.",
      "Seeded reference data through migrations so a fresh environment is usable without manual setup.",
    ];
    const experience = resume.sections.find((s) => s.kind === "experience");
    if (experience?.kind === "experience") {
      const half = Math.ceil(filler.length / 2);
      experience.items[0].bullets.push(...filler.slice(0, half));
      experience.items[1].bullets.push(...filler.slice(half));
    }
    return resume;
  }

  test("a document that needs tightening still exports as one page", async ({ page }) => {
    await page.goto("/");
    await page.evaluate((resume) => {
      window.localStorage.setItem(
        "resume-developer:v1",
        JSON.stringify({
          resume,
          composition: { layout: "classic", type: "carlito", density: "normal", accent: "ink" },
          targetPages: 1,
          autoFit: true,
        }),
      );
    }, denseResume());
    await page.reload();

    // The browser must have decided it needs to shrink; otherwise this test is
    // silently exercising the easy path. Matching any verdict first means a
    // fixture that drifts out of that band says so, instead of timing out with
    // nothing to go on.
    const verdict = page.getByText(/Fits (at full size|after tightening)|too long/);
    await expect(verdict).toBeVisible({ timeout: 20_000 });
    expect(await verdict.textContent(), "fixture should land in the tightened band").toMatch(
      /after tightening/,
    );

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download PDF" }).click(),
    ]);
    const file = await download.path();
    const bytes = readFileSync(file);

    expect(await countPdfPages(bytes)).toBe(1);
  });

  test("every type pairing loads its fonts in the renderer", async ({ request }) => {
    // The render route asserts that the families actually loaded rather than
    // letting Chromium substitute, so a missing font surfaces as a 500 here.
    for (const type of ["carlito", "arimo", "gelasio", "tinos", "garamond", "dejavu"]) {
      const response = await request.post("/api/render", {
        data: {
          resume: cloneSample(),
          composition: { layout: "classic", type, density: "normal", accent: "ink" },
          scale: 1,
        },
      });
      // The route reports why it failed in the body; without it a regression
      // here is just "500" and someone has to reproduce it by hand to learn
      // which font did not load.
      const detail = response.status() === 200 ? "" : `: ${(await response.text()).slice(0, 300)}`;
      expect(response.status(), `type ${type} should render${detail}`).toBe(200);
    }
  });

  test("the exported PDF embeds its fonts rather than relying on the host", async ({
    request,
  }) => {
    const pdf = await renderPdf(request);
    // A PDF that embeds a subset names it with a six-letter tag, e.g. ABCDEF+Carlito.
    expect(pdf.toString("latin1")).toMatch(/[A-Z]{6}\+Carlito/);
  });
});

test.describe("ATS verification", () => {
  test("reads the exported PDF back and recovers the contact details", async ({ request }) => {
    const response = await request.post("/api/ats", {
      data: { resume: cloneSample(), composition: defaultComposition, scale: 1 },
    });
    expect(response.status()).toBe(200);

    const { report, extractedText } = await response.json();

    expect(report.recovered.email).toBe("priya.raman@example.com");
    expect(report.pageCount).toBe(1);
    expect(extractedText).toContain("Priya Raman");

    const byId = Object.fromEntries(
      report.findings.map((f: { id: string; status: string }) => [f.id, f.status]),
    );
    expect(byId.email).toBe("pass");
    expect(byId.name).toBe("pass");
    // The whole reason every layout is single column.
    expect(byId["reading-order"]).toBe("pass");
    expect(byId.headings).toBe("pass");
  });

  test("the check is reachable from the UI", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "ATS" }).click();
    await page.getByRole("button", { name: "Run the check" }).click();

    await expect(page.getByText("Email recovered")).toBeVisible({ timeout: 60_000 });
  });
});
