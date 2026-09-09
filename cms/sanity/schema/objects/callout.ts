import { MessageSquare } from "lucide-react";
import { defineField, defineType } from "sanity";

export const callout = defineType({
  name: "callout",
  title: "กล่องข้อความเน้น",
  type: "object",
  icon: MessageSquare,
  preview: { select: { title: "title", text: "text" }, prepare: ({ title, text }) => ({ title: title?.trim() || "กล่องข้อความใหม่", subtitle: text || "กรอกข้อความที่ต้องการเน้น" }) },
  fields: [
    defineField({ name: "title", title: "หัวข้อกล่องข้อความ", type: "string" }),
    defineField({ name: "text", title: "ข้อความ", type: "text", rows: 4, validation: (Rule) => Rule.required() }),
  ],
});
