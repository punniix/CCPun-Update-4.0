import { ImageIcon } from "lucide-react";
import { defineField, defineType } from "sanity";

export const imageWithAlt = defineType({
  name: "imageWithAlt",
  title: "รูปภาพ พร้อม Alt text",
  type: "image",
  icon: ImageIcon,
  options: { hotspot: true },
  preview: { select: { alt: "alt", caption: "caption", media: "asset" }, prepare: ({ alt, caption, media }) => ({ title: alt?.trim() || caption || "รูปภาพใหม่", subtitle: caption || "เพิ่มคำอธิบายภาพสำหรับผู้อ่าน", media }) },
  fields: [
    defineField({ name: "alt", title: "คำอธิบายภาพ", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "caption", title: "คำบรรยายใต้ภาพ", type: "string" }),
    defineField({ name: "credit", title: "เครดิตรูปภาพ", type: "string" }),
  ],
});
