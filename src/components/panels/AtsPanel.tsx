"use client";

import { useState } from "react";
import type { AtsReport, AtsStatus } from "@/lib/ats/parse";
import type { Resume } from "@/lib/schema";
import type { Composition } from "@/lib/templates/tokens";
import { Button, Pill } from "../ui";

const STATUS_TONE: Record<AtsStatus, "good" | "warn" | "bad"> = {
  pass: "good",
  warn: "warn",
  fail: "bad",
};

const STATUS_BORDER: Record<AtsStatus, string> = {
  pass: "border-l-emerald-400",
  warn: "border-l-amber-400",
  fail: "border-l-rose-400",
};

export function AtsPanel({
  resume,
  composition,
  scale,
}: {
  resume: Resume;
  composition: Composition;
  scale: number;
}) {
  const [report, setReport] = useState<AtsReport | null>(null);
  const [extracted, setExtracted] = useState<string>("");
  const [showText, setShowText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, composition, scale }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The check failed.");
      setReport(payload.report as AtsReport);
      setExtracted(payload.extractedText as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The check failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs leading-relaxed text-slate-600">
          This renders your PDF and then reads it back with a text extractor — the same operation
          an applicant tracking system performs — and compares what came out against what went in.
          It is a check you can fail, rather than a badge.
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <Button variant="primary" onClick={run} disabled={busy}>
            {busy ? "Rendering and reading back…" : report ? "Run again" : "Run the check"}
          </Button>
          {report ? (
            <Pill tone={report.score >= 85 ? "good" : report.score >= 60 ? "warn" : "bad"}>
              {report.score} / 100
            </Pill>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {report ? (
        <>
          <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
            <Pill>{report.pageCount} page{report.pageCount === 1 ? "" : "s"}</Pill>
            <Pill>{report.extractedChars.toLocaleString()} characters recovered</Pill>
            <Pill>{report.recovered.headings.length} headings</Pill>
            <Pill>{report.recovered.dateCount} dates</Pill>
          </div>

          <ul className="space-y-1.5">
            {report.findings.map((finding) => (
              <li
                key={finding.id}
                className={`rounded-r-md border border-l-4 border-slate-200 bg-white p-2.5 ${STATUS_BORDER[finding.status]}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{finding.title}</p>
                  <Pill tone={STATUS_TONE[finding.status]}>{finding.status}</Pill>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{finding.detail}</p>
              </li>
            ))}
          </ul>

          <div>
            <Button onClick={() => setShowText((v) => !v)}>
              {showText ? "Hide" : "Show"} the text a parser sees
            </Button>
            {showText ? (
              <pre className="mt-2 max-h-80 overflow-auto rounded-md border border-slate-200 bg-slate-900 p-2.5 text-[11px] leading-relaxed text-slate-100">
                {extracted}
              </pre>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
