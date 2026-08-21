import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cloneSample } from "@/lib/sample-resume";
import { ResumeBody } from "@/lib/templates/document";
import {
  ACCENTS,
  buildTokens,
  compositionId,
  DENSITIES,
  LAYOUTS,
  pageGeometry,
  parseCompositionId,
  totalCompositions,
  TYPE_PAIRINGS,
  type Composition,
} from "@/lib/templates/tokens";

const base: Composition = {
  layout: "classic",
  type: "carlito",
  density: "normal",
  accent: "ink",
};

function pt(value: string): number {
  return Number.parseFloat(value.replace("pt", ""));
}

describe("composition space", () => {
  it("advertises the number of templates it can actually produce", () => {
    const expected =
      LAYOUTS.length * TYPE_PAIRINGS.length * DENSITIES.length * ACCENTS.length;
    expect(totalCompositions()).toBe(expected);
    expect(totalCompositions()).toBeGreaterThan(1000);
  });

  it("round-trips a composition through its id", () => {
    for (const layout of LAYOUTS) {
      const composition: Composition = { ...base, layout: layout.id };
      expect(parseCompositionId(compositionId(composition))).toEqual(composition);
    }
  });

  it("rejects an id that names something that does not exist", () => {
    expect(parseCompositionId("nope-calibri-normal-ink")).toBeNull();
    expect(parseCompositionId("classic-calibri-normal")).toBeNull();
  });
});

describe("token scaling", () => {
  it("shrinks whitespace faster than type", () => {
    const full = buildTokens(base, 1);
    const tight = buildTokens(base, 0.9);

    const typeRatio = pt(tight["--r-size-base"]) / pt(full["--r-size-base"]);
    const spaceRatio = pt(tight["--r-space-section"]) / pt(full["--r-space-section"]);

    // Losing height should cost gaps before it costs legibility.
    expect(typeRatio).toBeCloseTo(0.9, 3);
    expect(spaceRatio).toBeLessThan(typeRatio);
  });

  it("keeps the name proportionally larger than the body at every scale", () => {
    for (const scale of [1, 0.9, 0.8]) {
      const tokens = buildTokens(base, scale);
      expect(pt(tokens["--r-size-name"])).toBeGreaterThan(pt(tokens["--r-size-base"]) * 1.5);
    }
  });

  it("never lets the printable margin collapse past a printer's limits", () => {
    const geometry = pageGeometry("compact", 0.5);
    expect(geometry.marginYMm).toBeGreaterThanOrEqual(8);
    expect(geometry.marginXMm).toBeGreaterThanOrEqual(9);
  });

  it("produces a real accent colour for every accent", () => {
    for (const accent of ACCENTS) {
      const tokens = buildTokens({ ...base, accent: accent.id });
      expect(tokens["--r-accent"]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("document rendering", () => {
  const resume = cloneSample();

  it("renders every layout without throwing", () => {
    for (const layout of LAYOUTS) {
      const html = renderToStaticMarkup(ResumeBody({ resume, layout: layout.id }));
      expect(html).toContain("Priya Raman");
      expect(html).toContain("rd-page");
    }
  });

  it("emits link labels as text so an extractor can read them", () => {
    const html = renderToStaticMarkup(ResumeBody({ resume, layout: "classic" }));
    expect(html).toContain(">GitHub<");
    expect(html).toContain('href="https://github.com/priyaraman"');
  });

  it("omits sections that are hidden", () => {
    // Certifications ships hidden in the sample.
    const html = renderToStaticMarkup(ResumeBody({ resume, layout: "classic" }));
    expect(html).not.toContain("ISTQB");
  });

  it("omits a section that is visible but has no content", () => {
    const empty = cloneSample();
    empty.sections = empty.sections.map((section) =>
      section.kind === "projects" ? { ...section, items: [] } : section,
    );
    const html = renderToStaticMarkup(ResumeBody({ resume: empty, layout: "classic" }));
    expect(html).not.toContain(">Projects<");
  });

  it("never emits more than one column container", () => {
    // The ATS guarantee rests on this: no layout may introduce a sidebar.
    for (const layout of LAYOUTS) {
      const html = renderToStaticMarkup(ResumeBody({ resume, layout: layout.id }));
      expect(html.match(/class="rd-page"/g)).toHaveLength(1);
    }
  });
});
