import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { allFontFiles, findFont, fontFileName, type BundledFont } from "../templates/fonts";
import ranges from "../templates/generated/unicode-ranges.json";

/**
 * Emits `@font-face` rules whose `src` is the font itself, base64 encoded.
 *
 * The PDF is produced with `page.setContent`, so the page has no origin and any
 * relative font URL would simply fail to load — silently, leaving Chromium to
 * substitute a default and quietly invalidate the fit the client calculated.
 * Inlining removes the fetch entirely, which also means the renderer needs no
 * network access and cannot be made slow by one.
 *
 * Only the families the chosen pairing actually uses are embedded, so a render
 * carries roughly 200KB of font rather than the full 1.2MB of all six.
 *
 * Files come from `public/fonts`, populated by `scripts/sync-fonts.mjs`. They
 * are read with an ordinary path rather than resolved as modules because the
 * specifier is computed and Turbopack cannot follow it — see fontFileName().
 */

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

// Font files never change for a given install, so the base64 is computed once
// per process. Re-encoding on every render would dominate the request.
const cache = new Map<string, string>();

async function encodeFont(fileName: string): Promise<string> {
  const cached = cache.get(fileName);
  if (cached) return cached;

  const file = path.join(FONT_DIR, fileName);
  let bytes: Buffer;
  try {
    bytes = await readFile(file);
  } catch (cause) {
    throw new Error(
      `Font file missing: ${fileName}. Run \`npm run sync-fonts\` to copy it from node_modules.`,
      { cause },
    );
  }

  const encoded = bytes.toString("base64");
  cache.set(fileName, encoded);
  return encoded;
}

/**
 * The range decides which file the renderer picks for a given character. It has
 * to match what the browser used byte for byte, or an accented name is measured
 * in one file on the client and drawn from another in the PDF. Both sides read
 * the generated map, so they agree by construction.
 *
 * Single-subset families have no entry and get no range, which correctly means
 * "use this file for everything".
 */
function unicodeRange(slug: string, subset: string): string | undefined {
  return (ranges as Record<string, Record<string, string> | undefined>)[slug]?.[subset];
}

function faceRule(font: BundledFont, subset: string, weight: number, encoded: string): string {
  const range = unicodeRange(font.slug, subset);
  // font-display: block — the renderer must never paint a fallback, even for a
  // frame, because that frame could be the one that gets printed.
  return `@font-face {
  font-family: "${font.family}";
  font-style: normal;
  font-weight: ${weight};
  font-display: block;
  src: url(data:font/woff2;charset=utf-8;base64,${encoded}) format("woff2");${
    range ? `\n  unicode-range: ${range};` : ""
  }
}`;
}

export async function fontFaceCss(families: string[]): Promise<string> {
  const seen = new Set<string>();
  const wanted: BundledFont[] = [];
  for (const family of families) {
    const font = findFont(family);
    if (font && !seen.has(font.family)) {
      seen.add(font.family);
      wanted.push(font);
    }
  }

  const rules = await Promise.all(
    wanted.flatMap((font) =>
      font.subsets.flatMap((subset) =>
        font.weights.map(async (weight) =>
          faceRule(font, subset, weight, await encodeFont(fontFileName(font, subset, weight))),
        ),
      ),
    ),
  );

  return rules.join("\n");
}

/**
 * Fails fast if the synced font directory is incomplete.
 *
 * A render that silently falls back is the exact failure this module exists to
 * prevent, so it should never be possible to discover it from a user's PDF.
 */
export async function verifyFontsResolvable(): Promise<void> {
  const missing: string[] = [];
  await Promise.all(
    allFontFiles().map(async ({ font, subset, weight }) => {
      const name = fontFileName(font, subset, weight);
      try {
        await readFile(path.join(FONT_DIR, name));
      } catch {
        missing.push(name);
      }
    }),
  );

  if (missing.length > 0) {
    throw new Error(
      `Bundled fonts are missing from public/fonts:\n  ${missing.sort().join("\n  ")}\n` +
        "Run `npm run sync-fonts`.",
    );
  }
}
