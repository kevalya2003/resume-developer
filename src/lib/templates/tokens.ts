import { stack } from "./fonts";

/**
 * A template here is a composition, not a file: layout × type pairing × density
 * × accent. Six layouts, six type pairings, three densities and ten accents
 * gives 1,080 distinct templates from six hand-built layouts, and every one of
 * them inherits the properties that make the layouts safe.
 *
 * Every layout is single column. Two-column resumes with sidebars are the most
 * common cause of ATS parse failures, because a text extractor reads the PDF in
 * content order and interleaves the columns into nonsense. Ruling them out at
 * the layout level is what lets the app claim ATS safety by construction rather
 * than by hope, and the parse-back check exists to prove it.
 */

export const LAYOUTS = [
  { id: "classic", name: "Classic", note: "Centred header, ruled section headings" },
  { id: "modern", name: "Modern", note: "Left header, accent headings, no rules" },
  { id: "compact", name: "Compact", note: "Dense spacing for content-heavy resumes" },
  { id: "banner", name: "Banner", note: "Accent band behind the name block" },
  { id: "editorial", name: "Editorial", note: "Large name, generous whitespace, thin rules" },
  { id: "technical", name: "Technical", note: "Accent bar headings, prominent tech lines" },
] as const;
export type LayoutId = (typeof LAYOUTS)[number]["id"];

/**
 * Each pairing names the families it uses, and `fonts.ts` turns those into
 * stacks. Only bundled families may appear here: a stack that could resolve to
 * a font the server does not have would break the fit guarantee. See the note
 * at the top of `fonts.ts`.
 */
export const TYPE_PAIRINGS = [
  {
    id: "carlito",
    name: "Carlito",
    note: "Metrically identical to Calibri",
    headingFamily: "Carlito",
    bodyFamily: "Carlito",
    generic: "sans-serif",
    baseSize: 10.2,
    lineHeight: 1.28,
    nameScale: 1.9,
    headingScale: 1.0,
  },
  {
    id: "arimo",
    name: "Arimo",
    note: "Metrically identical to Arial",
    headingFamily: "Arimo",
    bodyFamily: "Arimo",
    generic: "sans-serif",
    baseSize: 9.8,
    lineHeight: 1.3,
    nameScale: 1.85,
    headingScale: 0.98,
  },
  {
    id: "gelasio",
    name: "Gelasio + Arimo",
    note: "Georgia-compatible serif with a sans heading",
    headingFamily: "Arimo",
    bodyFamily: "Gelasio",
    generic: "serif",
    baseSize: 9.8,
    lineHeight: 1.32,
    nameScale: 1.8,
    headingScale: 0.95,
  },
  {
    id: "tinos",
    name: "Tinos",
    note: "Metrically identical to Times New Roman",
    headingFamily: "Tinos",
    bodyFamily: "Tinos",
    generic: "serif",
    baseSize: 10.6,
    lineHeight: 1.26,
    nameScale: 1.9,
    headingScale: 1.0,
  },
  {
    id: "garamond",
    name: "EB Garamond",
    note: "Editorial serif, generous whitespace",
    headingFamily: "Arimo",
    bodyFamily: "EB Garamond",
    generic: "serif",
    baseSize: 11,
    lineHeight: 1.24,
    nameScale: 1.85,
    headingScale: 0.92,
  },
  {
    id: "dejavu",
    name: "DejaVu Sans",
    note: "Wide and highly legible, in the Verdana mould",
    headingFamily: "DejaVu Sans",
    bodyFamily: "DejaVu Sans",
    generic: "sans-serif",
    baseSize: 9,
    lineHeight: 1.34,
    nameScale: 1.7,
    headingScale: 0.95,
  },
] as const;
export type TypePairingId = (typeof TYPE_PAIRINGS)[number]["id"];

/** The bundled families a pairing needs, for embedding into the PDF. */
export function familiesFor(id: TypePairingId): string[] {
  const type = TYPE_PAIRINGS.find((t) => t.id === id) ?? TYPE_PAIRINGS[0];
  return Array.from(new Set([type.bodyFamily, type.headingFamily]));
}

export const DENSITIES = [
  { id: "comfortable", name: "Comfortable", space: 1.18, margin: 14 },
  { id: "normal", name: "Normal", space: 1.0, margin: 12 },
  { id: "compact", name: "Compact", space: 0.84, margin: 10 },
] as const;
export type DensityId = (typeof DENSITIES)[number]["id"];

export const ACCENTS = [
  { id: "ink", name: "Ink", value: "#111827" },
  { id: "slate", name: "Slate", value: "#334155" },
  { id: "navy", name: "Navy", value: "#1e3a5f" },
  { id: "ocean", name: "Ocean", value: "#0369a1" },
  { id: "teal", name: "Teal", value: "#0f766e" },
  { id: "forest", name: "Forest", value: "#166534" },
  { id: "burgundy", name: "Burgundy", value: "#7f1d1d" },
  { id: "rust", name: "Rust", value: "#9a3412" },
  { id: "plum", name: "Plum", value: "#6b21a8" },
  { id: "graphite", name: "Graphite", value: "#3f3f46" },
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];

