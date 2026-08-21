"use client";

import { useState } from "react";
import {
  uid,
  type CustomItem,
  type EducationItem,
  type ExperienceItem,
  type ProjectItem,
  type Resume,
  type Section,
  type SkillGroup,
  type CertificationItem,
} from "@/lib/schema";
import {
  AutoTextarea,
  Button,
  Card,
  EmptyState,
  Field,
  Pill,
  SectionLabel,
  TextInput,
} from "../ui";

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function replaceAt<T>(list: T[], index: number, value: T): T[] {
  const next = [...list];
  next[index] = value;
  return next;
}

function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

function OrderControls({
  index,
  count,
  onMove,
  onRemove,
  removeLabel = "Remove",
}: {
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" onClick={() => onMove(index - 1)} disabled={index === 0} title="Move up">
        ↑
      </Button>
      <Button
        variant="ghost"
        onClick={() => onMove(index + 1)}
        disabled={index === count - 1}
        title="Move down"
      >
        ↓
      </Button>
      <Button variant="danger" onClick={onRemove} title={removeLabel}>
        ✕
      </Button>
    </div>
  );
}

function BulletEditor({
  bullets,
  onChange,
}: {
  bullets: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <SectionLabel>Bullets</SectionLabel>
      {bullets.length === 0 ? (
        <p className="text-xs text-slate-400">No bullets yet.</p>
      ) : (
        bullets.map((bullet, i) => (
          <div className="flex items-start gap-1" key={i}>
            <AutoTextarea
              value={bullet}
              onChange={(v) => onChange(replaceAt(bullets, i, v))}
              placeholder="What you did, and what changed as a result."
            />
            <div className="flex flex-col pt-0.5">
              <Button
                variant="ghost"
                onClick={() => onChange(move(bullets, i, i - 1))}
                disabled={i === 0}
                title="Move up"
              >
                ↑
              </Button>
              <Button variant="danger" onClick={() => onChange(removeAt(bullets, i))} title="Delete">
                ✕
              </Button>
            </div>
          </div>
        ))
      )}
      <Button onClick={() => onChange([...bullets, ""])}>+ Bullet</Button>
    </div>
  );
}

function CommaList({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <TextInput
        value={value.join(", ")}
        onChange={(raw) =>
          onChange(
            raw
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0),
          )
        }
      />
    </Field>
  );
}

function ExperienceEditor({
  items,
  onChange,
}: {
  items: ExperienceItem[];
  onChange: (next: ExperienceItem[]) => void;
}) {
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <Card
          key={item.id}
          title={item.role || "Untitled role"}
          actions={
            <OrderControls
              index={i}
              count={items.length}
              onMove={(to) => onChange(move(items, i, to))}
              onRemove={() => onChange(removeAt(items, i))}
            />
          }
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="Role">
              <TextInput
                value={item.role}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, role: v }))}
              />
            </Field>
            <Field label="Organisation">
              <TextInput
                value={item.org}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, org: v }))}
              />
            </Field>
            <Field label="Location">
              <TextInput
                value={item.location}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, location: v }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start">
                <TextInput
                  value={item.start}
                  onChange={(v) => onChange(replaceAt(items, i, { ...item, start: v }))}
                  placeholder="Aug 2025"
                />
              </Field>
              <Field label="End">
                <TextInput
                  value={item.end}
                  onChange={(v) => onChange(replaceAt(items, i, { ...item, end: v }))}
                  placeholder="Present"
                />
              </Field>
            </div>
          </div>
          <div className="mt-2.5">
            <BulletEditor
              bullets={item.bullets}
              onChange={(bullets) => onChange(replaceAt(items, i, { ...item, bullets }))}
            />
          </div>
        </Card>
      ))}
      <Button
        onClick={() =>
          onChange([
            ...items,
            {
              id: uid("exp"),
              role: "",
              org: "",
              location: "",
              start: "",
              end: "",
              bullets: [""],
            },
          ])
        }
      >
        + Role
      </Button>
    </div>
  );
}

