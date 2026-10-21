import { z } from "zod";

// Editorial preferences are transient input, never article facts or model configuration.
export const EDITORIAL_INSTRUCTION_VERSION = "field-editorial-v1";
export const LINE_TITLE_DEFAULT_INSTRUCTIONS = "เขียนหัวข้อสั้นที่บอกประเด็นหลักและชวนให้อ่าน ใช้ภาษาไทยธรรมชาติ สุขุม ไม่พาดหัวเกินจริง";
export const LINE_DESCRIPTION_DEFAULT_INSTRUCTIONS = "เขียนคำโปรยสั้นหนึ่งประโยค บอกว่าผู้อ่านจะได้รู้อะไรจากบทความ เติมรายละเอียดจากหัวข้อโดยไม่พูดซ้ำ";
export const ARTICLE_OVERVIEW_DEFAULT_INSTRUCTIONS = "อ่านบทความเต็ม แล้วสรุปภาพรวมเป็น 2–3 bullet ตามเนื้อหา ให้รู้ว่าบทความอธิบายเรื่องอะไรและครอบคลุมประเด็นใด ใช้ภาษาไทยธรรมชาติ ไม่เขียนเป็นคำสั่งให้ผู้อ่านทำตาม";

export const editorialInstructionSchema = z.string().trim().min(1).superRefine((value, context) => {
  if (Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(value)).length > 200
    || new TextEncoder().encode(value).byteLength > 600
    || [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, /(?:^|\D)0\d(?:[-\s]?\d){8,9}(?:\D|$)/, /(?:^|\D)\d(?:[-\s]?\d){12}(?:\D|$)/].some(pattern => pattern.test(value))) {
    context.addIssue({ code: "custom", message: "editorial preference exceeds 200 graphemes or 600 UTF-8 bytes" });
  }
});
export const lineEditorialInstructionsSchema = z.object({
  lineTitle: editorialInstructionSchema.optional(),
  lineDescription: editorialInstructionSchema.optional(),
}).strict();
export type LineEditorialInstructions = z.infer<typeof lineEditorialInstructionsSchema>;

export function resolveLineEditorialInstructions(value?: LineEditorialInstructions) {
  const parsed = lineEditorialInstructionsSchema.optional().parse(value);
  return {
    lineTitle: parsed?.lineTitle ?? LINE_TITLE_DEFAULT_INSTRUCTIONS,
    lineDescription: parsed?.lineDescription ?? LINE_DESCRIPTION_DEFAULT_INSTRUCTIONS,
  };
}
export function resolveOverviewEditorialInstructions(value?: string) {
  return editorialInstructionSchema.optional().parse(value) ?? ARTICLE_OVERVIEW_DEFAULT_INSTRUCTIONS;
}
