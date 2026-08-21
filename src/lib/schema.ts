import { z } from "zod";

/**
 * The resume is stored as an ordered list of typed sections rather than a fixed
 * set of named fields. Templates iterate the list, so adding a section type or
 * reordering sections never requires touching a layout, and a user can drop a
 * section they don't need without leaving an empty heading behind.
 */

export const linkSchema = z.object({
  id: z.string(),
  label: z.string(),
  url: z.string(),
});
export type Link = z.infer<typeof linkSchema>;

export const basicsSchema = z.object({
  name: z.string(),
  headline: z.string(),
  email: z.string(),
  phone: z.string(),
  location: z.string(),
  links: z.array(linkSchema),
});
export type Basics = z.infer<typeof basicsSchema>;

export const experienceItemSchema = z.object({
  id: z.string(),
  role: z.string(),
  org: z.string(),
  location: z.string(),
  start: z.string(),
  end: z.string(),
  bullets: z.array(z.string()),
});
export type ExperienceItem = z.infer<typeof experienceItemSchema>;

export const educationItemSchema = z.object({
  id: z.string(),
  degree: z.string(),
  school: z.string(),
  location: z.string(),
  start: z.string(),
  end: z.string(),
  note: z.string(),
});
export type EducationItem = z.infer<typeof educationItemSchema>;

export const projectItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  link: z.string(),
  tech: z.array(z.string()),
  bullets: z.array(z.string()),
});
export type ProjectItem = z.infer<typeof projectItemSchema>;

export const skillGroupSchema = z.object({
  id: z.string(),
  category: z.string(),
  entries: z.array(z.string()),
});
export type SkillGroup = z.infer<typeof skillGroupSchema>;

export const certificationItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  issuer: z.string(),
  date: z.string(),
});
export type CertificationItem = z.infer<typeof certificationItemSchema>;

export const customItemSchema = z.object({
  id: z.string(),
  heading: z.string(),
  detail: z.string(),
  bullets: z.array(z.string()),
});
export type CustomItem = z.infer<typeof customItemSchema>;

const sectionBase = { id: z.string(), title: z.string(), visible: z.boolean() };

export const sectionSchema = z.discriminatedUnion("kind", [
  z.object({ ...sectionBase, kind: z.literal("summary"), text: z.string() }),
  z.object({ ...sectionBase, kind: z.literal("experience"), items: z.array(experienceItemSchema) }),
  z.object({ ...sectionBase, kind: z.literal("education"), items: z.array(educationItemSchema) }),
  z.object({ ...sectionBase, kind: z.literal("projects"), items: z.array(projectItemSchema) }),
  z.object({ ...sectionBase, kind: z.literal("skills"), items: z.array(skillGroupSchema) }),
  z.object({
    ...sectionBase,
    kind: z.literal("certifications"),
    items: z.array(certificationItemSchema),
  }),
  z.object({ ...sectionBase, kind: z.literal("custom"), items: z.array(customItemSchema) }),
]);
export type Section = z.infer<typeof sectionSchema>;
export type SectionKind = Section["kind"];

export const resumeSchema = z.object({
  version: z.literal(1),
  basics: basicsSchema,
  sections: z.array(sectionSchema),
});
export type Resume = z.infer<typeof resumeSchema>;

let counter = 0;

/**
 * Ids only need to be unique within one document and stable across a render, so
 * a counter beats crypto.randomUUID here: it keeps snapshots and visual
 * regression baselines deterministic between runs.
 */
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}-${Date.now().toString(36)}`;
}

export function resetUidCounter(): void {
  counter = 0;
}

/** Flattens every piece of user-authored prose, for linting and keyword matching. */
export function collectText(resume: Resume): string[] {
  const out: string[] = [resume.basics.name, resume.basics.headline];
  for (const section of resume.sections) {
    if (!section.visible) continue;
    out.push(section.title);
    switch (section.kind) {
      case "summary":
        out.push(section.text);
        break;
      case "experience":
        for (const item of section.items) {
          out.push(item.role, item.org, ...item.bullets);
        }
        break;
      case "education":
        for (const item of section.items) {
          out.push(item.degree, item.school, item.note);
        }
        break;
      case "projects":
        for (const item of section.items) {
          out.push(item.name, ...item.tech, ...item.bullets);
        }
        break;
      case "skills":
        for (const item of section.items) {
          out.push(item.category, ...item.entries);
        }
        break;
      case "certifications":
        for (const item of section.items) {
          out.push(item.name, item.issuer);
        }
        break;
      case "custom":
        for (const item of section.items) {
          out.push(item.heading, item.detail, ...item.bullets);
        }
        break;
    }
  }
  return out.filter((s) => s.trim().length > 0);
}

/** Every bullet in the document, tagged with where it came from, for the linter. */
export interface BulletRef {
  sectionId: string;
  sectionTitle: string;
  itemId: string;
  itemLabel: string;
  index: number;
  text: string;
}

export function collectBullets(resume: Resume): BulletRef[] {
  const out: BulletRef[] = [];
  for (const section of resume.sections) {
    if (!section.visible) continue;
    if (section.kind === "experience" || section.kind === "projects" || section.kind === "custom") {
      for (const item of section.items) {
        const label =
          "role" in item ? `${item.role} — ${item.org}` : "name" in item ? item.name : item.heading;
        item.bullets.forEach((text, index) => {
          out.push({
            sectionId: section.id,
            sectionTitle: section.title,
            itemId: item.id,
            itemLabel: label,
            index,
            text,
          });
        });
      }
    }
  }
  return out;
}
