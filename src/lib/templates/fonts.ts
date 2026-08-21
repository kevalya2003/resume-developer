/**
 * Every font the resume can use is shipped with the app.
 *
 * This is not a preference, it is a correctness requirement. The auto-fit scale
 * is measured in the user's browser, but the PDF is rendered by a Chromium
 * process that may be on another machine running another operating system. If
 * the two resolve a font stack differently — and they will, because Calibri and
 * Georgia do not exist on Linux — the client measures one set of line breaks and
 * the server prints another, and a document that fitted on screen spills onto a
 * second page in the file the user actually sends.
 *
 * Shipping metric-compatible open clones removes the variable entirely: both
 * sides load byte-identical woff2 files. The tradeoff is that a resume rendered
 * here is set in Carlito rather than Calibri. They are metrically identical, so
 * the difference is invisible at reading size, and it is a far smaller problem
 * than an unpredictable page count.
 */

import manifest from "./fonts.json";

export interface BundledFont {
  /** The family name used in CSS, and the name shipped in the woff2. */
  family: string;
  pkg: string;
  /** Filename stem used by fontsource: `<slug>-<subset>-<weight>-normal.woff2`. */
  slug: string;
  weights: number[];
  /**
   * Latin and latin-ext together cover accented European names, which is the
   * realistic ceiling for a resume. The client loads exactly these subsets and
   * the server embeds exactly these subsets, so both fall back identically on a
   * glyph neither covers. DejaVu Sans publishes no latin-ext, hence per-font.
   */
  subsets: string[];
  /** The proprietary font this is metrically compatible with, where one exists. */
  metricMatch: string | null;
  licence: string;
}

export const BUNDLED_FONTS: BundledFont[] = manifest.fonts;

const BY_FAMILY = new Map(BUNDLED_FONTS.map((font) => [font.family, font]));

export function findFont(family: string): BundledFont | undefined {
  return BY_FAMILY.get(family);
}

/**
 * Bare filename of one woff2, deliberately not a module specifier.
 *
 * An earlier version returned `@fontsource/carlito/files/...` and resolved it
 * with `require.resolve`. Turbopack statically analyses those calls, could not
 * see through the computed string, and turned every font read into a build
 * warning and a 500 at request time. Filenames are opaque to the bundler: the
 * files are copied into `public/fonts` by `scripts/sync-fonts.mjs` and read
 * with plain `fs` at runtime.
 *
 * The pattern is mirrored in that script; `tests/unit/fonts.test.ts` asserts
 * every file this produces actually exists, so the two cannot drift silently.
 */
export function fontFileName(font: BundledFont, subset: string, weight: number): string {
  return `${font.slug}-${subset}-${weight}-normal.woff2`;
}

/** Every woff2 the app needs, as (font, subset, weight) triples. */
export function allFontFiles(): Array<{ font: BundledFont; subset: string; weight: number }> {
  return BUNDLED_FONTS.flatMap((font) =>
    font.subsets.flatMap((subset) => font.weights.map((weight) => ({ font, subset, weight }))),
  );
}

/**
 * A stack always ends in a generic family. If a glyph is missing from the
 * bundled font the browser must still draw something, and `serif`/`sans-serif`
 * is a more predictable last resort than whatever happens to be installed.
 */
export function stack(family: string, generic: "serif" | "sans-serif"): string {
  const font = BY_FAMILY.get(family);
  const fallbacks = font?.metricMatch ? `"${font.metricMatch}", ` : "";
  return `"${family}", ${fallbacks}${generic}`;
}