function ProjectsEditor({
  items,
  onChange,
}: {
  items: ProjectItem[];
  onChange: (next: ProjectItem[]) => void;
}) {
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <Card
          key={item.id}
          title={item.name || "Untitled project"}
          actions={
            <OrderControls
              index={i}
              count={items.length}
              onMove={(to) => onChange(move(items, i, to))}
              onRemove={() => onChange(removeAt(items, i))}
            />
          }
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name">
              <TextInput
                value={item.name}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, name: v }))}
              />
            </Field>
            <Field label="Link">
              <TextInput
                value={item.link}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, link: v }))}
                placeholder="https://github.com/..."
              />
            </Field>
          </div>
          <div className="mt-2">
            <CommaList
              label="Tech"
              value={item.tech}
              onChange={(tech) => onChange(replaceAt(items, i, { ...item, tech }))}
              hint="Comma separated."
            />
          </div>
          <div className="mt-2.5">
            <BulletEditor
              bullets={item.bullets}
              onChange={(bullets) => onChange(replaceAt(items, i, { ...item, bullets }))}
            />
          </div>
        </Card>
      ))}
      <Button
        onClick={() =>
          onChange([
            ...items,
            { id: uid("prj"), name: "", link: "", tech: [], bullets: [""] },
          ])
        }
      >
        + Project
      </Button>
    </div>
  );
}

function EducationEditor({
  items,
  onChange,
}: {
  items: EducationItem[];
  onChange: (next: EducationItem[]) => void;
}) {
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <Card
          key={item.id}
          title={item.degree || "Untitled qualification"}
          actions={
            <OrderControls
              index={i}
              count={items.length}
              onMove={(to) => onChange(move(items, i, to))}
              onRemove={() => onChange(removeAt(items, i))}
            />
          }
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="Degree">
              <TextInput
                value={item.degree}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, degree: v }))}
              />
            </Field>
            <Field label="Institution">
              <TextInput
                value={item.school}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, school: v }))}
              />
            </Field>
            <Field label="Location">
              <TextInput
                value={item.location}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, location: v }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start">
                <TextInput
                  value={item.start}
                  onChange={(v) => onChange(replaceAt(items, i, { ...item, start: v }))}
                />
              </Field>
              <Field label="End">
                <TextInput
                  value={item.end}
                  onChange={(v) => onChange(replaceAt(items, i, { ...item, end: v }))}
                />
              </Field>
            </div>
          </div>
          <div className="mt-2">
            <Field label="Note">
              <TextInput
                value={item.note}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, note: v }))}
                placeholder="Scholarship, distinction, relevant coursework"
              />
            </Field>
          </div>
        </Card>
      ))}
      <Button
        onClick={() =>
          onChange([
            ...items,
            { id: uid("edu"), degree: "", school: "", location: "", start: "", end: "", note: "" },
          ])
        }
      >
        + Qualification
      </Button>
    </div>
  );
}

function SkillsEditor({
  items,
  onChange,
}: {
  items: SkillGroup[];
  onChange: (next: SkillGroup[]) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <Card
          key={item.id}
          actions={
            <OrderControls
              index={i}
              count={items.length}
              onMove={(to) => onChange(move(items, i, to))}
              onRemove={() => onChange(removeAt(items, i))}
            />
          }
        >
          <div className="space-y-2">
            <Field label="Category">
              <TextInput
                value={item.category}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, category: v }))}
                placeholder="Test Automation"
              />
            </Field>
            <CommaList
              label="Entries"
              value={item.entries}
              onChange={(entries) => onChange(replaceAt(items, i, { ...item, entries }))}
              hint="Comma separated. Grouping by theme reads better than one long list."
            />
          </div>
        </Card>
      ))}
      <Button
        onClick={() => onChange([...items, { id: uid("skl"), category: "", entries: [] }])}
      >
        + Skill group
      </Button>
    </div>
  );
}

