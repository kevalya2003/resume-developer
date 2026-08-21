import "server-only";

import { groupIntoLines, type TextItemLike } from "../ats/lines";

/**
 * Reads a PDF back the way an applicant tracking system does: pull the text
 * layer out and reconstruct lines from glyph positions. Extractors differ in
 * the details, but they all work from this same text layer, so what comes back
 * here is a fair approximation of what a parser sees.
 */

export interface ExtractedPdf {
  text: string;
  pageCount: number;
  lines: string[];
}

export async function extractPdfText(data: Uint8Array): Promise<ExtractedPdf> {
  // The legacy build is the one that runs under Node without a DOM. Imported
  // lazily so the client bundle never pulls it in.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
  const doc = await loadingTask.promise;

  const allLines: string[] = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    allLines.push(...groupIntoLines(content.items as unknown as TextItemLike[]));
    page.cleanup();
  }
  const pageCount = doc.numPages;
  // Tearing down the loading task also terminates the worker it started.
  await loadingTask.destroy();

  return { text: allLines.join("\n"), pageCount, lines: allLines };
}
