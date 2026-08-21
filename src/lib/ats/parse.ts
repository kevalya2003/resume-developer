/**
 * Most resume tools assert that a template is "ATS-friendly". This one checks.
 * After the PDF is rendered it is read back with a text extractor — the same
 * operation an applicant tracking system performs — and the recovered text is
 * compared against what the document was supposed to contain. A claim you can
 * fail is worth more than a badge you cannot.
 */

export interface AtsExpectation {
  name: string;
  email: string;
  phone: string;
  sectionTitles: string[];
  linkUrls: string[];
  bulletCount: number;
}

export type AtsStatus = "pass" | "warn" | "fail";

export interface AtsFinding {
  id: string;
  status: AtsStatus;
  title: string;
  detail: string;
}

export interface AtsReport {
  extractedChars: number;
  pageCount: number;
  findings: AtsFinding[];
  recovered: {
    email: string | null;
    phone: string | null;
    firstLine: string | null;
    headings: string[];
    dateCount: number;
  };
  score: number;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// Deliberately permissive: parsers accept a wide range of separators, and the
// point is to mirror what they would find, not to validate the number.
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const DATE_RE =
  /\b((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4}\s*[-–—]\s*(\d{4}|present)|\b(19|20)\d{2}\b)/gi;
const LIGATURES = /[\uFB00-\uFB06]/;

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

export function analyseExtractedText(
  rawText: string,
  expected: AtsExpectation,
  pageCount: number,
): AtsReport {
  const text = rawText.replace(/\r\n/g, "\n");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const flat = lines.join(" ");
  const findings: AtsFinding[] = [];

  if (text.trim().length === 0) {
    findings.push({
      id: "no-text",
      status: "fail",
      title: "No text could be extracted",
      detail:
        "The PDF contains no selectable text, so a parser sees an empty document. This happens when a resume is exported as an image.",
    });
    return {
      extractedChars: 0,
      pageCount,
      findings,
      recovered: { email: null, phone: null, firstLine: null, headings: [], dateCount: 0 },
      score: 0,
    };
  }

  const emailMatch = flat.match(EMAIL_RE);
  const recoveredEmail = emailMatch ? emailMatch[0] : null;
  if (expected.email.trim().length === 0) {
    findings.push({
      id: "email",
      status: "warn",
      title: "No email on the resume",
      detail: "There is nothing for a parser to find, and nothing for a recruiter to reply to.",
    });
  } else if (!recoveredEmail) {
    findings.push({
      id: "email",
      status: "fail",
      title: "Email not recoverable",
      detail:
        "Your email is on the page but the extractor could not read it back. It is likely rendered as part of an image or split across text runs.",
    });
  } else if (normalise(recoveredEmail) !== normalise(expected.email)) {
    findings.push({
      id: "email",
      status: "warn",
      title: "Email read back differently",
      detail: `Extracted "${recoveredEmail}" but the document says "${expected.email}". A parser would store the first form.`,
    });
  } else {
    findings.push({
      id: "email",
      status: "pass",
      title: "Email recovered",
      detail: recoveredEmail,
    });
  }

  const phoneMatch = flat.match(PHONE_RE);
  const recoveredPhone = phoneMatch ? phoneMatch[0].trim() : null;
  if (expected.phone.trim().length === 0) {
    findings.push({
      id: "phone",
      status: "warn",
      title: "No phone number on the resume",
      detail: "Some application forms auto-populate from the parsed record and will leave it blank.",
    });
  } else if (!recoveredPhone || digitsOnly(recoveredPhone) !== digitsOnly(expected.phone)) {
    findings.push({
      id: "phone",
      status: "warn",
      title: "Phone number not read back cleanly",
      detail: recoveredPhone
        ? `Extracted "${recoveredPhone}", which does not match "${expected.phone}" digit for digit.`
        : "No phone number pattern was found in the extracted text.",
    });
  } else {
    findings.push({
      id: "phone",
      status: "pass",
      title: "Phone number recovered",
      detail: recoveredPhone,
    });
  }

  const firstLine = lines[0] ?? null;
  const nameOk =
    expected.name.trim().length > 0 &&
    lines.slice(0, 3).some((l) => normalise(l).includes(normalise(expected.name)));
  findings.push(
    nameOk
      ? {
          id: "name",
          status: "pass",
          title: "Name is the first thing on the page",
          detail: firstLine ?? "",
        }
      : {
          id: "name",
          status: "warn",
          title: "Name not found at the top",
          detail:
            "Parsers take the name from the first lines of the document. Something else is being read first.",
        },
  );

  const normalisedLines = lines.map(normalise);
  const foundHeadings = expected.sectionTitles.filter((title) =>
    normalisedLines.some((l) => l === normalise(title)),
  );
  const missingHeadings = expected.sectionTitles.filter((t) => !foundHeadings.includes(t));
  findings.push(
    missingHeadings.length === 0
      ? {
          id: "headings",
          status: "pass",
          title: `All ${foundHeadings.length} section headings survived`,
          detail: foundHeadings.join(", "),
        }
      : {
          id: "headings",
          status: "warn",
          title: `${missingHeadings.length} heading(s) not recovered as their own line`,
          detail: `Missing: ${missingHeadings.join(", ")}. A parser splits a resume into sections by finding these, and merges them when it cannot.`,
        },
  );

  const dateMatches = flat.match(DATE_RE) ?? [];
  findings.push(
    dateMatches.length > 0
      ? {
          id: "dates",
          status: "pass",
          title: `${dateMatches.length} date(s) parsed`,
          detail:
            "Employment dates are readable, so a parser can compute duration and ordering.",
        }
      : {
          id: "dates",
          status: "warn",
          title: "No recognisable dates",
          detail:
            'Use a conventional form such as "Aug 2025 – Present". Unusual separators are frequently dropped.',
        },
  );

  const missingUrls = expected.linkUrls.filter((url) => {
    const bare = url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    return bare.length > 0 && !flat.toLowerCase().includes(bare.toLowerCase());
  });
  if (expected.linkUrls.length > 0) {
    findings.push(
      missingUrls.length === 0
        ? {
            id: "links",
            status: "pass",
            title: "Link destinations appear as text",
            detail: "A parser that ignores PDF annotations can still see where the links point.",
          }
        : {
            id: "links",
            status: "warn",
            title: `${missingUrls.length} link(s) exist only as clickable annotations`,
            detail: `Not readable as text: ${missingUrls.join(", ")}. Many parsers read text only, so an icon-only link is invisible to them.`,
          },
    );
  }

  if (LIGATURES.test(text)) {
    findings.push({
      id: "ligatures",
      status: "warn",
      title: "Ligature characters in the extracted text",
      detail:
        'Words such as "first" came back containing a single ﬁ glyph. Some parsers do not normalise these, so keyword matching on those words silently fails.',
    });
  }

  const columnRisk = detectColumnInterleaving(lines);
  findings.push(
    columnRisk
      ? {
          id: "reading-order",
          status: "fail",
          title: "Reading order looks interleaved",
          detail: columnRisk,
        }
      : {
          id: "reading-order",
          status: "pass",
          title: "Reading order is linear",
          detail:
            "Text comes back in the order a human reads it, which is what a single-column layout guarantees.",
        },
  );

  if (pageCount > 2) {
    findings.push({
      id: "pages",
      status: "warn",
      title: `${pageCount} pages`,
      detail: "Beyond two pages, later content is rarely read at all at junior and mid level.",
    });
  }

  const score = scoreFindings(findings);
  return {
    extractedChars: text.length,
    pageCount,
    findings,
    recovered: {
      email: recoveredEmail,
      phone: recoveredPhone,
      firstLine,
      headings: foundHeadings,
      dateCount: dateMatches.length,
    },
    score,
  };
}

/**
 * A two-column layout tends to extract as alternating fragments: a run of very
 * short lines interleaved with long ones, because the sidebar and the main
 * column are emitted in content order rather than visual order.
 */
function detectColumnInterleaving(lines: string[]): string | null {
  if (lines.length < 12) return null;
  let alternations = 0;
  for (let i = 1; i < lines.length; i += 1) {
    const prevShort = lines[i - 1].length < 18;
    const currShort = lines[i].length < 18;
    if (prevShort !== currShort) alternations += 1;
  }
  const ratio = alternations / lines.length;
  const shortLines = lines.filter((l) => l.length < 18).length / lines.length;
  if (ratio > 0.62 && shortLines > 0.42) {
    return "Short and long fragments alternate throughout the extracted text, which is the signature of a multi-column layout being read column-blind. Content from the sidebar ends up spliced into sentences from the body.";
  }
  return null;
}

function scoreFindings(findings: AtsFinding[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.status === "fail") score -= 30;
    else if (f.status === "warn") score -= 8;
  }
  return Math.max(0, Math.min(100, score));
}