function CertificationsEditor({
  items,
  onChange,
}: {
  items: CertificationItem[];
  onChange: (next: CertificationItem[]) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <Card
          key={item.id}
          actions={
            <OrderControls
              index={i}
              count={items.length}
              onMove={(to) => onChange(move(items, i, to))}
              onRemove={() => onChange(removeAt(items, i))}
            />
          }
        >
          <div className="grid grid-cols-3 gap-2">
            <Field label="Name">
              <TextInput
                value={item.name}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, name: v }))}
              />
            </Field>
            <Field label="Issuer">
              <TextInput
                value={item.issuer}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, issuer: v }))}
              />
            </Field>
            <Field label="Year">
              <TextInput
                value={item.date}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, date: v }))}
              />
            </Field>
          </div>
        </Card>
      ))}
      <Button
        onClick={() => onChange([...items, { id: uid("crt"), name: "", issuer: "", date: "" }])}
      >
        + Certification
      </Button>
    </div>
  );
}

function CustomEditor({
  items,
  onChange,
}: {
  items: CustomItem[];
  onChange: (next: CustomItem[]) => void;
}) {
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <Card
          key={item.id}
          title={item.heading || "Untitled entry"}
          actions={
            <OrderControls
              index={i}
              count={items.length}
              onMove={(to) => onChange(move(items, i, to))}
              onRemove={() => onChange(removeAt(items, i))}
            />
          }
        >
          <div className="space-y-2">
            <Field label="Heading">
              <TextInput
                value={item.heading}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, heading: v }))}
              />
            </Field>
            <Field label="Detail">
              <TextInput
                value={item.detail}
                onChange={(v) => onChange(replaceAt(items, i, { ...item, detail: v }))}
              />
            </Field>
            <BulletEditor
              bullets={item.bullets}
              onChange={(bullets) => onChange(replaceAt(items, i, { ...item, bullets }))}
            />
          </div>
        </Card>
      ))}
      <Button
        onClick={() =>
          onChange([...items, { id: uid("cst"), heading: "", detail: "", bullets: [] }])
        }
      >
        + Entry
      </Button>
    </div>
  );
}

function SectionEditor({
  section,
  onChange,
}: {
  section: Section;
  onChange: (next: Section) => void;
}) {
  switch (section.kind) {
    case "summary":
      return (
        <AutoTextarea
          value={section.text}
          minRows={4}
          onChange={(text) => onChange({ ...section, text })}
          placeholder="Two or three sentences. What you do, what you are good at, what you are looking for."
        />
      );
    case "experience":
      return (
        <ExperienceEditor
          items={section.items}
          onChange={(items) => onChange({ ...section, items })}
        />
      );
    case "projects":
      return (
        <ProjectsEditor items={section.items} onChange={(items) => onChange({ ...section, items })} />
      );
    case "education":
      return (
        <EducationEditor
          items={section.items}
          onChange={(items) => onChange({ ...section, items })}
        />
      );
    case "skills":
      return (
        <SkillsEditor items={section.items} onChange={(items) => onChange({ ...section, items })} />
      );
    case "certifications":
      return (
        <CertificationsEditor
          items={section.items}
          onChange={(items) => onChange({ ...section, items })}
        />
      );
    case "custom":
      return (
        <CustomEditor items={section.items} onChange={(items) => onChange({ ...section, items })} />
      );
  }
}

const NEW_SECTIONS: Array<{ kind: Section["kind"]; label: string }> = [
  { kind: "experience", label: "Experience" },
  { kind: "projects", label: "Projects" },
  { kind: "education", label: "Education" },
  { kind: "skills", label: "Skills" },
  { kind: "certifications", label: "Certifications" },
  { kind: "custom", label: "Custom section" },
];

function blankSection(kind: Section["kind"], title: string): Section {
  const base = { id: uid("sec"), title, visible: true };
  if (kind === "summary") return { ...base, kind: "summary", text: "" };
  return { ...base, kind, items: [] } as Section;
}

