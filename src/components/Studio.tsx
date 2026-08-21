"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { safeFilename } from "@/lib/api-contract";
import { approxLineHeightMm, useAutoFit } from "@/lib/fit/use-auto-fit";
import { describeFit } from "@/lib/fit/autofit";
import { cloneSample, emptyResume } from "@/lib/sample-resume";
import type { Resume } from "@/lib/schema";
import {
  clearState,
  downloadText,
  fromImportFile,
  loadState,
  saveState,
  toExportFile,
  triggerDownload,
  type DocumentState,
} from "@/lib/storage";
import { resumeCss } from "@/lib/templates/styles";
import { defaultComposition, type Composition } from "@/lib/templates/tokens";
import { PreviewPane } from "./PreviewPane";
import { AtsPanel } from "./panels/AtsPanel";
import { ContentPanel } from "./panels/ContentPanel";
import { JobMatchPanel } from "./panels/JobMatchPanel";
import { ReviewPanel } from "./panels/ReviewPanel";
import { TemplatePanel } from "./panels/TemplatePanel";
import { Button, Pill } from "./ui";

const TABS = [
  { id: "content", label: "Content" },
  { id: "template", label: "Template" },
  { id: "review", label: "Review" },
  { id: "ats", label: "ATS" },
  { id: "match", label: "Job match" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const INITIAL: DocumentState = {
  resume: cloneSample(),
  composition: defaultComposition,
  targetPages: 1,
  autoFit: true,
};

const noopSubscribe = () => () => {};

/**
 * The saved document lives in localStorage, which does not exist while the page
 * is being server-rendered. Rather than mounting the editor and then correcting
 * its state from an effect — which flashes the sample over the user's real
 * document and cascades a second render — the shell waits for hydration and the
 * editor reads storage once, in its initialiser, by which point it is safe.
 */
export function Studio() {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-100 text-sm text-slate-400">
        Loading your document…
      </div>
    );
  }
  return <StudioInner />;
}

function StudioInner() {
  const [state, setState] = useState<DocumentState>(() => loadState() ?? INITIAL);
  const [tab, setTab] = useState<TabId>("content");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => saveState(state), 400);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const { result: fit, scale } = useAutoFit(
    state.resume,
    state.composition as Composition,
    state.targetPages,
    state.autoFit,
  );

  const setResume = useCallback(
    (resume: Resume) => setState((prev) => ({ ...prev, resume })),
    [],
  );
  const setComposition = useCallback(
    (composition: Composition) => setState((prev) => ({ ...prev, composition })),
    [],
  );

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: state.resume,
          composition: state.composition,
          scale,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Rendering failed." }));
        throw new Error(payload.error ?? "Rendering failed.");
      }
      const blob = await response.blob();
      triggerDownload(`${safeFilename(state.resume.basics.name)}_Resume.pdf`, blob);
      setToast("PDF downloaded.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Rendering failed.");
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    const result = fromImportFile(text);
    if (!result.ok || !result.resume) {
      setToast(result.error ?? "Could not read that file.");
      return;
    }
    setState((prev) => ({
      ...prev,
      resume: result.resume!,
      composition: (result.composition ?? prev.composition) as Composition,
    }));
    setToast("Resume imported.");
  };

  const lineMm = approxLineHeightMm(state.composition as Composition, scale);

  return (
    <div className="flex h-dvh flex-col bg-slate-100 text-slate-900">
      {/* The document stylesheet is shared verbatim with the PDF renderer. */}
      <style dangerouslySetInnerHTML={{ __html: resumeCss }} />

      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold tracking-tight">Resume Developer</h1>
          <span className="hidden text-[11px] text-slate-400 sm:inline">
            everything stays in your browser
          </span>
        </div>

        <div className="ml-2 flex items-center gap-1.5">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={state.autoFit}
              onChange={(e) => setState((prev) => ({ ...prev, autoFit: e.target.checked }))}
              className="h-3.5 w-3.5 accent-slate-900"
            />
            Auto-fit
          </label>
          <select
            value={state.targetPages}
            onChange={(e) =>
              setState((prev) => ({ ...prev, targetPages: Number(e.target.value) }))
            }
            className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs"
          >
            <option value={1}>1 page</option>
            <option value={2}>2 pages</option>
            <option value={3}>3 pages</option>
          </select>
          {state.autoFit && fit.probes > 0 ? (
            <Pill tone={fit.fits ? (fit.fitsAtFullSize ? "good" : "warn") : "bad"}>
              {describeFit(fit, lineMm)}
            </Pill>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
              e.target.value = "";
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()}>Import</Button>
          <Button
            onClick={() => {
              downloadText(
                `${safeFilename(state.resume.basics.name)}_resume.json`,
                toExportFile(state.resume, state.composition as Composition),
              );
              setToast("Exported as JSON.");
            }}
          >
            Export
          </Button>
          <Button
            onClick={() => {
              setState({ ...INITIAL, resume: structuredClone(emptyResume) });
              clearState();
              setToast("Started a blank resume.");
            }}
          >
            New
          </Button>
          <Button variant="primary" onClick={downloadPdf} disabled={busy}>
            {busy ? "Rendering…" : "Download PDF"}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[440px] shrink-0 flex-col border-r border-slate-200 bg-slate-50">
          <nav className="flex shrink-0 gap-0.5 border-b border-slate-200 bg-white px-2">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={`border-b-2 px-2.5 py-2 text-xs font-medium transition ${
                  tab === entry.id
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === "content" ? (
              <ContentPanel resume={state.resume} onChange={setResume} />
            ) : tab === "template" ? (
              <TemplatePanel
                composition={state.composition as Composition}
                onChange={setComposition}
              />
            ) : tab === "review" ? (
              <ReviewPanel resume={state.resume} />
            ) : tab === "ats" ? (
              <AtsPanel
                resume={state.resume}
                composition={state.composition as Composition}
                scale={scale}
              />
            ) : (
              <JobMatchPanel resume={state.resume} />
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <PreviewPane
            resume={state.resume}
            composition={state.composition as Composition}
            scale={scale}
            targetPages={state.targetPages}
          />
        </main>
      </div>

      {toast ? (
        <div className="pointer-events-none fixed bottom-5 left-1/2 -translate-x-1/2 rounded-md bg-slate-900 px-3.5 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
