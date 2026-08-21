"use client";

import { stack } from "@/lib/templates/fonts";
import {
  ACCENTS,
  compositionId,
  DENSITIES,
  LAYOUTS,
  TYPE_PAIRINGS,
  totalCompositions,
  type Composition,
} from "@/lib/templates/tokens";
import { Button, Card } from "../ui";

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function TemplatePanel({
  composition,
  onChange,
}: {
  composition: Composition;
  onChange: (next: Composition) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm text-slate-700">
          <strong className="font-semibold">
            {totalCompositions().toLocaleString()} templates
          </strong>{" "}
          from {LAYOUTS.length} layouts × {TYPE_PAIRINGS.length} type pairings ×{" "}
          {DENSITIES.length} densities × {ACCENTS.length} accents.
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          Every layout is single column. Two-column resumes with sidebars are the most common
          cause of parsing failures, because an extractor reads the file in content order and
          splices the columns together. The ATS tab re-reads your exported PDF so you can check
          that claim rather than take it.
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-slate-500">
            {compositionId(composition)}
          </code>
          <Button
            onClick={() =>
              onChange({
                layout: pick(LAYOUTS).id,
                type: pick(TYPE_PAIRINGS).id,
                density: pick(DENSITIES).id,
                accent: pick(ACCENTS).id,
              })
            }
          >
            Surprise me
          </Button>
        </div>
      </div>

      <Card title="Layout">
        <div className="grid grid-cols-2 gap-1.5">
          {LAYOUTS.map((layout) => {
            const active = layout.id === composition.layout;
            return (
              <button
                key={layout.id}
                type="button"
                onClick={() => onChange({ ...composition, layout: layout.id })}
                className={`rounded-md border px-2.5 py-2 text-left transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                <span className="block text-sm font-medium">{layout.name}</span>
                <span
                  className={`mt-0.5 block text-[11px] leading-snug ${active ? "text-slate-300" : "text-slate-500"}`}
                >
                  {layout.note}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Typography">
        <div className="space-y-1.5">
          {TYPE_PAIRINGS.map((type) => {
            const active = type.id === composition.type;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => onChange({ ...composition, type: type.id })}
                className={`flex w-full items-center justify-between gap-3 rounded-md border px-2.5 py-2 text-left transition ${
                  active
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 bg-white hover:border-slate-400"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">{type.name}</span>
                  <span className="block text-[11px] leading-snug text-slate-500">
                    {type.note}
                  </span>
                </span>
                {/* Rendered in the family that will actually be used, so the
                    choice is visible before it is applied. */}
                <span
                  className="shrink-0 truncate text-slate-500"
                  style={{
                    fontFamily: stack(type.bodyFamily, type.generic),
                    fontSize: "13px",
                  }}
                >
                  Validated Kafka flows
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Every font is shipped with the app rather than assumed to be installed. Calibri and
          Georgia do not exist on Linux, so a server rendering your PDF would substitute
          something with different metrics and break the page count the preview promised. These
          are open, metric-compatible equivalents, identical on both sides.
        </p>
      </Card>

      <Card title="Density">
        <div className="flex gap-1.5">
          {DENSITIES.map((density) => {
            const active = density.id === composition.density;
            return (
              <button
                key={density.id}
                type="button"
                onClick={() => onChange({ ...composition, density: density.id })}
                className={`flex-1 rounded-md border px-2 py-1.5 text-sm font-medium transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {density.name}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          A starting point only. With auto-fit on, the app tightens spacing further as needed to
          hold your target page count.
        </p>
      </Card>

      <Card title="Accent">
        <div className="flex flex-wrap gap-1.5">
          {ACCENTS.map((accent) => {
            const active = accent.id === composition.accent;
            return (
              <button
                key={accent.id}
                type="button"
                title={accent.name}
                aria-label={accent.name}
                onClick={() => onChange({ ...composition, accent: accent.id })}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  active ? "border-slate-900 scale-110" : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: accent.value }}
              />
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Accent is applied to headings and rules only, never to body text. Coloured body text
          costs legibility on a printed page and gains nothing.
        </p>
      </Card>
    </div>
  );
}
