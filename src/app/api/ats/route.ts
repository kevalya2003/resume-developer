import { NextResponse } from "next/server";
import { renderRequestSchema } from "@/lib/api-contract";
import { analyseExtractedText, type AtsExpectation } from "@/lib/ats/parse";
import { extractPdfText } from "@/lib/server/extract-pdf";
import { readJsonRequest, withRenderSlot } from "@/lib/server/gate";
import { renderResumePdf } from "@/lib/server/render-pdf";
import type { Resume } from "@/lib/schema";
import type { Composition } from "@/lib/templates/tokens";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Renders the PDF and immediately reads it back, so the report describes the
 * exact bytes the user is about to download rather than an approximation of
 * them.
 */
export async function POST(request: Request): Promise<Response> {
  const body = await readJsonRequest(request);
  if (!body.ok) return body.response;

  const parsed = renderRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.issues.slice(0, 8) },
      { status: 400 },
    );
  }

  const { resume, composition, scale } = parsed.data;

  try {
    // Renders and parses inside one slot. This endpoint is strictly more
    // expensive than /api/render — it does everything that does, then parses
    // the result — so it must not be the one that escapes the ceiling.
    const checked = await withRenderSlot(async () => {
      const { pdf } = await renderResumePdf({
        resume,
        composition: composition as Composition,
        scale,
      });
      return extractPdfText(new Uint8Array(pdf));
    });
    if (!checked.ok) return checked.response;

    const extracted = checked.value;
    const report = analyseExtractedText(
      extracted.text,
      expectationsFor(resume),
      extracted.pageCount,
    );
    return NextResponse.json({ report, extractedText: extracted.text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown failure.";
    return NextResponse.json({ error: `ATS check failed: ${message}` }, { status: 500 });
  }
}

function expectationsFor(resume: Resume): AtsExpectation {
  const bulletCount = resume.sections.reduce((acc, section) => {
    if (section.kind === "experience" || section.kind === "projects" || section.kind === "custom") {
      return acc + section.items.reduce((n, item) => n + item.bullets.length, 0);
    }
    return acc;
  }, 0);

  return {
    name: resume.basics.name,
    email: resume.basics.email,
    phone: resume.basics.phone,
    sectionTitles: resume.sections.filter((s) => s.visible).map((s) => s.title),
    linkUrls: resume.basics.links.map((l) => l.url).filter(Boolean),
    bulletCount,
  };
}
