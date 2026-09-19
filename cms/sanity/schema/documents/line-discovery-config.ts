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
          name: "slug",
          title: "Article slug",
          type: "string",
          validation: (Rule) => Rule.required().min(1).max(96),
        }),
        defineField({
          name: "enabled",
          title: "แสดงบน LINE",
          type: "boolean",
          initialValue: true,
        }),
      ],
      preview: {
        select: { title: "slug", enabled: "enabled" },
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
  description: "ลำดับบทความสำหรับ Rich Menu v3 แนะนำให้จัดการจาก admin.ccpun.com > Settings > Integrations",
  fields: [
    defineField({ name: "version", title: "Version", type: "number", readOnly: true }),
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
