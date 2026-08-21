/**
 * Fitting a resume to an exact page count is a search problem, not a styling
 * problem. Rather than asking the user to nudge font sizes until the overflow
 * disappears, the app measures the rendered document at a candidate scale and
 * binary-searches for the largest scale that still fits.
 *
 * The search assumes measured height is non-increasing as scale decreases.
 * Text reflow makes that very slightly untrue at the boundaries — a narrower
 * line can occasionally wrap into an extra line — so the solver keeps the best
 * fitting scale it has actually observed rather than trusting the final bound.
 */

export interface FitProbe {
  contentHeightMm: number;
  availableHeightMm: number;
}

export interface FitOptions {
  minScale?: number;
  maxScale?: number;
  iterations?: number;
  /** Millimetres of clearance to insist on, absorbing printer and font variance. */
  safetyMm?: number;
}

export interface FitResult {
  scale: number;
  fits: boolean;
  contentHeightMm: number;
  availableHeightMm: number;
  /** Positive when the document is too long, negative when there is room to spare. */
  overflowMm: number;
  probes: number;
  /** True when the document fit without any shrinking at all. */
  fitsAtFullSize: boolean;
}

export const DEFAULT_FIT_OPTIONS: Required<FitOptions> = {
  minScale: 0.78,
  maxScale: 1.0,
  iterations: 9,
  safetyMm: 1.5,
};

export function solveFit(
  probe: (scale: number) => FitProbe,
  options: FitOptions = {},
): FitResult {
  const opts = { ...DEFAULT_FIT_OPTIONS, ...options };
  let probes = 0;

  const evaluate = (scale: number) => {
    probes += 1;
    const p = probe(scale);
    const overflow = p.contentHeightMm - (p.availableHeightMm - opts.safetyMm);
    return { scale, ...p, overflow };
  };

  const atMax = evaluate(opts.maxScale);
  if (atMax.overflow <= 0) {
    return {
      scale: opts.maxScale,
      fits: true,
      contentHeightMm: atMax.contentHeightMm,
      availableHeightMm: atMax.availableHeightMm,
      overflowMm: atMax.overflow,
      probes,
      fitsAtFullSize: true,
    };
  }

  const atMin = evaluate(opts.minScale);
  if (atMin.overflow > 0) {
    // Even fully compressed it does not fit. Shrinking further would produce
    // something unreadable, so report the shortfall and let the user cut text.
    return {
      scale: opts.minScale,
      fits: false,
      contentHeightMm: atMin.contentHeightMm,
      availableHeightMm: atMin.availableHeightMm,
      overflowMm: atMin.overflow,
      probes,
      fitsAtFullSize: false,
    };
  }

  let low = opts.minScale;
  let high = opts.maxScale;
  let best = atMin;

  for (let i = 0; i < opts.iterations; i += 1) {
    const mid = (low + high) / 2;
    const result = evaluate(mid);
    if (result.overflow <= 0) {
      if (result.scale > best.scale) best = result;
      low = mid;
    } else {
      high = mid;
    }
    if (high - low < 0.002) break;
  }

  return {
    scale: best.scale,
    fits: true,
    contentHeightMm: best.contentHeightMm,
    availableHeightMm: best.availableHeightMm,
    overflowMm: best.overflow,
    probes,
    fitsAtFullSize: false,
  };
}

/**
 * Turns the solver output into something a person can act on. "3mm too long" is
 * not actionable; "about two lines too long" is.
 */
export function describeFit(result: FitResult, approxLineHeightMm: number): string {
  const clearance = -result.overflowMm;
  if (!result.fits) {
    const lines = Math.max(1, Math.ceil(result.overflowMm / Math.max(approxLineHeightMm, 0.1)));
    return `About ${lines} line${lines === 1 ? "" : "s"} too long, even at the smallest readable size. Cut some text.`;
  }
  if (result.fitsAtFullSize) {
    return `Fits at full size with ${clearance.toFixed(0)}mm to spare.`;
  }
  const pct = Math.round((1 - result.scale) * 100);
  return `Fits after tightening ${pct}%, with ${clearance.toFixed(0)}mm to spare.`;
}

export const PX_PER_MM = 96 / 25.4;

export function pxToMm(px: number): number {
  return px / PX_PER_MM;
}

export function mmToPx(mm: number): number {
  return mm * PX_PER_MM;
}
