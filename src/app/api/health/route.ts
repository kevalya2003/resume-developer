import { NextResponse } from "next/server";
import { rendererLoad } from "@/lib/server/gate";
import { verifyFontsResolvable } from "@/lib/server/font-embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reports whether this instance can actually do its job, not merely whether the
 * process is up.
 *
 * The fonts are the thing worth checking: if the sync step did not run, or the
 * image was built without it, every export still returns a PDF — just one set
 * in the wrong typeface with a page count that no longer matches the preview.
 * That is precisely the failure a health check should catch before traffic
 * arrives, because nothing downstream of it looks like an error.
 *
 * Deliberately does not launch a browser. A readiness probe that costs a
 * Chromium start would compete with real renders for the very capacity it is
 * meant to be protecting.
 */
export async function GET(): Promise<Response> {
  const load = rendererLoad();

  try {
    await verifyFontsResolvable();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fonts are not available.";
    return NextResponse.json({ status: "unhealthy", fonts: message, load }, { status: 503 });
  }

  return NextResponse.json({ status: "ok", fonts: "complete", load });
}
