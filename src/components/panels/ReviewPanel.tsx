"use client";

import { useMemo } from "react";
import { lintResume, summariseLint, type LintFinding } from "@/lib/lint/rules";
import type { Resume } from "@/lib/schema";
import { Pill } from "../ui";

const TONE: Record<LintFinding["severity"], "bad" | "warn" | "neutral"> = {
  error: "bad",
  warning: "warn",
  info: "neutral",
};

const BORDER: Record<LintFinding["severity"], string> = {
  error: "border-l-rose-400",
  warning: "border-l-amber-400",
  info: "border-l-slate-300",
};

function scoreColour(score: number): string {
  if (score >= 85) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-rose-600";
}

export function ReviewPanel({ resume }: { resume: Resume }) {
  const summary = useMemo(() => summariseLint(lintResume(resume)), [resume]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <div>
            <span className={`text-2xl font-semibold ${scoreColour(summary.score)}`}>
              {summary.score}
            </span>
            <span className="ml-1 text-sm text-slate-500">/ 100</span>
          </div>
          <div className="flex gap-1.5">
            {summary.errors > 0 ? <Pill tone="bad">{summary.errors} to fix</Pill> : null}
            {summary.warnings > 0 ? <Pill tone="warn">{summary.warnings} to review</Pill> : null}
            {summary.infos > 0 ? <Pill>{summary.infos} hints</Pill> : null}
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          These are the edits a careful reviewer makes by hand. A rule firing is a prompt to look
          again, not proof the line is wrong — nothing here blocks an export.
        </p>
      </div>

      {summary.findings.length === 0 ? (
        <p className="rounded-md border border-dashed border-emerald-300 bg-emerald-50 px-3 py-6 text-center text-sm text-emerald-700">
          Nothing flagged. Worth a human read anyway.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {summary.findings.map((finding, i) => (
            <li
              key={`${finding.ruleId}-${i}`}
              className={`rounded-r-md border border-l-4 border-slate-200 bg-white p-2.5 ${BORDER[finding.severity]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">{finding.message}</p>
                <Pill tone={TONE[finding.severity]}>{finding.severity}</Pill>
              </div>
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                {finding.location}
              </p>
              {finding.excerpt ? (
                <p className="mt-1.5 border-l-2 border-slate-200 pl-2 text-xs italic text-slate-500">
                  {finding.excerpt}
                </p>
              ) : null}
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{finding.hint}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
