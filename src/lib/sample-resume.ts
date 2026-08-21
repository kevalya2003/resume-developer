import type { Resume } from "./schema";

/**
 * Ids are literals rather than generated, so tests and visual-regression
 * baselines stay stable across runs.
 *
 * A few bullets here are deliberately weak — "Responsible for maintaining...",
 * a bullet that states a method with no outcome, a first-person one. They exist
 * so the content linter has something to flag the moment the app opens, instead
 * of presenting a clean panel that looks broken.
 */
export const sampleResume: Resume = {
  version: 1,
  basics: {
    name: "Priya Raman",
    headline: "QA Automation Engineer",
    email: "priya.raman@example.com",
    phone: "+91 98765 43210",
    location: "Bengaluru, India",
    links: [
      { id: "lnk-gh", label: "GitHub", url: "https://github.com/priyaraman" },
      { id: "lnk-li", label: "LinkedIn", url: "https://linkedin.com/in/priyaraman" },
    ],
  },
  sections: [
    {
      id: "sec-summary",
      kind: "summary",
      title: "Summary",
      visible: true,
      text: "QA Automation Engineer who tests below the UI. I write Python automation that validates message flows and asserts database state, and I own the CI pipelines that run it across four environments.",
    },
    {
      id: "sec-skills",
      kind: "skills",
      title: "Technical Skills",
      visible: true,
      items: [
        {
          id: "skl-1",
          category: "Test Automation",
          entries: ["Pytest", "Playwright", "Selenium", "Robot Framework", "Page Object Model"],
        },
        {
          id: "skl-2",
          category: "Testing Types",
          entries: ["Functional", "Regression", "Integration", "End-to-End", "API", "Database"],
        },
        {
          id: "skl-3",
          category: "CI/CD & Tooling",
          entries: ["Jenkins", "GitHub Actions", "Docker", "Git", "JIRA", "Postman"],
        },
        { id: "skl-4", category: "Languages", entries: ["Python", "TypeScript", "SQL"] },
      ],
    },
    {
      id: "sec-experience",
      kind: "experience",
      title: "Experience",
      visible: true,
      items: [
        {
          id: "exp-1",
          role: "QA Automation Engineer",
          org: "Northwind Systems",
          location: "Bengaluru",
          start: "Aug 2025",
          end: "Present",
          bullets: [
            "Built a Playwright suite of 280 end-to-end cases across 6 services, cutting the manual regression pass from two days to under three hours.",
            "Wrote a Python library that asserts PostgreSQL state after each API call, extending coverage past the UI into the data layer.",
            "Responsible for maintaining the nightly regression job and reporting results to the team.",
            "Parallelised the suite across 8 workers with isolated per-worker test data, removing the shared fixtures that had made concurrent runs unsafe.",
          ],
        },
        {
          id: "exp-2",
          role: "Software Engineering Intern",
          org: "Lumen Labs",
          location: "Remote",
          start: "Jan 2025",
          end: "Jul 2025",
          bullets: [
            "Helped with writing test cases for the payments module.",
            "Added contract tests against the public API schema so a breaking change fails the build instead of reaching staging.",
          ],
        },
      ],
    },
    {
      id: "sec-projects",
      kind: "projects",
      title: "Projects",
      visible: true,
      items: [
        {
          id: "prj-1",
          name: "Flaky Test Detector",
          link: "https://github.com/priyaraman/flake-detector",
          tech: ["Python", "Pytest", "SQLite", "GitHub Actions"],
          bullets: [
            "Reran the suite on a schedule and recorded per-test outcomes, identifying 14 non-deterministic tests that had been silently retried for months.",
            "Quarantined flaky tests automatically and tracked flake rate over time, so the signal from a red build became trustworthy again.",
          ],
        },
        {
          id: "prj-2",
          name: "API Contract Harness",
          link: "https://github.com/priyaraman/contract-harness",
          tech: ["TypeScript", "OpenAPI", "Vitest"],
          bullets: [
            "I validated responses against the OpenAPI spec and failed the pipeline on any breaking schema change.",
            "Generated request fixtures from the spec so new endpoints came with coverage by default.",
          ],
        },
      ],
    },
    {
      id: "sec-education",
      kind: "education",
      title: "Education",
      visible: true,
      items: [
        {
          id: "edu-1",
          degree: "B.E. Computer Science",
          school: "PES University",
          location: "Bengaluru",
          start: "2021",
          end: "2025",
          note: "First-class with distinction",
        },
      ],
    },
    {
      id: "sec-certs",
      kind: "certifications",
      title: "Certifications",
      visible: false,
      items: [
        { id: "crt-1", name: "ISTQB Foundation Level", issuer: "ISTQB", date: "2025" },
      ],
    },
  ],
};

export function cloneSample(): Resume {
  return structuredClone(sampleResume);
}

export const emptyResume: Resume = {
  version: 1,
  basics: { name: "", headline: "", email: "", phone: "", location: "", links: [] },
  sections: [
    { id: "sec-summary", kind: "summary", title: "Summary", visible: true, text: "" },
    { id: "sec-experience", kind: "experience", title: "Experience", visible: true, items: [] },
    { id: "sec-education", kind: "education", title: "Education", visible: true, items: [] },
    { id: "sec-skills", kind: "skills", title: "Technical Skills", visible: true, items: [] },
    { id: "sec-projects", kind: "projects", title: "Projects", visible: true, items: [] },
  ],
};
