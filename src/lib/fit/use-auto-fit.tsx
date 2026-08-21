"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { Resume } from "../schema";
import { ResumeDocument } from "../templates/document";
import { pageGeometry, TYPE_PAIRINGS, type Composition } from "../templates/tokens";
import { DEFAULT_FIT_OPTIONS, pxToMm, solveFit, type FitResult } from "./autofit";

/**
 * Measures the real document rather than estimating it. Each probe renders the
 * resume into an off-screen host with flushSync so the layout is committed
 * before it is measured, which is what makes the search converge in one tick
 * instead of one render cycle per probe.
 *
 * Nine probes is roughly 25ms on the sample resume, so this runs on a short
 * debounce as the user types rather than behind a button.
 */

const IDLE: FitResult = {
  scale: 1,
  fits: true,
  contentHeightMm: 0,
  availableHeightMm: 297,
  overflowMm: 0,
  probes: 0,
  fitsAtFullSize: true,
};

export function useAutoFit(
  resume: Resume,
  composition: Composition,
  targetPages: number,
  enabled: boolean,
): { result: FitResult; scale: number } {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<Root | null>(null);
  const [result, setResult] = useState<FitResult>(IDLE);

  useEffect(() => {
    const host = document.createElement("div");
    host.className = "rd-measure";
    host.setAttribute("aria-hidden", "true");
    Object.assign(host.style, {
      position: "absolute",
      left: "-20000px",
      top: "0",
      width: "260mm",
      visibility: "hidden",
      pointerEvents: "none",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(host);
    hostRef.current = host;
    rootRef.current = createRoot(host);

    return () => {
      const root = rootRef.current;
      rootRef.current = null;
      hostRef.current = null;
      // Unmounting synchronously from inside the cleanup upsets React, so defer.
      queueMicrotask(() => {
        root?.unmount();
        host.remove();
      });
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = async () => {
      if (typeof document !== "undefined" && "fonts" in document) {
        try {
          await document.fonts.ready;
        } catch {
          // Font loading is best effort; measuring with fallbacks is still useful.
        }
      }
      const host = hostRef.current;
      const root = rootRef.current;
      if (cancelled || !host || !root) return;

      const probe = (scale: number) => {
        flushSync(() => {
          root.render(<ResumeDocument resume={resume} composition={composition} scale={scale} />);
        });
        const page = host.querySelector<HTMLElement>(".rd-page");
        const heightPx = page ? page.getBoundingClientRect().height : 0;
        const geo = pageGeometry(composition.density, scale);
        return {
          contentHeightMm: pxToMm(heightPx),
          availableHeightMm: geo.heightMm * targetPages,
        };
      };

      const solved = solveFit(probe, DEFAULT_FIT_OPTIONS);
      flushSync(() => root.render(null));
      if (!cancelled) setResult(solved);
    };

    const timer = window.setTimeout(() => void run(), 140);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [resume, composition, targetPages, enabled]);

  // When auto-fit is off the stored result is stale rather than wrong, so it is
  // discarded on the way out instead of being cleared through another render.
  return enabled ? { result, scale: result.scale } : { result: IDLE, scale: 1 };
}

/** Approximate rendered line height in mm, used to phrase overflow as lines of text. */
export function approxLineHeightMm(composition: Composition, scale: number): number {
  const type = TYPE_PAIRINGS.find((t) => t.id === composition.type) ?? TYPE_PAIRINGS[0];
  const pt = type.baseSize * scale * type.lineHeight;
  return pt * (25.4 / 72);
}
