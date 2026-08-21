import { describe, expect, it } from "vitest";
import { analyseExtractedText, type AtsExpectation } from "@/lib/ats/parse";
import { groupIntoLines } from "@/lib/ats/lines";

const expectation: AtsExpectation = {
  name: "Priya Raman",
  email: "priya.raman@example.com",
  phone: "+91 98765 43210",
  sectionTitles: ["Summary", "Experience", "Education"],
  linkUrls: ["https://github.com/priyaraman"],
  bulletCount: 4,
};

const cleanText = [
  "Priya Raman",
  "QA Automation Engineer",
  "Bengaluru, India | +91 98765 43210 | priya.raman@example.com | github.com/priyaraman",
  "Summary",
  "Engineer who tests below the UI.",
  "Experience",
  "QA Automation Engineer — Northwind Systems Aug 2025 – Present",
  "Built a Playwright suite of 280 cases.",
  "Education",
  "B.E. Computer Science — PES University 2021 – 2025",
].join("\n");

function statusOf(text: string, id: string, pages = 1) {
  const report = analyseExtractedText(text, expectation, pages);
  return report.findings.find((f) => f.id === id)?.status;
}

describe("analyseExtractedText", () => {
  it("fails outright when nothing can be extracted", () => {
    const report = analyseExtractedText("   ", expectation, 1);
    expect(report.score).toBe(0);
    expect(report.findings[0].id).toBe("no-text");
  });

  it("recovers contact details from a clean single-column extraction", () => {
    const report = analyseExtractedText(cleanText, expectation, 1);

    expect(report.recovered.email).toBe("priya.raman@example.com");
    expect(statusOf(cleanText, "email")).toBe("pass");
    expect(statusOf(cleanText, "phone")).toBe("pass");
    expect(statusOf(cleanText, "name")).toBe("pass");
  });

  it("passes reading order for linear text", () => {
    expect(statusOf(cleanText, "reading-order")).toBe("pass");
  });

  it("confirms every section heading survived as its own line", () => {
    const report = analyseExtractedText(cleanText, expectation, 1);
    const headings = report.findings.find((f) => f.id === "headings");

    expect(headings?.status).toBe("pass");
    expect(report.recovered.headings).toEqual(["Summary", "Experience", "Education"]);
  });

  it("warns when a heading was swallowed into a paragraph", () => {
    const merged = cleanText.replace("Experience\n", "");
    expect(statusOf(merged, "headings")).toBe("warn");
  });

  it("detects the interleaving signature of a two-column layout", () => {
    const interleaved = [
      "Priya Raman",
      "Skills",
      "Engineer who tests below the UI and owns pipelines.",
      "Python",
      "Built a Playwright suite of 280 cases across six services.",
      "Docker",
      "Parallelised the suite across eight workers safely.",
      "JIRA",
      "Wrote a library asserting database state after each call.",
      "Agile",
      "Reported defects with reproducible steps and evidence.",
      "Git",
      "Added contract tests against the published API schema.",
      "AWS",
      "Reran the suite nightly and tracked flake rate over time.",
      "SQL",
    ].join("\n");

    expect(statusOf(interleaved, "reading-order")).toBe("fail");
  });

  it("notices ligature glyphs that break keyword matching", () => {
    const withLigature = cleanText.replace("Built", "\uFB01rst Built");
    expect(statusOf(withLigature, "ligatures")).toBe("warn");
  });

  it("warns when a link exists only as a clickable annotation", () => {
    const withoutUrl = cleanText.replace(" | github.com/priyaraman", "");
    expect(statusOf(withoutUrl, "links")).toBe("warn");
  });

  it("warns about a resume longer than two pages", () => {
    expect(statusOf(cleanText, "pages", 3)).toBe("warn");
  });

  it("scores a clean document well above a broken one", () => {
    const clean = analyseExtractedText(cleanText, expectation, 1).score;
    const broken = analyseExtractedText("nothing useful here at all", expectation, 1).score;
    expect(clean).toBeGreaterThan(broken);
  });
});

describe("groupIntoLines", () => {
  const item = (str: string, x: number, y: number, width = str.length * 3) => ({
    str,
    transform: [1, 0, 0, 1, x, y],
    width,
  });

  it("groups runs sharing a baseline into one line", () => {
    const lines = groupIntoLines([item("Hello", 10, 700, 20), item("world", 32, 700, 20)]);
    expect(lines).toEqual(["Hello world"]);
  });

  it("orders lines top to bottom, not in content order", () => {
    const lines = groupIntoLines([item("second", 10, 680), item("first", 10, 700)]);
    expect(lines).toEqual(["first", "second"]);
  });

  it("orders runs left to right within a line", () => {
    const lines = groupIntoLines([item("b", 60, 700, 5), item("a", 10, 700, 5)]);
    expect(lines).toEqual(["a b"]);
  });

  it("does not fuse adjacent runs into one word", () => {
    // Runs that abut exactly should still be separated when a gap exists.
    const lines = groupIntoLines([item("Auto", 10, 700, 20), item("mation", 45, 700, 25)]);
    expect(lines[0]).toBe("Auto mation");
  });

  it("treats baselines within tolerance as the same line", () => {
    const lines = groupIntoLines([item("same", 10, 700, 15), item("line", 30, 701.4, 15)]);
    expect(lines).toHaveLength(1);
  });

  it("drops empty runs", () => {
    const lines = groupIntoLines([item("", 10, 700, 0), item("kept", 20, 700, 15)]);
    expect(lines).toEqual(["kept"]);
  });
});
