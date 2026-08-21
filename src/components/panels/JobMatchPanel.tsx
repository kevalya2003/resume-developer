"use client";

import { useMemo, useState } from "react";
import { analyseJd, type KeywordHit } from "@/lib/jd/keywords";
import type { Resume } from "@/lib/schema";
import { AutoTextarea, Pill } from "../ui";

function TermList({
  terms,
  tone,
  emptyMessage,
}: {
  terms: KeywordHit[];
  tone: "good" | "warn" | "bad";
  emptyMessage: string;
}) {
  if (terms.length === 0) {
    return <p className="text-xs text-slate-400">{emptyMessage}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {terms.map((hit) => (
        <span key={hit.term} title={`Mentioned ${hit.jdCount}× in the posting`}>
          <Pill tone={tone}>
            {hit.term}
            {hit.jdCount > 1 ? ` ×${hit.jdCount}` : ""}
          </Pill>
        </span>
      ))}
    </div>
  );
}

export function JobMatchPanel({ resume }: { resume: Resume }) {
  const [jd, setJd] = useState("");
  const analysis = useMemo(() => analyseJd(jd, resume), [jd, resume]);
  const hasInput = jd.trim().length > 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs leading-relaxed text-slate-600">
          Paste the full posting rather than a summary. The requirements section is where the
          terms live, and the wording matters more than the gist.
        </p>
        <AutoTextarea
          value={jd}
          onChange={setJd}
          minRows={6}
          placeholder="Paste the job description here…"
        />
      </div>

      {hasInput && analysis.totalTerms > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-slate-200 bg-white p-2.5">
              <p className="text-2xl font-semibold text-slate-900">
                {Math.round(analysis.coverage * 100)}%
              </p>
              <p className="text-[11px] leading-snug text-slate-500">
                of the posting&rsquo;s terms appear somewhere on your resume
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-2.5">
              <p className="text-2xl font-semibold text-slate-900">
                {Math.round(analysis.evidenceCoverage * 100)}%
              </p>
              <p className="text-[11px] leading-snug text-slate-500">
                appear inside a bullet, where they read as evidence
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Demonstrated ({analysis.matched.length})
              </p>
              <TermList
                terms={analysis.matched}
                tone="good"
                emptyMessage="None of the posting's terms appear inside a bullet yet."
              />
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Claimed but not shown ({analysis.claimedOnly.length})
              </p>
              <p className="mb-1.5 text-[11px] leading-relaxed text-slate-500">
                Listed in your skills but never mentioned in the work itself. These are what an
                interviewer probes first.
              </p>
              <TermList
                terms={analysis.claimedOnly}
                tone="warn"
                emptyMessage="Nothing is claimed without supporting detail."
              />
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Missing ({analysis.missing.length})
              </p>
              <TermList
                terms={analysis.missing}
                tone="bad"
                emptyMessage="Every term in the posting appears somewhere on your resume."
              />
            </div>
          </div>

          {analysis.notes.length > 0 ? (
            <ul className="space-y-1.5">
              {analysis.notes.map((note, i) => (
                <li
                  key={i}
                  className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600"
                >
                  {note}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : hasInput ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
          {analysis.notes[0] ?? "No recognised skill terms found in that text."}
        </p>
      ) : null}
    </div>
  );
}
