import { collectBullets, type BulletRef, type Resume } from "../schema";

/**
 * These rules encode the edits a good reviewer makes by hand: state the outcome
 * not just the method, open with a real verb, drop the buzzwords, never ship a
 * placeholder. They are advisory — a rule firing is a prompt to look, not proof
 * the line is wrong — so nothing here blocks an export.
 */

export type LintSeverity = "error" | "warning" | "info";

export interface LintFinding {
  ruleId: string;
  severity: LintSeverity;
  message: string;
  hint: string;
  location: string;
  excerpt?: string;
}

const WEAK_OPENERS = [
  "helped",
  "assisted",
  "participated",
  "involved",
  "worked on",
  "responsible for",
  "tasked with",
  "supported",
  "contributed to",
  "took part",
];

const BUZZWORDS = [
  "team player",
  "hard working",
  "hardworking",
  "go-getter",
  "detail-oriented",
  "detail oriented",
  "results-driven",
  "self-starter",
  "synergy",
  "think outside the box",
  "dynamic professional",
  "passionate about",
];

const VAGUE_QUANTIFIERS = ["various", "several", "numerous", "multiple", "many"];

const PLACEHOLDER_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bfrom X to Y\b/i, label: "from X to Y" },
  { re: /\bTODO\b/i, label: "TODO" },
  { re: /\bTBD\b/i, label: "TBD" },
  { re: /\blorem ipsum\b/i, label: "lorem ipsum" },
  { re: /\bXX+\b/, label: "XX" },
  { re: /\[[^\]]{0,40}\]/, label: "square-bracket placeholder" },
  { re: /\b(insert|add) (a )?(number|metric|figure)\b/i, label: "unfilled metric prompt" },
];

/** Words that signal a bullet says what happened, not merely what was done. */
const OUTCOME_MARKERS = [
  "so ",
  "which ",
  "instead of",
  "rather than",
  "enabling",
  "preventing",
  "reducing",
  "cutting",
  "removing",
  "eliminating",
  "unblocking",
  "before ",
  "without ",
  "meant ",
  "resulting",
];

const FIRST_PERSON = /\b(i|my|me|we|our)\b/i;
const PASSIVE = /\b(was|were|is|are|been|being)\s+\w+(ed|en)\b/i;

function leadingWord(text: string): string {
  const match = text.trim().match(/^[A-Za-z-]+/);
  return match ? match[0].toLowerCase() : "";
}

function bulletLocation(b: BulletRef): string {
  return `${b.sectionTitle} › ${b.itemLabel} › bullet ${b.index + 1}`;
}

function excerpt(text: string, max = 90): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

