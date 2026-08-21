import { describe, expect, it } from "vitest";
import { describeFit, solveFit, type FitProbe } from "@/lib/fit/autofit";

/**
 * The solver is given a synthetic document whose height is a known function of
 * scale, so the tests assert search behaviour rather than layout behaviour.
 */
function linearDocument(heightAtFullScale: number, available = 297) {
  let probes = 0;
  const probe = (scale: number): FitProbe => {
    probes += 1;
    return { contentHeightMm: heightAtFullScale * scale, availableHeightMm: available };
  };
  return { probe, calls: () => probes };
}

describe("solveFit", () => {
  it("does not shrink a document that already fits", () => {
    const doc = linearDocument(200);
    const result = solveFit(doc.probe);

    expect(result.fits).toBe(true);
    expect(result.fitsAtFullSize).toBe(true);
    expect(result.scale).toBe(1);
    // One probe is enough to establish that no search is needed.
    expect(doc.calls()).toBe(1);
  });

  it("finds a scale that fits when the document is slightly too long", () => {
    const doc = linearDocument(330);
    const result = solveFit(doc.probe);

    expect(result.fits).toBe(true);
    expect(result.fitsAtFullSize).toBe(false);
    expect(result.scale).toBeLessThan(1);
    expect(result.scale).toBeGreaterThan(0.78);
    expect(result.contentHeightMm).toBeLessThanOrEqual(297 - 1.5);
  });

  it("returns the largest fitting scale, not merely any fitting scale", () => {
    const doc = linearDocument(320);
    const result = solveFit(doc.probe);

    // 320 * s <= 295.5 means the ideal scale is ~0.9234. The search should land
    // close to it rather than settling for something conservative like 0.78.
    expect(result.scale).toBeGreaterThan(0.91);
    expect(result.scale).toBeLessThanOrEqual(0.9235);
  });

  it("reports failure instead of shrinking past legibility", () => {
    const doc = linearDocument(600);
    const result = solveFit(doc.probe);

    expect(result.fits).toBe(false);
    expect(result.scale).toBe(0.78);
    expect(result.overflowMm).toBeGreaterThan(0);
  });

  it("keeps a safety margin so a borderline document is not called a fit", () => {
    // Exactly one page tall at full size: without the safety margin this would
    // pass, and would then spill on any machine that renders a hair differently.
    const doc = linearDocument(297);
    const result = solveFit(doc.probe, { safetyMm: 1.5 });

    expect(result.fitsAtFullSize).toBe(false);
    expect(result.scale).toBeLessThan(1);
  });

  it("respects an explicit page target", () => {
    const doc = linearDocument(500, 594);
    const result = solveFit(doc.probe);

    expect(result.fits).toBe(true);
    expect(result.fitsAtFullSize).toBe(true);
  });

  it("converges in a bounded number of probes", () => {
    const doc = linearDocument(400);
    const result = solveFit(doc.probe);

    expect(result.probes).toBeLessThanOrEqual(12);
  });

  it("keeps the best observed fit even when reflow makes height non-monotonic", () => {
    // A document that briefly gets taller as it narrows, which is what happens
    // when a tightened line wraps into an extra one.
    const probe = (scale: number): FitProbe => {
      const bump = scale > 0.88 && scale < 0.93 ? 40 : 0;
      return { contentHeightMm: 330 * scale + bump, availableHeightMm: 297 };
    };
    const result = solveFit(probe);

    expect(result.fits).toBe(true);
    // Whatever scale it settles on must actually have been measured as fitting.
    expect(result.contentHeightMm).toBeLessThanOrEqual(297 - 1.5);
  });
});

describe("describeFit", () => {
  it("phrases an unfixable overflow in lines rather than millimetres", () => {
    const message = describeFit(
      {
        scale: 0.78,
        fits: false,
        contentHeightMm: 310,
        availableHeightMm: 297,
        overflowMm: 14,
        probes: 2,
        fitsAtFullSize: false,
      },
      4.5,
    );

    expect(message).toContain("4 lines too long");
  });

  it("says how much room is left when nothing had to be tightened", () => {
    const message = describeFit(
      {
        scale: 1,
        fits: true,
        contentHeightMm: 280,
        availableHeightMm: 297,
        overflowMm: -15.5,
        probes: 1,
        fitsAtFullSize: true,
      },
      4.5,
    );

    expect(message).toContain("full size");
    expect(message).toContain("16mm");
  });

  it("reports the compression applied when the document had to be tightened", () => {
    const message = describeFit(
      {
        scale: 0.9,
        fits: true,
        contentHeightMm: 290,
        availableHeightMm: 297,
        overflowMm: -5,
        probes: 6,
        fitsAtFullSize: false,
      },
      4.5,
    );

    expect(message).toContain("10%");
  });
});
