import { describe, expect, it } from "vitest";
import { lintResume, summariseLint } from "@/lib/lint/rules";
import { cloneSample } from "@/lib/sample-resume";
import type { Resume } from "@/lib/schema";

function resumeWithBullet(text: string): Resume {
  return {
    version: 1,
    basics: {
      name: "Test Person",
      headline: "Engineer",
      email: "test@example.com",
      phone: "+91 90000 00000",
      location: "Pune",
      links: [
        { id: "l1", label: "GitHub", url: "https://github.com/test" },
        { id: "l2", label: "LinkedIn", url: "https://linkedin.com/in/test" },
      ],
    },
    sections: [
      {
        id: "s1",
        kind: "experience",
        title: "Experience",
        visible: true,
        items: [
          {
            id: "i1",
            role: "Engineer",
            org: "Acme",
            location: "Pune",
            start: "2025",
            end: "Present",
            bullets: [text],
          },
        ],
      },
    ],
  };
}

function ruleIds(resume: Resume): string[] {
  return lintResume(resume).map((f) => f.ruleId);
}

describe("bullet rules", () => {
  it("flags an unfilled placeholder as an error", () => {
    const findings = lintResume(
      resumeWithBullet("Cut regression run time from X to Y by parallelising."),
    );
    const placeholder = findings.find((f) => f.ruleId === "placeholder");

    expect(placeholder).toBeDefined();
    expect(placeholder?.severity).toBe("error");
  });

  it("flags a weak opener", () => {
    expect(ruleIds(resumeWithBullet("Helped with writing test cases for payments."))).toContain(
      "weak-opener",
    );
  });

  it("flags first person", () => {
    expect(ruleIds(resumeWithBullet("I validated responses against the schema."))).toContain(
      "first-person",
    );
  });

  it("flags a bullet that states a method with no outcome", () => {
    expect(
      ruleIds(resumeWithBullet("Parallelised the regression suite across workers with pabot.")),
    ).toContain("no-outcome");
  });

  it("accepts a bullet whose outcome is stated in words rather than numbers", () => {
    const ids = ruleIds(
      resumeWithBullet(
        "Designed collision-safe ticket IDs so concurrent runs could not corrupt each other's data.",
      ),
    );
    expect(ids).not.toContain("no-outcome");
  });

  it("accepts a bullet that carries a number", () => {
    const ids = ruleIds(
      resumeWithBullet("Built a Playwright suite of 280 end-to-end cases across 6 services."),
    );
    expect(ids).not.toContain("no-outcome");
  });

  it("flags filler phrases", () => {
    expect(ruleIds(resumeWithBullet("A detail-oriented team player who delivers."))).toContain(
      "buzzword",
    );
  });

  it("flags a vague quantifier only when no number is present", () => {
    expect(ruleIds(resumeWithBullet("Automated several services end to end."))).toContain(
      "vague-quantifier",
    );
    expect(
      ruleIds(resumeWithBullet("Automated several services, 6 in total, end to end.")),
    ).not.toContain("vague-quantifier");
  });

  it("flags three bullets in a row that open with the same verb", () => {
    const resume = resumeWithBullet("Built one thing which shipped.");
    if (resume.sections[0].kind === "experience") {
      resume.sections[0].items[0].bullets = [
        "Built the first thing which shipped.",
        "Built the second thing which shipped.",
        "Built the third thing which shipped.",
      ];
    }
    expect(ruleIds(resume)).toContain("repeated-opener");
  });
});

describe("document rules", () => {
  it("flags a missing code host link", () => {
    const resume = resumeWithBullet("Shipped a thing which worked.");
    resume.basics.links = [{ id: "l", label: "LinkedIn", url: "https://linkedin.com/in/test" }];
    expect(ruleIds(resume)).toContain("missing-code-link");
  });

  it("treats a missing email as an error", () => {
    const resume = resumeWithBullet("Shipped a thing which worked.");
    resume.basics.email = "";
    const finding = lintResume(resume).find((f) => f.ruleId === "missing-email");
    expect(finding?.severity).toBe("error");
  });

  it("flags a summary that leads with how little experience you have", () => {
    const resume = resumeWithBullet("Shipped a thing which worked.");
    resume.sections.push({
      id: "sum",
      kind: "summary",
      title: "Summary",
      visible: true,
      text: "Engineer with about one year of experience looking to transition into a new field.",
    });
    expect(ruleIds(resume)).toContain("foregrounds-inexperience");
  });
});

describe("scoring", () => {
  it("penalises errors far more heavily than hints", () => {
    const withError = summariseLint([
      { ruleId: "a", severity: "error", message: "", hint: "", location: "" },
    ]);
    const withInfos = summariseLint([
      { ruleId: "b", severity: "info", message: "", hint: "", location: "" },
      { ruleId: "c", severity: "info", message: "", hint: "", location: "" },
    ]);
    expect(withError.score).toBeLessThan(withInfos.score);
  });

  it("stays within 0 and 100 no matter how many findings there are", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      ruleId: `r${i}`,
      severity: "error" as const,
      message: "",
      hint: "",
      location: "",
    }));
    expect(summariseLint(many).score).toBe(0);
    expect(summariseLint([]).score).toBe(100);
  });

  it("finds the deliberately weak bullets in the bundled sample", () => {
    // The sample ships with a "Responsible for", a "Helped with" and a first
    // person bullet so the panel has something to show on first load.
    const ids = ruleIds(cloneSample());
    expect(ids).toContain("weak-opener");
    expect(ids).toContain("first-person");
  });
});