export function ContentPanel({
  resume,
  onChange,
}: {
  resume: Resume;
  onChange: (next: Resume) => void;
}) {
  const [open, setOpen] = useState<string | null>(resume.sections[0]?.id ?? null);

  const setSection = (index: number, next: Section) =>
    onChange({ ...resume, sections: replaceAt(resume.sections, index, next) });

  return (
    <div className="space-y-4">
      <Card title="Header">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Name">
            <TextInput
              value={resume.basics.name}
              onChange={(name) => onChange({ ...resume, basics: { ...resume.basics, name } })}
            />
          </Field>
          <Field label="Headline">
            <TextInput
              value={resume.basics.headline}
              onChange={(headline) =>
                onChange({ ...resume, basics: { ...resume.basics, headline } })
              }
              placeholder="QA Automation Engineer"
            />
          </Field>
          <Field label="Email">
            <TextInput
              value={resume.basics.email}
              onChange={(email) => onChange({ ...resume, basics: { ...resume.basics, email } })}
            />
          </Field>
          <Field label="Phone">
            <TextInput
              value={resume.basics.phone}
              onChange={(phone) => onChange({ ...resume, basics: { ...resume.basics, phone } })}
            />
          </Field>
          <Field label="Location">
            <TextInput
              value={resume.basics.location}
              onChange={(location) =>
                onChange({ ...resume, basics: { ...resume.basics, location } })
              }
            />
          </Field>
        </div>

        <div className="mt-3 space-y-1.5">
          <SectionLabel>Links</SectionLabel>
          {resume.basics.links.map((link, i) => (
            <div className="flex items-center gap-1.5" key={link.id}>
              <div className="w-28 shrink-0">
                <TextInput
                  value={link.label}
                  placeholder="GitHub"
                  onChange={(label) =>
                    onChange({
                      ...resume,
                      basics: {
                        ...resume.basics,
                        links: replaceAt(resume.basics.links, i, { ...link, label }),
                      },
                    })
                  }
                />
              </div>
              <TextInput
                value={link.url}
                placeholder="https://github.com/you"
                onChange={(url) =>
                  onChange({
                    ...resume,
                    basics: {
                      ...resume.basics,
                      links: replaceAt(resume.basics.links, i, { ...link, url }),
                    },
                  })
                }
              />
              <Button
                variant="danger"
                onClick={() =>
                  onChange({
                    ...resume,
                    basics: { ...resume.basics, links: removeAt(resume.basics.links, i) },
                  })
                }
              >
                ✕
              </Button>
            </div>
          ))}
          <Button
            onClick={() =>
              onChange({
                ...resume,
                basics: {
                  ...resume.basics,
                  links: [...resume.basics.links, { id: uid("lnk"), label: "", url: "" }],
                },
              })
            }
          >
            + Link
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        <SectionLabel>Sections</SectionLabel>
        {resume.sections.map((section, i) => {
          const isOpen = open === section.id;
          return (
            <div
              key={section.id}
              className={`rounded-lg border bg-white ${isOpen ? "border-slate-400" : "border-slate-200"}`}
            >
              <div className="flex items-center gap-1.5 px-2.5 py-2">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : section.id)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span className="text-slate-400">{isOpen ? "▾" : "▸"}</span>
                  <span className="text-sm font-medium text-slate-800">{section.title}</span>
                  {!section.visible ? <Pill>hidden</Pill> : null}
                </button>
                <Button
                  variant="ghost"
                  title={section.visible ? "Hide from resume" : "Show on resume"}
                  onClick={() => setSection(i, { ...section, visible: !section.visible })}
                >
                  {section.visible ? "👁" : "🚫"}
                </Button>
                <OrderControls
                  index={i}
                  count={resume.sections.length}
                  onMove={(to) => onChange({ ...resume, sections: move(resume.sections, i, to) })}
                  onRemove={() =>
                    onChange({ ...resume, sections: removeAt(resume.sections, i) })
                  }
                />
              </div>
              {isOpen ? (
                <div className="space-y-2.5 border-t border-slate-100 p-2.5">
                  <Field label="Heading">
                    <TextInput
                      value={section.title}
                      onChange={(title) => setSection(i, { ...section, title })}
                    />
                  </Field>
                  <SectionEditor section={section} onChange={(next) => setSection(i, next)} />
                </div>
              ) : null}
            </div>
          );
        })}
        {resume.sections.length === 0 ? <EmptyState>No sections yet.</EmptyState> : null}
      </div>

      <Card title="Add a section">
        <div className="flex flex-wrap gap-1.5">
          {NEW_SECTIONS.map((entry) => (
            <Button
              key={entry.kind}
              onClick={() => {
                const section = blankSection(entry.kind, entry.label);
                onChange({ ...resume, sections: [...resume.sections, section] });
                setOpen(section.id);
              }}
            >
              + {entry.label}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
