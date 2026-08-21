import { describe, expect, it } from "vitest";
import { analyseJd } from "@/lib/jd/keywords";
import type { Resume } from "@/lib/schema";

function resume(opts: { bullets?: string[]; skills?: string[] } = {}): Resume {
  return {
    version: 1,
    basics: {
      name: "Test Person",
      headline: "QA Engineer",
      email: "t@example.com",
      phone: "1",
      location: "Pune",
      links: [],
    },
    sections: [
      {
        id: "skills",
        kind: "skills",
        title: "Skills",
        visible: true,
        items: [{ id: "g", category: "Tools", entries: opts.skills ?? [] }],
      },
      {
        id: "exp",
        kind: "experience",
        title: "Experience",
        visible: true,
        items: [
          {
            id: "i",
            role: "QA Engineer",
            org: "Acme",
            location: "Pune",
            start: "2025",
            end: "Now",
            bullets: opts.bullets ?? [],
          },
        ],
      },
    ],
  };
}

describe("analyseJd", () => {
  it("returns nothing for empty input", () => {
    const result = analyseJd("", resume());
    expect(result.totalTerms).toBe(0);
    expect(result.notes).toHaveLength(0);
  });

  it("separates a term demonstrated in a bullet from one only listed as a skill", () => {
    const result = analyseJd(
      "We need strong Playwright and Kubernetes experience.",
      resume({
        bullets: ["Built a Playwright suite covering 40 journeys."],
        skills: ["Kubernetes"],
      }),
    );

    expect(result.matched.map((h) => h.term)).toContain("Playwright");
    expect(result.claimedOnly.map((h) => h.term)).toContain("Kubernetes");
    expect(result.missing).toHaveLength(0);
  });

  it("reports terms the resume never mentions", () => {
    const result = analyseJd("Must know Cypress and Terraform.", resume({ bullets: ["Tested."] }));
    const missing = result.missing.map((h) => h.term);

    expect(missing).toContain("Cypress");
    expect(missing).toContain("Terraform");
  });

  it("ranks terms by how often the posting mentions them", () => {
    const result = analyseJd(
      "Selenium is essential. Selenium experience required. Selenium daily. Some Docker too.",
      resume({ bullets: ["Nothing relevant."] }),
    );

    expect(result.missing[0].term).toBe("Selenium");
    expect(result.missing[0].jdCount).toBe(3);
  });

  it("matches known aliases", () => {
    const result = analyseJd("Deep K8s and JS experience needed.", resume({ bullets: [] }));
    const terms = result.missing.map((h) => h.term);

    expect(terms).toContain("Kubernetes");
    expect(terms).toContain("JavaScript");
  });

  it("does not match a term inside a longer word", () => {
    // "Go" must not match "Going", "algorithm" and so on.
    const result = analyseJd("Going forward the goal is good governance.", resume());
    expect(result.missing.map((h) => h.term)).not.toContain("Go");
  });

  it("handles terms containing punctuation", () => {
    const result = analyseJd("Experience with CI/CD and C++ required.", resume());
    const terms = result.missing.map((h) => h.term);

    expect(terms).toContain("CI/CD");
    expect(terms).toContain("C++");
  });

  it("extends the term universe with skills the dictionary does not know", () => {
    const result = analyseJd(
      "You will maintain our Frobnicator platform.",
      resume({ skills: ["Frobnicator"] }),
    );

    expect(result.claimedOnly.map((h) => h.term)).toContain("Frobnicator");
  });

  it("warns when the resume covers very little of the posting", () => {
    const result = analyseJd(
      "Terraform, Kubernetes, Go, Rust, Cassandra, Spark, Flink and Scala required.",
      resume({ bullets: ["Wrote some tests."] }),
    );

    expect(result.coverage).toBeLessThan(0.4);
    expect(result.notes.join(" ")).toContain("retargeting");
  });

  it("always warns against keyword stuffing when terms were found", () => {
    const result = analyseJd("Playwright required.", resume({ bullets: ["Used Playwright."] }));
    expect(result.notes.join(" ")).toContain("stuffing");
  });

  it("counts coverage over the union of matched and claimed terms", () => {
    const result = analyseJd(
      "Playwright and Docker needed.",
      resume({ bullets: ["Used Playwright daily."], skills: ["Docker"] }),
    );

    expect(result.coverage).toBe(1);
    expect(result.evidenceCoverage).toBe(0.5);
  });
});
