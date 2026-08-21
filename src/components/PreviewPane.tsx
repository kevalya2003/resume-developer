"use client";

import { useEffect, useRef, useState } from "react";
import { mmToPx } from "@/lib/fit/autofit";
import type { Resume } from "@/lib/schema";
import { ResumeDocument } from "@/lib/templates/document";
import { A4, type Composition } from "@/lib/templates/tokens";

/**
 * The preview renders the document at true A4 size and scales the whole thing
 * with a CSS transform, rather than laying it out at screen size. Transform
 * scaling changes no line breaks, so what is on screen is what comes out of
 * the printer — which is the entire point of previewing it.
 */
export function PreviewPane({
  resume,
  composition,
  scale,
  targetPages,
}: {
  resume: Resume;
  composition: Composition;
  scale: number;
  targetPages: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.9);
  const [renderedHeightPx, setRenderedHeightPx] = useState(mmToPx(A4.heightMm));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const available = container.clientWidth - 48;
      setZoom(Math.min(1.1, Math.max(0.3, available / mmToPx(A4.widthMm))));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    setRenderedHeightPx(el.getBoundingClientRect().height / zoom);
  }, [resume, composition, scale, zoom]);

  const pageHeightPx = mmToPx(A4.heightMm);
  const breaks: number[] = [];
  for (let i = 1; i * pageHeightPx < renderedHeightPx - 4; i += 1) breaks.push(i);

  return (
    <div ref={containerRef} className="flex h-full justify-center overflow-auto bg-slate-200 p-6">
      <div
        style={{
          width: mmToPx(A4.widthMm) * zoom,
          height: renderedHeightPx * zoom,
        }}
      >
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            width: mmToPx(A4.widthMm),
            position: "relative",
          }}
        >
          <div ref={pageRef} className="shadow-[0_2px_18px_rgba(15,23,42,0.16)]">
            <ResumeDocument resume={resume} composition={composition} scale={scale} />
          </div>

          {/* Where A4 actually ends. A preview that hides the page boundary is
              how people end up with a two-page resume they thought was one. */}
          {breaks.map((n) => (
            <div
              key={n}
              className="pointer-events-none absolute left-0 right-0 flex items-center"
              style={{ top: n * pageHeightPx }}
            >
              <div className="h-px flex-1 bg-rose-400/70" />
              <span className="ml-2 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                page {n + 1}
                {n + 1 > targetPages ? " · over target" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
