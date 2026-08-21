import { NextResponse } from "next/server";
import { renderRequestSchema, safeFilename } from "@/lib/api-contract";
import type { Composition } from "@/lib/templates/tokens";
import { readJsonRequest, withRenderSlot } from "@/lib/server/gate";
import { renderResumePdf } from "@/lib/server/render-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonRequest(request);
  if (!body.ok) return body.response;

  const parsed = renderRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid render request.", issues: parsed.error.issues.slice(0, 8) },
      { status: 400 },
    );
  }

  const { resume, composition, scale } = parsed.data;

  // Validation first, then a slot: a malformed request should never occupy
  // capacity that a valid one is queueing for.
  try {
    const rendered = await withRenderSlot(() =>
      renderResumePdf({ resume, composition: composition as Composition, scale }),
    );
    if (!rendered.ok) return rendered.response;

    return new Response(new Uint8Array(rendered.value.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename(resume.basics.name)}_Resume.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown rendering failure.";
    return NextResponse.json({ error: `PDF rendering failed: ${message}` }, { status: 500 });
  }
}
