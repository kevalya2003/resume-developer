import type { CSSProperties, ReactElement } from "react";
import type { Resume, Section } from "../schema";
import { buildTokens, type Composition, type LayoutId } from "./tokens";

/**
 * A pure component with no hooks and no browser APIs, because it renders in two
 * very different places: React on the client for the live preview, and
 * renderToStaticMarkup on the server for the PDF. Anything stateful here would
 * make the two outputs diverge.
 */

function Contact({ resume }: { resume: Resume }): ReactElement {
  const parts: ReactElement[] = [];
  const push = (node: ReactElement) => {
    if (parts.length > 0) {
      parts.push(
        <span className="rd-contact-sep" key={`sep-${parts.length}`}>
          |
        </span>,
      );
    }
    parts.push(node);
  };

  if (resume.basics.location) push(<span key="loc">{resume.basics.location}</span>);
  if (resume.basics.phone) push(<span key="tel">{resume.basics.phone}</span>);
  if (resume.basics.email) {
    push(
      <a href={`mailto:${resume.basics.email}`} key="mail">
        {resume.basics.email}
      </a>,
    );
  }
  for (const link of resume.basics.links) {
    if (!link.label || !link.url) continue;
    push(
      <a href={link.url} key={link.id}>
        {link.label}
      </a>,
    );
  }
  return <div className="rd-contact">{parts}</div>;
}

function Header({ resume, layout }: { resume: Resume; layout: LayoutId }): ReactElement {
  const name = <div className="rd-name">{resume.basics.name || "Your Name"}</div>;
  const headline = resume.basics.headline ? (
    <div className="rd-headline">{resume.basics.headline}</div>
  ) : null;

  if (layout === "compact") {
    return (
      <div className="rd-header">
        <div>
          {name}
          {headline}
        </div>
        <div className="rd-header-right">
          <Contact resume={resume} />
        </div>
      </div>
    );
  }

  return (
    <div className="rd-header">
      {name}
      {headline}
      <Contact resume={resume} />
    </div>
  );
}

function Bullets({ bullets }: { bullets: string[] }): ReactElement | null {
  const visible = bullets.filter((b) => b.trim().length > 0);
  if (visible.length === 0) return null;
  return (
    <ul className="rd-bullets">
      {visible.map((bullet, i) => (
        <li key={i}>{bullet}</li>
      ))}
    </ul>
  );
}

function dateRange(start: string, end: string): string {
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

function SectionBody({ section }: { section: Section }): ReactElement | null {
  switch (section.kind) {
    case "summary":
      return section.text.trim() ? <p className="rd-summary">{section.text}</p> : null;

    case "experience":
      return (
        <>
          {section.items.map((item) => (
            <div className="rd-item" key={item.id}>
              <div className="rd-item-head">
                <div>
                  <span className="rd-item-title">{item.role}</span>
                  {item.org ? <span className="rd-item-org"> — {item.org}</span> : null}
                </div>
                <div className="rd-item-meta">
                  {[item.location, dateRange(item.start, item.end)].filter(Boolean).join(" · ")}
                </div>
              </div>
              <Bullets bullets={item.bullets} />
            </div>
          ))}
        </>
      );

    case "education":
      return (
        <>
          {section.items.map((item) => (
            <div className="rd-item" key={item.id}>
              <div className="rd-item-head">
                <div>
                  <span className="rd-item-title">{item.degree}</span>
                  {item.school ? <span className="rd-item-org"> — {item.school}</span> : null}
                </div>
                <div className="rd-item-meta">
                  {[item.location, dateRange(item.start, item.end)].filter(Boolean).join(" · ")}
                </div>
              </div>
              {item.note ? <div className="rd-edu-note">{item.note}</div> : null}
            </div>
          ))}
        </>
      );

    case "projects":
      return (
        <>
          {section.items.map((item) => (
            <div className="rd-item" key={item.id}>
              <div className="rd-item-head">
                <div>
                  <span className="rd-item-title">{item.name}</span>
                </div>
                {item.link ? (
                  <a className="rd-link-inline" href={item.link}>
                    {shortUrl(item.link)}
                  </a>
                ) : null}
              </div>
              <Bullets bullets={item.bullets} />
              {item.tech.length > 0 ? (
                <div className="rd-tech">{item.tech.join(" · ")}</div>
              ) : null}
            </div>
          ))}
        </>
      );

    case "skills":
      return (
        <>
          {section.items.map((item) => (
            <div className="rd-skill-row" key={item.id}>
              {item.category ? <span className="rd-skill-label">{item.category}: </span> : null}
              <span>{item.entries.join(", ")}</span>
            </div>
          ))}
        </>
      );

    case "certifications":
      return (
        <>
          {section.items.map((item) => (
            <div className="rd-skill-row" key={item.id}>
              <span className="rd-skill-label">{item.name}</span>
              {item.issuer ? <span> — {item.issuer}</span> : null}
              {item.date ? <span className="rd-item-meta"> · {item.date}</span> : null}
            </div>
          ))}
        </>
      );

    case "custom":
      return (
        <>
          {section.items.map((item) => (
            <div className="rd-item" key={item.id}>
              {item.heading ? <div className="rd-item-title">{item.heading}</div> : null}
              {item.detail ? <div>{item.detail}</div> : null}
              <Bullets bullets={item.bullets} />
            </div>
          ))}
        </>
      );
  }
}

function hasContent(section: Section): boolean {
  if (section.kind === "summary") return section.text.trim().length > 0;
  return section.items.length > 0;
}

export interface ResumeDocumentProps {
  resume: Resume;
  composition: Composition;
  scale?: number;
  /** Omit the page frame when the caller supplies its own (the PDF path does). */
  style?: CSSProperties;
}

export function ResumeDocument({
  resume,
  composition,
  scale = 1,
  style,
}: ResumeDocumentProps): ReactElement {
  const tokens = buildTokens(composition, scale) as unknown as CSSProperties;
  return (
    <div
      className={`rd-root rd-l-${composition.layout}`}
      style={{ ...tokens, ...style }}
      data-composition={`${composition.layout}-${composition.type}-${composition.density}-${composition.accent}`}
    >
      <ResumeBody resume={resume} layout={composition.layout} />
    </div>
  );
}

/** The page contents without the token wrapper, so the PDF path can supply its own. */
export function ResumeBody({
  resume,
  layout,
}: {
  resume: Resume;
  layout: LayoutId;
}): ReactElement {
  return (
    <div className="rd-page">
      <Header resume={resume} layout={layout} />
      {resume.sections
        .filter((s) => s.visible && hasContent(s))
        .map((section) => (
          <section className="rd-section" key={section.id}>
            <h2 className="rd-h2">{section.title}</h2>
            <SectionBody section={section} />
          </section>
        ))}
    </div>
  );
}

export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}
