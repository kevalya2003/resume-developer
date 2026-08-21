import { describe, expect, it } from "vitest";
import { cloneSample } from "@/lib/sample-resume";
import { resumeSchema } from "@/lib/schema";
import { fromImportFile, toExportFile } from "@/lib/storage";
import { defaultComposition } from "@/lib/templates/tokens";

describe("export and import", () => {
  it("round-trips a document without losing anything", () => {
    const resume = cloneSample();
    const json = toExportFile(resume, defaultComposition);
    const result = fromImportFile(json);

    expect(result.ok).toBe(true);
    expect(result.resume).toEqual(resume);
    expect(result.composition).toEqual(defaultComposition);
  });

  it("accepts a bare resume document with no wrapper", () => {
    const resume = cloneSample();
    const result = fromImportFile(JSON.stringify(resume));

    expect(result.ok).toBe(true);
    expect(result.resume?.basics.name).toBe(resume.basics.name);
    // Falls back to the default look rather than refusing the file.
    expect(result.composition).toEqual(defaultComposition);
  });

  it("rejects text that is not JSON with a readable message", () => {
    const result = fromImportFile("this is not json");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not valid JSON");
  });

  it("rejects JSON that is not a resume and says which field failed", () => {
    const result = fromImportFile(JSON.stringify({ hello: "world" }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Not a recognised resume file");
  });

  it("rejects a resume with an unknown section kind", () => {
    const broken = { ...cloneSample(), sections: [{ id: "x", kind: "nope", title: "X", visible: true }] };
    expect(fromImportFile(JSON.stringify(broken)).ok).toBe(false);
  });

  it("keeps the export file readable by hand", () => {
    const json = toExportFile(cloneSample(), defaultComposition);
    expect(json).toContain("\n  ");
    expect(JSON.parse(json).format).toBe("resume-developer");
  });
});

describe("schema", () => {
  it("accepts the bundled sample", () => {
    expect(resumeSchema.safeParse(cloneSample()).success).toBe(true);
  });

  it("requires a discriminant on every section", () => {
    const resume = cloneSample() as unknown as { sections: unknown[] };
    resume.sections.push({ id: "x", title: "X", visible: true });
    expect(resumeSchema.safeParse(resume).success).toBe(false);
  });
});
