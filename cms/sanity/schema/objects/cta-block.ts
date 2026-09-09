import { MousePointerClick } from "lucide-react";
import { defineField, defineType } from "sanity";

export const ctaBlock = defineType({
  name: "ctaBlock",
  title: "ปุ่ม CTA",
  type: "object",
  icon: MousePointerClick,
  preview: { select: { title: "label", subtitle: "url" }, prepare: ({ title, subtitle }) => ({ title: title?.trim() || "ปุ่มใหม่", subtitle: subtitle || "กรอกข้อความและลิงก์ของปุ่ม" }) },
  fields: [
    defineField({ name: "label", title: "ข้อความบนปุ่ม", type: "string", validation: (Rule) => Rule.required().max(80) }),
    defineField({
      name: "url",
      title: "ลิงก์",
      type: "string",
      validation: (Rule) => Rule.required().custom((value) => !value || /^(https?:\/\/|\/(?!\/))/.test(value) ? true : "ใช้ลิงก์ https:// หรือ path ที่ขึ้นต้นด้วย / เท่านั้น"),
    }),
    defineField({
      name: "style",
      title: "รูปแบบ",
      type: "string",
      initialValue: "primary",
      options: { layout: "radio", list: [{ title: "ปุ่มหลัก", value: "primary" }, { title: "ปุ่มรอง", value: "secondary" }] },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: "openInNewTab", title: "เปิดในแท็บใหม่", type: "boolean", initialValue: false }),
  ],
});
