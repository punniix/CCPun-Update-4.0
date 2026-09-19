import { CogIcon } from "@sanity/icons/Cog";
import { defineArrayMember, defineField, defineType } from "sanity";

const articleItems = (title: string) => defineField({
  name: "items",
  title,
  type: "array",
  of: [
    defineArrayMember({
      type: "object",
      name: "lineDiscoveryArticle",
      fields: [
        defineField({
          name: "article",
          title: "บทความ",
          type: "reference",
          to: [{ type: "article" }],
          weak: true,
          options: { disableNew: true },
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: "enabled",
          title: "แสดงบน LINE",
          type: "boolean",
          initialValue: true,
        }),
      ],
      preview: {
        select: { title: "article.title", enabled: "enabled" },
        prepare: ({ title, enabled }) => ({
          title: title || "ยังไม่ได้เลือกบทความ",
          subtitle: enabled === false ? "ปิด" : "เปิด",
        }),
      },
    }),
  ],
});

const journeyConfig = (name: string, title: string) => defineField({
  name,
  title,
  type: "object",
  fields: [
    defineField({
      name: "maxCards",
      title: "จำนวนการ์ดสูงสุด",
      type: "number",
      validation: (Rule) => Rule.required().integer().min(1).max(5),
    }),
    articleItems("บทความและลำดับ"),
  ],
});

export const lineDiscoveryConfig = defineType({
  name: "lineDiscoveryConfig",
  title: "LINE Discovery (จัดการจาก Admin)",
  type: "document",
  icon: CogIcon,
  description: "ลำดับบทความสำหรับ Rich Menu v3 แนะนำให้จัดการจาก admin.ccpun.com > Settings > Integrations",
  fields: [
    defineField({ name: "version", title: "Version", type: "number", readOnly: true }),
    defineField({
      name: "desiredRichMenu",
      title: "Rich Menu ที่ต้องการ",
      type: "string",
      options: {
        list: [
          { title: "Rich Menu v3 · 4 ช่อง", value: "v3" },
          { title: "ไม่ให้ระบบเปลี่ยนเมนู", value: "hold" },
        ],
        layout: "radio",
      },
      initialValue: "hold",
    }),
    journeyConfig("lifeHealth", "ประกันชีวิต"),
    journeyConfig("motor", "ประกันรถ"),
    journeyConfig("investment", "เรื่องลงทุน"),
    defineField({ name: "updatedAt", title: "อัปเดตล่าสุด", type: "datetime", readOnly: true }),
    defineField({ name: "updatedBy", title: "ผู้แก้ไข", type: "string", readOnly: true }),
  ],
  preview: {
    prepare: () => ({
      title: "LINE Discovery",
      subtitle: "ใช้ Admin เพื่อจัดลำดับ Article Cards",
    }),
  },
});
