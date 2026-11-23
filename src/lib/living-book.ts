import { z } from "zod";

export const bookColors = ["paper", "ink", "muted", "blue", "green", "gold", "clay", "plum"] as const;
const coordinate = z.number().min(0).max(600);
export const bookShapeSchema = z.object({
  kind: z.enum(["path", "circle", "rect", "ellipse", "line"]),
  path: z.string().max(4000).regex(/^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]*$/),
  x: coordinate, y: coordinate, width: coordinate, height: coordinate,
  radius: coordinate, color: z.enum(bookColors),
});
export const livingBookSchema = z.object({
  caption: z.string().min(1).max(500),
  layers: z.array(z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(40),
    label: z.string().min(1).max(100), description: z.string().min(1).max(700),
    shapes: z.array(bookShapeSchema).min(1).max(18),
  })).min(2).max(8),
  steps: z.array(z.object({ title: z.string().min(1).max(120), description: z.string().min(1).max(700), visibleIds: z.array(z.string()).min(1).max(8) })).min(2).max(6),
  cards: z.array(z.object({ front: z.string().min(1).max(180), back: z.string().min(1).max(500) })).min(1).max(4),
  blanks: z.array(z.object({ sentence: z.string().min(1).max(400), options: z.array(z.string().min(1)).min(2).max(5), answer: z.string().min(1), explanation: z.string().min(1).max(500) })).min(1).max(3),
}).superRefine((book, ctx) => {
  const ids = new Set(book.layers.map(layer => layer.id));
  if (ids.size !== book.layers.length) ctx.addIssue({ code: "custom", message: "Duplicate scene identifiers" });
  for (const step of book.steps) if (step.visibleIds.some(id => !ids.has(id))) ctx.addIssue({ code: "custom", message: "Scene step refers to an unknown illustration" });
  for (const blank of book.blanks) if (!blank.sentence.includes("___") || !blank.options.includes(blank.answer)) ctx.addIssue({ code: "custom", message: "Incomplete word-bank exercise" });
});
export type LivingBook = z.infer<typeof livingBookSchema>;
export type BookShape = z.infer<typeof bookShapeSchema>;

const string = { type: "string" };
const number = { type: "number" };
const array = (items: Record<string, unknown>) => ({ type: "array", items });
const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
export const livingBookJsonSchema = object({
  caption: string,
  layers: array(object({ id: string, label: string, description: string, shapes: array(object({ kind: { type: "string", enum: ["path", "circle", "rect", "ellipse", "line"] }, path: string, x: number, y: number, width: number, height: number, radius: number, color: { type: "string", enum: [...bookColors] } })) })),
  steps: array(object({ title: string, description: string, visibleIds: array(string) })),
  cards: array(object({ front: string, back: string })),
  blanks: array(object({ sentence: string, options: array(string), answer: string, explanation: string })),
});