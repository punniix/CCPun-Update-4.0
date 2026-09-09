import { CircleHelp } from "lucide-react";
import { defineField, defineType } from "sanity";

export const faqItem = defineType({
  name: "faqItem",
  title: "คำถามที่พบบ่อย",
  type: "object",
  icon: CircleHelp,
  preview: { select: { title: "question", subtitle: "answer" }, prepare: ({ title, subtitle }) => ({ title: title?.trim() || "คำถามใหม่", subtitle: subtitle || "กรอกคำถามและคำตอบ" }) },
  fields: [
    defineField({ name: "question", title: "คำถาม", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "answer", title: "คำตอบ", type: "text", rows: 4, validation: (Rule) => Rule.required() }),
  ],
});
