import { FileText } from "lucide-react";
import { defineField, defineType } from "sanity";

export const pdfDownload = defineType({
  name: "pdfDownload",
  title: "ไฟล์ PDF",
  type: "object",
  icon: FileText,
  preview: { select: { title: "title", subtitle: "description" }, prepare: ({ title, subtitle }) => ({ title: title?.trim() || "ไฟล์ PDF ใหม่", subtitle: subtitle || "เลือกไฟล์ PDF และตั้งชื่อ" }) },
  fields: [
    defineField({ name: "title", title: "ชื่อไฟล์ที่ผู้อ่านเห็น", type: "string", validation: (Rule) => Rule.required().max(120) }),
    defineField({ name: "description", title: "คำอธิบาย", type: "text", rows: 2 }),
    defineField({ name: "file", title: "เลือกไฟล์ PDF", type: "file", options: { accept: "application/pdf" }, validation: (Rule) => Rule.required() }),
  ],
});
