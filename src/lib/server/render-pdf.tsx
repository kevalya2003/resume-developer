import "server-only";

import { chromium, type Browser } from "playwright";
import type { Resume } from "../schema";
import { ResumeBody } from "../templates/document";
import { standaloneHtml } from "../templates/styles";
import {
  buildTokens,
  familiesFor,
  tokensToCssText,
  type Composition,
} from "../templates/tokens";
import { fontFaceCss } from "./font-embed";

/**
 * The PDF is produced from the same component and the same stylesheet as the
 * on-screen preview, serialised to a standalone HTML document. Nothing about
 * the export path re-implements the layout, so the two cannot drift.
 */

// A browser launch costs about a second. In dev the module is re-evaluated on
// every hot reload, so the instance is parked on globalThis to avoid leaking a
// new Chromium process per edit.
const globalForBrowser = globalThis as unknown as { __resumeBrowser?: Browser };

/**
 * Hinting is disabled so glyph advances do not get rounded to whole device
 * pixels. The client measures with subpixel positioning; if the renderer snaps
 * differently the two disagree about where a line wraps.
 */
function launchArgs(): string[] {
  const args = ["--font-render-hinting=none"];

  if (process.env.RESUME_CHROMIUM_NO_SANDBOX === "1") {
    // Set by the Dockerfile. The container already confines the process, and
    // keeping Chromium's own sandbox would mean granting SYS_ADMIN to the whole
    // container — a worse trade. Also moves shared memory off /dev/shm, which
    // Docker caps at 64MB by default and which Chromium will otherwise exhaust.
    args.push("--no-sandbox", "--disable-dev-shm-usage");
  }

  return args;
}

async function getBrowser(): Promise<Browser> {
  const existing = globalForBrowser.__resumeBrowser;
  if (existing && existing.isConnected()) return existing;
  const browser = await chromium.launch({ args: launchArgs() });
  globalForBrowser.__resumeBrowser = browser;
  return browser;
}

export interface RenderOptions {
  resume: Resume;
  composition: Composition;
  scale: number;
}

export interface RenderedPdf {
  pdf: Buffer;
  html: string;
}

/**
 * `react-dom/server` is imported at call time rather than at module scope.
 * The App Router rejects a static import of it, since in almost every other
 * context reaching for it means a Server Component was written by hand. Here
 * the whole point is to serialise the document outside the response.
 */
export async function buildResumeHtml({
  resume,
  composition,
  scale,
}: RenderOptions): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const bodyHtml = renderToStaticMarkup(
    <ResumeBody resume={resume} layout={composition.layout} />,
  );
  return standaloneHtml({
    bodyHtml,
    tokensCss: tokensToCssText(buildTokens(composition, scale)),
    layoutClass: `rd-l-${composition.layout}`,
    title: resume.basics.name || "Resume",
    fontFaceCss: await fontFaceCss(familiesFor(composition.type)),
  });
}

export async function renderResumePdf(options: RenderOptions): Promise<RenderedPdf> {
  const html = await buildResumeHtml(options);
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });

    // A font that failed to load does not throw, it substitutes — and a
    // substituted font silently invalidates the fit the client calculated.
    // Waiting is not enough; the load has to be asserted.
    //
    // Every embedded face is loaded explicitly rather than relying on the page
    // to pull them in. A browser only loads what it paints, so a family used
    // solely for bold headings never loads its regular weight, and a subset no
    // character falls into never loads at all. Both are legitimate, so asking
    // "is this family loaded?" answers the wrong question — the one that
    // matters is whether anything we embedded failed to decode.
    const expected = familiesFor(options.composition.type);
    const problems = await page.evaluate(async (families) => {
      const faces = [...document.fonts];
      const failed: string[] = [];

      await Promise.all(
        faces.map(async (face) => {
          try {
            await face.load();
          } catch {
            failed.push(`${face.family} ${face.weight} failed to decode`);
          }
        }),
      );
      await document.fonts.ready;

      for (const face of faces) {
        if (face.status !== "loaded") failed.push(`${face.family} ${face.weight} (${face.status})`);
      }

      // Catches the embedder omitting a family outright, which the loop above
      // cannot see because there would be no face to iterate.
      const present = new Set(faces.map((face) => face.family));
      for (const family of families) {
        if (!present.has(family)) failed.push(`${family} was never embedded`);
      }

      return failed;
    }, expected);

    if (problems.length > 0) {
      throw new Error(
        `Fonts did not load in the renderer: ${problems.join(", ")}. The PDF would have been set in a substitute and would not match the preview.`,
      );
    }

    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      // Margins live in the document's own padding. Setting them here as well
      // is the classic way to silently lose a page's worth of vertical space.
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
    });
    return { pdf, html };
  } finally {
    await page.close();
    await context.close();
  }
}

export async function closeBrowser(): Promise<void> {
  const browser = globalForBrowser.__resumeBrowser;
  globalForBrowser.__resumeBrowser = undefined;
  await browser?.close();
}
