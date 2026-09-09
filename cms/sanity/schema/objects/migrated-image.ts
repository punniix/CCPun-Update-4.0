import { createElement } from "react";
import MigratedImagePreview, { MigratedImageBlockPreview } from "../../components/MigratedImagePreview";
import { ImageIcon } from "lucide-react";
import { defineField, defineType } from "sanity";

export const migratedImage = defineType({
  name: "migratedImage",
  title: "รูปภาพจากเว็บไซต์เดิม",
  type: "object",
  icon: ImageIcon,
  components: { preview: MigratedImageBlockPreview },
  preview: { select: { alt: "alt", caption: "caption", src: "src" }, prepare: ({ alt, caption, src }) => ({ title: alt?.trim() || caption || "รูปภาพจากเว็บไซต์เดิม", subtitle: src || "ยังไม่มีที่อยู่รูปภาพ", description: caption, media: createElement(MigratedImagePreview, { src, alt }) }) },
  fields: [
    defineField({ name: "src", title: "ที่อยู่รูปภาพเดิม", type: "string", readOnly: true, validation: (Rule) => Rule.required() }),
    defineField({ name: "alt", title: "คำอธิบายภาพ", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "width", title: "ความกว้าง", type: "number", readOnly: true, validation: (Rule) => Rule.required().positive() }),
    defineField({ name: "height", title: "ความสูง", type: "number", readOnly: true, validation: (Rule) => Rule.required().positive() }),
    defineField({ name: "caption", title: "คำบรรยายใต้ภาพ", type: "string" }),
  ],
});
