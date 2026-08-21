import { collectBullets, type Resume } from "../schema";

/**
 * Keyword matching against a job description, with one deliberate refinement:
 * a term that appears only in the skills list counts differently from one that
 * appears inside a bullet. The first is a claim, the second is evidence, and
 * interviewers treat them very differently. The panel surfaces that gap rather
 * than reporting a single match percentage that a skills-list dump could game.
 */

const DICTIONARY: string[] = [
  // Languages
  "Python", "Java", "JavaScript", "TypeScript", "Go", "Rust", "C#", "C++", "Ruby", "PHP",
  "Kotlin", "Swift", "Scala", "SQL", "Bash", "PowerShell", "Groovy", "Perl", "R",
  // Test automation
  "Selenium", "Playwright", "Cypress", "Puppeteer", "Robot Framework", "Pytest", "unittest",
  "TestNG", "JUnit", "Cucumber", "Behave", "SpecFlow", "Appium", "WebdriverIO", "Jest",
  "Vitest", "Mocha", "Chai", "Karate", "REST Assured", "Postman", "SoapUI", "JMeter",
  "Gatling", "Locust", "k6", "pabot", "Allure", "TestRail", "Zephyr", "Xray",
  "Page Object Model", "BDD", "TDD", "Contract Testing", "Visual Regression",
  // Testing concepts
  "Regression Testing", "Smoke Testing", "Sanity Testing", "Integration Testing",
  "End-to-End Testing", "Unit Testing", "API Testing", "Performance Testing",
  "Load Testing", "Accessibility Testing", "Security Testing", "Exploratory Testing",
  "Test Plan", "Test Strategy", "Test Cases", "Defect Management", "Root Cause Analysis",
  "Shift Left", "Test Data Management", "Flaky Tests", "Code Coverage",
  // Data
  "PostgreSQL", "MySQL", "Oracle", "SQL Server", "MongoDB", "Redis", "Cassandra",
  "Elasticsearch", "Snowflake", "BigQuery", "Redshift", "Databricks", "Spark", "Hadoop",
  "Airflow", "dbt", "Kafka", "RabbitMQ", "Flink", "Pandas", "NumPy", "SQLAlchemy",
  "Great Expectations", "ETL", "ELT", "Data Warehouse", "Data Modelling", "Data Quality",
  "Data Pipeline", "Star Schema", "Power BI", "Tableau", "Looker",
  // Backend / web
  "REST", "GraphQL", "gRPC", "FastAPI", "Django", "Flask", "Spring Boot", "Express",
  "Node.js", "React", "Angular", "Vue", "Next.js", "HTML", "CSS", "Tailwind",
  "Microservices", "OpenAPI", "Swagger", "WebSocket", "OAuth", "JWT",
  // DevOps / cloud
  "Docker", "Kubernetes", "Helm", "Terraform", "Ansible", "Jenkins", "GitLab CI",
  "GitHub Actions", "CircleCI", "Azure DevOps", "TeamCity", "Bamboo", "ArgoCD",
  "AWS", "Azure", "GCP", "Linux", "Nginx", "Prometheus", "Grafana", "Datadog",
  "Splunk", "ELK", "CI/CD", "Git", "Maven", "Gradle", "npm",
  // Process
  "Agile", "Scrum", "Kanban", "JIRA", "Confluence", "Sprint", "Code Review",
  "Pair Programming", "Stakeholder Management", "Mentoring",
];