export function lintResume(resume: Resume): LintFinding[] {
  const findings: LintFinding[] = [];
  const bullets = collectBullets(resume);

  for (const bullet of bullets) {
    const text = bullet.text.trim();
    if (text.length === 0) continue;
    const lower = text.toLowerCase();
    const where = bulletLocation(bullet);

    for (const { re, label } of PLACEHOLDER_PATTERNS) {
      if (re.test(text)) {
        findings.push({
          ruleId: "placeholder",
          severity: "error",
          message: `Unfilled placeholder (${label}).`,
          hint: "Replace it with a real figure or delete the clause. Placeholders that ship are the worst kind of typo.",
          location: where,
          excerpt: excerpt(text),
        });
        break;
      }
    }

    const opener = WEAK_OPENERS.find((w) => lower.startsWith(w));
    if (opener) {
      findings.push({
        ruleId: "weak-opener",
        severity: "warning",
        message: `Opens with "${opener}", which hides what you actually did.`,
        hint: "Start with the verb for the work itself: built, wrote, designed, parallelised, migrated.",
        location: where,
        excerpt: excerpt(text),
      });
    }

    if (FIRST_PERSON.test(text)) {
      findings.push({
        ruleId: "first-person",
        severity: "warning",
        message: "Uses first person.",
        hint: 'Resume bullets are conventionally written without pronouns: "Validated responses…" rather than "I validated responses…".',
        location: where,
        excerpt: excerpt(text),
      });
    }

    const hasNumber = /\d/.test(text);
    const hasOutcome = OUTCOME_MARKERS.some((m) => lower.includes(m));
    if (!hasNumber && !hasOutcome) {
      findings.push({
        ruleId: "no-outcome",
        severity: "warning",
        message: "States a method but no outcome.",
        hint: "Add what changed as a result — a number, a time saved, a class of bug prevented. The method alone reads as a job description.",
        location: where,
        excerpt: excerpt(text),
      });
    }

    if (PASSIVE.test(text)) {
      findings.push({
        ruleId: "passive-voice",
        severity: "info",
        message: "Reads as passive voice.",
        hint: "Active voice puts you in the sentence as the one who did the work.",
        location: where,
        excerpt: excerpt(text),
      });
    }

    const buzz = BUZZWORDS.find((b) => lower.includes(b));
    if (buzz) {
      findings.push({
        ruleId: "buzzword",
        severity: "warning",
        message: `Contains the filler phrase "${buzz}".`,
        hint: "Claims like this are unverifiable, so readers discount them. Show the behaviour instead.",
        location: where,
        excerpt: excerpt(text),
      });
    }

    const vague = VAGUE_QUANTIFIERS.find((v) => new RegExp(`\\b${v}\\b`, "i").test(text));
    if (vague && !hasNumber) {
      findings.push({
        ruleId: "vague-quantifier",
        severity: "info",
        message: `"${vague}" where a number would be stronger.`,
        hint: 'If it was six services, say six. "Several" reads as if you did not count.',
        location: where,
        excerpt: excerpt(text),
      });
    }

    if (text.length > 240) {
      findings.push({
        ruleId: "bullet-too-long",
        severity: "info",
        message: `Bullet is ${text.length} characters, long enough to be skipped.`,
        hint: "Aim for two rendered lines. Split it or cut the setup and keep the result.",
        location: where,
        excerpt: excerpt(text),
      });
    }
  }

  // Repeated openers read as formulaic when three or more bullets in the same
  // item start identically.
  const byItem = new Map<string, BulletRef[]>();
  for (const b of bullets) {
    const list = byItem.get(b.itemId) ?? [];
    list.push(b);
    byItem.set(b.itemId, list);
  }
  for (const [, list] of byItem) {
    const counts = new Map<string, number>();
    for (const b of list) {
      const word = leadingWord(b.text);
      if (!word) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    for (const [word, count] of counts) {
      if (count >= 3) {
        findings.push({
          ruleId: "repeated-opener",
          severity: "info",
          message: `${count} bullets under "${list[0].itemLabel}" open with "${word}".`,
          hint: "Vary the opening verb so the bullets do not blur together when skimmed.",
          location: `${list[0].sectionTitle} › ${list[0].itemLabel}`,
        });
      }
    }
  }

  findings.push(...lintDocument(resume));
  return findings;
}

function lintDocument(resume: Resume): LintFinding[] {
  const findings: LintFinding[] = [];
  const { basics } = resume;

  if (!basics.email.trim() && !basics.phone.trim()) {
    findings.push({
      ruleId: "missing-contact",
      severity: "error",
      message: "No email or phone number.",
      hint: "An applicant tracking system that cannot find a contact method may discard the record entirely.",
      location: "Header",
    });
  } else if (!basics.email.trim()) {
    findings.push({
      ruleId: "missing-email",
      severity: "error",
      message: "No email address.",
      hint: "Email is the field parsers look for first and the one recruiters actually use.",
      location: "Header",
    });
  }

  const urls = basics.links.map((l) => l.url.toLowerCase()).join(" ");
  if (!urls.includes("github") && !urls.includes("gitlab")) {
    findings.push({
      ruleId: "missing-code-link",
      severity: "warning",
      message: "No link to a code host.",
      hint: "If the resume lists projects, a reader who is interested has nowhere to go. That is worse than listing fewer projects.",
      location: "Header",
    });
  }
  if (!urls.includes("linkedin")) {
    findings.push({
      ruleId: "missing-linkedin",
      severity: "info",
      message: "No LinkedIn link.",
      hint: "Most recruiters look anyway; omitting it just adds a search step.",
      location: "Header",
    });
  }

  const summary = resume.sections.find((s) => s.kind === "summary");
  if (summary && summary.kind === "summary" && summary.visible) {
    const text = summary.text.trim();
    if (text.length === 0) {
      findings.push({
        ruleId: "empty-summary",
        severity: "info",
        message: "Summary section is visible but empty.",
        hint: "Either write two or three sentences or hide the section.",
        location: "Summary",
      });
    } else if (text.length > 480) {
      findings.push({
        ruleId: "long-summary",
        severity: "info",
        message: `Summary is ${text.length} characters.`,
        hint: "Three sentences is the ceiling. Anything longer is skipped and costs space the experience section needs.",
        location: "Summary",
      });
    }
    if (/\byears? of experience\b/i.test(text) && /\b(one|1)\b/i.test(text)) {
      findings.push({
        ruleId: "foregrounds-inexperience",
        severity: "warning",
        message: "Summary leads with how little experience you have.",
        hint: "Describe what you can do rather than how long you have been doing it. The dates already say the rest.",
        location: "Summary",
      });
    }
  }

  return findings;
}

export interface LintSummary {
  findings: LintFinding[];
  errors: number;
  warnings: number;
  infos: number;
  score: number;
}

/**
 * A single score is a blunt instrument, but it gives the panel a headline and
 * makes improvement visible as you edit. Errors cost far more than hints.
 */
export function summariseLint(findings: LintFinding[]): LintSummary {
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const infos = findings.filter((f) => f.severity === "info").length;
  const penalty = errors * 14 + warnings * 5 + infos * 1.5;
  return {
    findings,
    errors,
    warnings,
    infos,
    score: Math.max(0, Math.min(100, Math.round(100 - penalty))),
  };
}
