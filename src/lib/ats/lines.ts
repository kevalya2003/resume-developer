/**
 * Reconstructs visual lines from positioned glyph runs. Kept separate from the
 * PDF reader so it can be tested directly: this is the part with the judgement
 * calls in it, and it should not require spawning a document to exercise.
 */

export interface TextItemLike {
  str: string;
  /** PDF text matrix; indices 4 and 5 are the x and y translation. */
  transform: number[];
  width: number;
}

/**
 * Runs whose baselines fall within a small tolerance belong to the same visual
 * line. Within a line, a horizontal gap wider than a hairline becomes a space,
 * so words that merely abut are not fused into one token — which is exactly the
 * failure that turns "Auto mation" into an unsearchable "Automation" or worse.
 */
export function groupIntoLines(items: TextItemLike[], yTolerance = 2.2): string[] {
  const rows: Array<{ y: number; parts: Array<{ x: number; str: string; width: number }> }> = [];

  for (const item of items) {
    if (!item.str) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const row = rows.find((r) => Math.abs(r.y - y) <= yTolerance);
    if (row) {
      row.parts.push({ x, str: item.str, width: item.width });
    } else {
      rows.push({ y, parts: [{ x, str: item.str, width: item.width }] });
    }
  }

  // PDF y grows upward, so descending y is top-to-bottom reading order.
  rows.sort((a, b) => b.y - a.y);

  return rows
    .map((row) => {
      row.parts.sort((a, b) => a.x - b.x);
      let line = "";
      let cursor: number | null = null;
      for (const part of row.parts) {
        if (cursor !== null && part.x - cursor > 1.2 && !line.endsWith(" ")) {
          line += " ";
        }
        line += part.str;
        cursor = part.x + part.width;
      }
      return line.replace(/\s+/g, " ").trim();
    })
    .filter((line) => line.length > 0);
}