/** Written forms that mean the same thing as a dictionary term. */
const ALIASES: Record<string, string[]> = {
  "JavaScript": ["JS", "ECMAScript"],
  "TypeScript": ["TS"],
  "Kubernetes": ["K8s"],
  "GitHub Actions": ["GHA"],
  "PostgreSQL": ["Postgres"],
  "CI/CD": ["CICD", "CI CD", "continuous integration", "continuous delivery", "continuous deployment"],
  "End-to-End Testing": ["E2E", "end to end testing"],
  "Robot Framework": ["RobotFramework"],
  "Great Expectations": ["GX"],
  "Node.js": ["NodeJS", "Node"],
  "REST": ["RESTful"],
  "Test Cases": ["test case"],
  "Data Modelling": ["data modeling"],
  "Performance Testing": ["perf testing"],
  "Azure DevOps": ["ADO", "VSTS"],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word boundaries fail on terms like "C++" and ".NET" because the punctuation
 * is not a word character, so the boundary is asserted against the adjacent
 * character class instead of blindly using \b.
 */
function termRegex(term: string): RegExp {
  const escaped = escapeRegExp(term).replace(/\\?[\s/]+/g, "[\\s/_-]+");
  const startsWord = /^[\w]/.test(term);
  const endsWord = /[\w]$/.test(term);
  const prefix = startsWord ? "(?<![\\w])" : "(?<![^\\s(,.;:])";
  const suffix = endsWord ? "(?![\\w])" : "(?![^\\s),.;:])";
  return new RegExp(`${prefix}${escaped}${suffix}`, "gi");
}

function countMatches(haystack: string, term: string): number {
  const forms = [term, ...(ALIASES[term] ?? [])];
  let total = 0;
  for (const form of forms) {
    const matches = haystack.match(termRegex(form));
    if (matches) total += matches.length;
  }
  return total;
}

export interface KeywordHit {
  term: string;
  /** How often the job description mentions it — a proxy for how much they care. */
  jdCount: number;
  inResume: boolean;
  /** True when the term appears only in a skills list and never in a bullet. */
  claimedOnly: boolean;
}

export interface JdAnalysis {
  matched: KeywordHit[];
  claimedOnly: KeywordHit[];
  missing: KeywordHit[];
  coverage: number;
  evidenceCoverage: number;
  totalTerms: number;
  notes: string[];
}

function skillTerms(resume: Resume): string[] {
  const out: string[] = [];
  for (const section of resume.sections) {
    if (section.kind !== "skills") continue;
    for (const group of section.items) out.push(...group.entries);
  }
  for (const section of resume.sections) {
    if (section.kind !== "projects") continue;
    for (const item of section.items) out.push(...item.tech);
  }
  return out.map((s) => s.trim()).filter((s) => s.length > 1);
}

function evidenceText(resume: Resume): string {
  const parts = collectBullets(resume).map((b) => b.text);
  for (const section of resume.sections) {
    if (section.kind === "summary" && section.visible) parts.push(section.text);
    if (section.kind === "experience" && section.visible) {
      for (const item of section.items) parts.push(item.role, item.org);
    }
  }
  return parts.join("\n");
}

function claimText(resume: Resume): string {
  return skillTerms(resume).join("\n");
}

export function analyseJd(jdText: string, resume: Resume): JdAnalysis {
  const jd = jdText.trim();
  if (jd.length === 0) {
    return {
      matched: [],
      claimedOnly: [],
      missing: [],
      coverage: 0,
      evidenceCoverage: 0,
      totalTerms: 0,
      notes: [],
    };
  }

  // The universe of terms is the curated dictionary plus whatever the user has
  // listed themselves, so the analysis works in domains the dictionary misses.
  const universe = new Set<string>(DICTIONARY);
  for (const term of skillTerms(resume)) {
    const known = DICTIONARY.find((d) => d.toLowerCase() === term.toLowerCase());
    universe.add(known ?? term);
  }

  const evidence = evidenceText(resume);
  const claims = claimText(resume);

  const hits: KeywordHit[] = [];
  for (const term of universe) {
    const jdCount = countMatches(jd, term);
    if (jdCount === 0) continue;
    const inEvidence = countMatches(evidence, term) > 0;
    const inClaims = countMatches(claims, term) > 0;
    hits.push({
      term,
      jdCount,
      inResume: inEvidence || inClaims,
      claimedOnly: inClaims && !inEvidence,
    });
  }

  hits.sort((a, b) => b.jdCount - a.jdCount || a.term.localeCompare(b.term));

  const matched = hits.filter((h) => h.inResume && !h.claimedOnly);
  const claimedOnly = hits.filter((h) => h.claimedOnly);
  const missing = hits.filter((h) => !h.inResume);
  const total = hits.length;

  const notes: string[] = [];
  const coverage = total === 0 ? 0 : (matched.length + claimedOnly.length) / total;
  const evidenceCoverage = total === 0 ? 0 : matched.length / total;

  if (total === 0) {
    notes.push(
      "No recognised skill terms found in that text. Paste the full job description rather than a summary — the requirements section is where the keywords live.",
    );
  } else {
    if (coverage < 0.4) {
      notes.push(
        "Fewer than 40% of the terms in this posting appear anywhere on your resume. Either the role is a stretch or the resume needs retargeting before you apply.",
      );
    } else if (coverage > 0.85) {
      notes.push(
        "Strong overlap. Resist the urge to add the remaining terms for their own sake — a reader notices padding faster than a parser rewards it.",
      );
    }
    if (claimedOnly.length >= 3) {
      notes.push(
        `${claimedOnly.length} terms appear only in your skills list and never in a bullet. An interviewer reads those as claims without evidence, and they are exactly what gets probed first.`,
      );
    }
    notes.push(
      "Add missing terms only where they are true and where you can describe the work. Keyword stuffing survives the parser and fails the human on the other side of it.",
    );
  }

  return { matched, claimedOnly, missing, coverage, evidenceCoverage, totalTerms: total, notes };
}
