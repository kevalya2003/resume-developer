import { z } from "zod";
import { resumeSchema } from "./schema";
import { ACCENTS, DENSITIES, LAYOUTS, TYPE_PAIRINGS } from "./templates/tokens";

const ids = <T extends readonly { id: string }[]>(list: T) =>
  list.map((entry) => entry.id) as [string, ...string[]];

export const compositionSchema = z.object({
  layout: z.enum(ids(LAYOUTS)),
  type: z.enum(ids(TYPE_PAIRINGS)),
  density: z.enum(ids(DENSITIES)),
  accent: z.enum(ids(ACCENTS)),
});

export const renderRequestSchema = z.object({
  resume: resumeSchema,
  composition: compositionSchema,
  scale: z.number().min(0.5).max(1.5).default(1),
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;

export function safeFilename(name: string): string {
  const base = name.trim().replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (base || "resume").slice(0, 60);
}
