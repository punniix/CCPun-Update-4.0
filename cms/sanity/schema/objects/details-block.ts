import { ListCollapse } from "lucide-react";
import { defineField, defineType } from "sanity";

export const detailsBlock = defineType({
  name: "detailsBlock",
  title: "เนื้อหาเปิด–ปิด",
  type: "object",
  icon: ListCollapse,
  preview: { select: { title: "summary", subtitle: "text" }, prepare: ({ title, subtitle }) => ({ title: title?.trim() || "หัวข้อเปิด–ปิดใหม่", subtitle: subtitle || "กรอกหัวข้อและเนื้อหา" }) },
  fields: [
    defineField({ name: "summary", title: "หัวข้อ", type: "string", validation: (Rule) => Rule.required().max(160) }),
    defineField({ name: "text", title: "เนื้อหา", type: "text", rows: 5, validation: (Rule) => Rule.required() }),
  ],
});