export interface Composition {
  layout: LayoutId;
  type: TypePairingId;
  density: DensityId;
  accent: AccentId;
}

export const defaultComposition: Composition = {
  layout: "classic",
  type: "carlito",
  density: "normal",
  accent: "ink",
};

export function totalCompositions(): number {
  return LAYOUTS.length * TYPE_PAIRINGS.length * DENSITIES.length * ACCENTS.length;
}

export function compositionId(c: Composition): string {
  return `${c.layout}-${c.type}-${c.density}-${c.accent}`;
}

export function parseCompositionId(id: string): Composition | null {
  const parts = id.split("-");
  if (parts.length !== 4) return null;
  const [layout, type, density, accent] = parts;
  const valid =
    LAYOUTS.some((l) => l.id === layout) &&
    TYPE_PAIRINGS.some((t) => t.id === type) &&
    DENSITIES.some((d) => d.id === density) &&
    ACCENTS.some((a) => a.id === accent);
  if (!valid) return null;
  return {
    layout: layout as LayoutId,
    type: type as TypePairingId,
    density: density as DensityId,
    accent: accent as AccentId,
  };
}

export const A4 = { widthMm: 210, heightMm: 297 } as const;
export const MM_PER_PT = 25.4 / 72;

export interface PageGeometry {
  widthMm: number;
  heightMm: number;
  marginXMm: number;
  marginYMm: number;
  contentWidthMm: number;
  contentHeightMm: number;
}

/**
 * Vertical margin shrinks with the fit scale but never below 8mm. Printers
 * clip below roughly 6mm and a resume that loses its last line on someone
 * else's printer is worse than one that spills to a second page.
 */
export function pageGeometry(density: DensityId, scale = 1): PageGeometry {
  const preset = DENSITIES.find((d) => d.id === density) ?? DENSITIES[1];
  const marginXMm = Math.max(9, preset.margin * (0.85 + 0.15 * scale));
  const marginYMm = Math.max(8, preset.margin * scale);
  return {
    widthMm: A4.widthMm,
    heightMm: A4.heightMm,
    marginXMm,
    marginYMm,
    contentWidthMm: A4.widthMm - marginXMm * 2,
    contentHeightMm: A4.heightMm - marginYMm * 2,
  };
}

export type TokenMap = Record<string, string>;

/**
 * Spacing is scaled by `scale ** 1.6` while type is scaled linearly. When a
 * resume needs to lose height, whitespace should give way before the words do —
 * squeezing gaps by 20% is invisible, dropping the body text by 20% is not.
 */
export function buildTokens(c: Composition, scale = 1): TokenMap {
  const type = TYPE_PAIRINGS.find((t) => t.id === c.type) ?? TYPE_PAIRINGS[0];
  const density = DENSITIES.find((d) => d.id === c.density) ?? DENSITIES[1];
  const accent = ACCENTS.find((a) => a.id === c.accent) ?? ACCENTS[0];

  const base = type.baseSize * scale;
  const space = density.space * Math.pow(scale, 1.6);
  const geo = pageGeometry(c.density, scale);

  return {
    "--r-font-body": stack(type.bodyFamily, type.generic),
    "--r-font-heading": stack(type.headingFamily, type.generic),
    "--r-size-base": `${base.toFixed(3)}pt`,
    "--r-size-name": `${(base * type.nameScale).toFixed(3)}pt`,
    "--r-size-heading": `${(base * type.headingScale).toFixed(3)}pt`,
    "--r-size-small": `${(base * 0.93).toFixed(3)}pt`,
    "--r-line-height": type.lineHeight.toFixed(3),
    "--r-accent": accent.value,
    "--r-rule": "#9ca3af",
    "--r-muted": "#4b5563",
    "--r-space-section": `${(9 * space).toFixed(3)}pt`,
    "--r-space-item": `${(5 * space).toFixed(3)}pt`,
    "--r-space-bullet": `${(1.4 * space).toFixed(3)}pt`,
    "--r-space-heading": `${(3 * space).toFixed(3)}pt`,
    "--r-bullet-indent": `${(13 * Math.pow(scale, 0.5)).toFixed(3)}pt`,
    "--r-page-width": `${geo.widthMm}mm`,
    "--r-page-height": `${geo.heightMm}mm`,
    "--r-page-margin-x": `${geo.marginXMm.toFixed(3)}mm`,
    "--r-page-margin-y": `${geo.marginYMm.toFixed(3)}mm`,
  };
}

export function tokensToCssText(tokens: TokenMap): string {
  return Object.entries(tokens)
    .map(([k, v]) => `${k}: ${v};`)
    .join("\n  ");
}
