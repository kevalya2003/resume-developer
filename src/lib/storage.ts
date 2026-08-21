"use client";

import { z } from "zod";
import { resumeSchema, type Resume } from "./schema";
import { compositionSchema } from "./api-contract";
import { defaultComposition, type Composition } from "./templates/tokens";

/**
 * Everything stays in the browser. There is no account system and no upload,
 * which removes an entire class of problem: a resume is the most identifying
 * document most people own, and the safest place to process one is the machine
 * it already lives on. The export file is the portability story instead.
 */

const STORAGE_KEY = "resume-developer:v1";

export const documentStateSchema = z.object({
  resume: resumeSchema,
  composition: compositionSchema,
  targetPages: z.number().int().min(1).max(3).default(1),
  autoFit: z.boolean().default(true),
});

export type DocumentState = z.infer<typeof documentStateSchema>;

export function loadState(): DocumentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = documentStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as DocumentState) : null;
  } catch {
    return null;
  }
}

export function saveState(state: DocumentState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exhausted or storage disabled. The editor keeps working from memory;
    // failing loudly here would interrupt typing for something recoverable.
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export interface ExportFile {
  format: "resume-developer";
  version: 1;
  exportedAt: string;
  resume: Resume;
  composition: Composition;
}

export function toExportFile(resume: Resume, composition: Composition): string {
  const payload: ExportFile = {
    format: "resume-developer",
    version: 1,
    exportedAt: new Date().toISOString(),
    resume,
    composition,
  };
  return JSON.stringify(payload, null, 2);
}

export interface ImportResult {
  ok: boolean;
  resume?: Resume;
  composition?: Composition;
  error?: string;
}

/**
 * Accepts both this app's export file and a bare resume document, so a file
 * hand-edited down to just the resume still imports.
 */
export function fromImportFile(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }

  const wrapped = z
    .object({ resume: resumeSchema, composition: compositionSchema.optional() })
    .safeParse(raw);
  if (wrapped.success) {
    return {
      ok: true,
      resume: wrapped.data.resume,
      composition: (wrapped.data.composition as Composition) ?? defaultComposition,
    };
  }

  const bare = resumeSchema.safeParse(raw);
  if (bare.success) {
    return { ok: true, resume: bare.data, composition: defaultComposition };
  }

  const issue = wrapped.error.issues[0];
  return {
    ok: false,
    error: issue
      ? `Not a recognised resume file: ${issue.path.join(".") || "root"} — ${issue.message}.`
      : "Not a recognised resume file.",
  };
}

export function downloadText(filename: string, text: string, mime = "application/json"): void {
  const blob = new Blob([text], { type: mime });
  triggerDownload(filename, blob);
}

export function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
