/**
 * Reads a request body with a hard ceiling on how much is buffered.
 *
 * `request.json()` will happily buffer whatever it is sent, so a single large
 * POST is enough to exhaust memory before any validation has a chance to reject
 * it. Streaming with a running total stops at the limit instead, which means
 * the cost of a hostile request is bounded by the limit rather than by the
 * sender's patience.
 *
 * Content-Length is checked first as a courtesy — it lets an honest oversized
 * request fail immediately — but it is not trusted, because it can be absent
 * on a chunked body and can simply be wrong.
 */

export class PayloadTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes.`);
    this.name = "PayloadTooLargeError";
  }
}

export function declaredTooLarge(contentLength: string | null, maxBytes: number): boolean {
  if (contentLength === null) return false;
  const declared = Number(contentLength);
  return Number.isFinite(declared) && declared > maxBytes;
}

export async function readBoundedText(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string> {
  if (body === null) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new PayloadTooLargeError(maxBytes);
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
  } finally {
    // Releasing tells the sender to stop; without it an oversized upload keeps
    // arriving even though nothing is reading it any more.
    reader.releaseLock();
    if (body.locked === false) await body.cancel().catch(() => {});
  }

  return chunks.join("");
}
