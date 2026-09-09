import { Link } from "lucide-react";
import { defineField, defineType } from "sanity";

export const sourceReference = defineType({
  name: "sourceReference",
  title: "แหล่งอ้างอิง",
  type: "object",
  icon: Link,
  preview: { select: { title: "label", publisher: "publisher", url: "url" }, prepare: ({ title, publisher, url }) => ({ title: title?.trim() || url || "แหล่งอ้างอิงใหม่", subtitle: [publisher, url].filter(Boolean).join(" · ") || "กรอกชื่อหรือ URL ของแหล่งอ้างอิง" }) },
  fields: [
    defineField({ name: "label", title: "ชื่อแหล่งอ้างอิง", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "url", title: "URL", type: "url", validation: (Rule) => Rule.uri({ scheme: ["http", "https"] }) }),
    defineField({ name: "publisher", title: "ผู้เผยแพร่ข้อมูล", type: "string" }),
    defineField({ name: "accessedAt", title: "วันที่ตรวจสอบข้อมูล", type: "date" }),
  ],
});
