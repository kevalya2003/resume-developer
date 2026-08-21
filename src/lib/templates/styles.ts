/**
 * The resume document deliberately does not use Tailwind. The same markup and
 * the same stylesheet have to produce the on-screen preview and the PDF, and
 * the PDF is rendered from a standalone HTML string by Playwright with no build
 * step. Plain CSS driven by custom properties is the only way to guarantee the
 * preview and the export cannot drift apart.
 *
 * Page margins live on `.rd-page` padding and `@page` margin is zero. Setting
 * both is the classic way to lose ~20mm of vertical space without noticing,
 * because the two stack and the content silently spills onto a second page.
 */
export const resumeCss = String.raw`
.rd-page {
  box-sizing: border-box;
  width: var(--r-page-width);
  min-height: var(--r-page-height);
  padding: var(--r-page-margin-y) var(--r-page-margin-x);
  background: #ffffff;
  color: #111111;
  font-family: var(--r-font-body);
  font-size: var(--r-size-base);
  line-height: var(--r-line-height);
  -webkit-font-smoothing: antialiased;
}

.rd-page *, .rd-page *::before, .rd-page *::after { box-sizing: border-box; }

/* The fit solver needs the document's natural height. Leaving min-height in
   place would floor every measurement at one full page and the search would
   never see an overflow. */
.rd-measure .rd-page { min-height: 0; }

.rd-page p, .rd-page ul, .rd-page li, .rd-page h1, .rd-page h2, .rd-page h3 {
  margin: 0;
  padding: 0;
}

.rd-name {
  font-family: var(--r-font-heading);
  font-size: var(--r-size-name);
  font-weight: 700;
  letter-spacing: 0.4pt;
  line-height: 1.1;
  color: #111111;
}

.rd-headline {
  font-size: var(--r-size-small);
  color: var(--r-muted);
  margin-top: 1pt;
}

.rd-contact {
  font-size: var(--r-size-small);
  color: var(--r-muted);
  margin-top: 2pt;
}

.rd-contact-sep { padding: 0 3pt; color: #9ca3af; }

/* Links keep their label as real words. An icon-only link is invisible to a
   text extractor, which is the whole audience for the left half of this app. */
.rd-contact a {
  color: inherit;
  text-decoration: none;
  border-bottom: 0.5pt solid #b8bec7;
}

.rd-header { margin-bottom: var(--r-space-heading); }

.rd-section { margin-top: var(--r-space-section); }
.rd-section:first-of-type { margin-top: var(--r-space-heading); }

.rd-h2 {
  font-family: var(--r-font-heading);
  font-size: var(--r-size-heading);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1pt;
  color: #111111;
  margin-bottom: var(--r-space-heading);
}

.rd-item { margin-top: var(--r-space-item); }
.rd-item:first-child { margin-top: 0; }

.rd-item-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8pt;
}

.rd-item-title { font-weight: 700; }
.rd-item-org { font-weight: 400; }
.rd-item-meta {
  font-size: var(--r-size-small);
  color: var(--r-muted);
  white-space: nowrap;
}

.rd-bullets {
  list-style: disc;
  margin-top: var(--r-space-bullet);
  padding-left: var(--r-bullet-indent);
}
.rd-bullets li { margin-bottom: var(--r-space-bullet); }
.rd-bullets li:last-child { margin-bottom: 0; }

.rd-tech {
  font-size: var(--r-size-small);
  color: var(--r-muted);
  margin-top: var(--r-space-bullet);
}

.rd-skill-row { margin-bottom: var(--r-space-bullet); }
.rd-skill-row:last-child { margin-bottom: 0; }
.rd-skill-label { font-weight: 700; }

.rd-summary { margin: 0; }

.rd-edu-note { font-size: var(--r-size-small); color: var(--r-muted); }

.rd-link-inline {
  font-size: var(--r-size-small);
  color: var(--r-accent);
  text-decoration: none;
  border-bottom: 0.5pt solid currentColor;
}

/* ---------- Layout: classic ---------- */
.rd-l-classic .rd-header { text-align: center; }
.rd-l-classic .rd-h2 {
  border-bottom: 0.8pt solid var(--r-rule);
  padding-bottom: 1.5pt;
}

/* ---------- Layout: modern ---------- */
.rd-l-modern .rd-name { color: var(--r-accent); letter-spacing: 0; }
.rd-l-modern .rd-h2 {
  color: var(--r-accent);
  letter-spacing: 1.6pt;
  border: none;
}

/* ---------- Layout: compact ---------- */
.rd-l-compact .rd-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 10pt;
}
.rd-l-compact .rd-header-right { text-align: right; }
.rd-l-compact .rd-h2 {
  font-size: var(--r-size-small);
  letter-spacing: 0.8pt;
  border-bottom: 0.6pt solid var(--r-rule);
  padding-bottom: 1pt;
}
.rd-l-compact .rd-name { letter-spacing: 0; }

/* ---------- Layout: banner ---------- */
.rd-l-banner .rd-page-inner { margin: 0; }
.rd-l-banner .rd-header {
  background: var(--r-accent);
  color: #ffffff;
  margin: calc(-1 * var(--r-page-margin-y)) calc(-1 * var(--r-page-margin-x));
  margin-bottom: var(--r-space-heading);
  padding: calc(var(--r-page-margin-y) * 0.8) var(--r-page-margin-x);
}
.rd-l-banner .rd-name { color: #ffffff; }
.rd-l-banner .rd-headline,
.rd-l-banner .rd-contact { color: rgba(255, 255, 255, 0.88); }
.rd-l-banner .rd-contact a { color: #ffffff; border-bottom-color: rgba(255, 255, 255, 0.6); }
.rd-l-banner .rd-contact-sep { color: rgba(255, 255, 255, 0.6); }
.rd-l-banner .rd-h2 { color: var(--r-accent); border-bottom: 0.8pt solid var(--r-accent); padding-bottom: 1.5pt; }

/* ---------- Layout: editorial ---------- */
.rd-l-editorial .rd-name { letter-spacing: -0.2pt; font-weight: 400; }
.rd-l-editorial .rd-header {
  border-bottom: 1.6pt solid var(--r-accent);
  padding-bottom: calc(var(--r-space-heading) * 0.8);
}
.rd-l-editorial .rd-h2 {
  font-weight: 400;
  letter-spacing: 2pt;
  color: var(--r-accent);
  border-bottom: 0.4pt solid var(--r-rule);
  padding-bottom: 1.5pt;
}

/* ---------- Layout: technical ---------- */
.rd-l-technical .rd-h2 {
  border: none;
  padding-left: 5pt;
  border-left: 2.4pt solid var(--r-accent);
  letter-spacing: 0.9pt;
}
.rd-l-technical .rd-tech {
  font-family: "Consolas", "Menlo", "DejaVu Sans Mono", monospace;
  font-size: calc(var(--r-size-small) * 0.94);
  color: var(--r-accent);
}
.rd-l-technical .rd-name { letter-spacing: 0; }
.rd-l-technical .rd-header { border-bottom: 0.8pt solid var(--r-rule); padding-bottom: 3pt; }
`;

/** Wraps the rendered document in a standalone HTML file for the PDF renderer. */
export function standaloneHtml(opts: {
  bodyHtml: string;
  tokensCss: string;
  layoutClass: string;
  title: string;
  /** Base64 `@font-face` rules; the page has no origin, so nothing can be fetched. */
  fontFaceCss: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(opts.title)}</title>
<style>
${opts.fontFaceCss}
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.rd-root { ${opts.tokensCss} }
${resumeCss}
</style>
</head>
<body>
<div class="rd-root ${opts.layoutClass}">${opts.bodyHtml}</div>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
