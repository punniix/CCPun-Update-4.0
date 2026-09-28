import { defineArrayMember, defineField, defineType } from "sanity";

export const author = defineType({
  name: "author",
  title: "Author",
  type: "document",
  fields: [
    defineField({ name: "name", title: "Name", type: "string", validation: (Rule) => Rule.required() }),
    defineField({
      name: "slug",
      title: "URL Slug",
      type: "slug",
      options: { source: "name", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: "bio", title: "Bio", type: "text", rows: 4 }),
    defineField({ name: "profileName", title: "ชื่อที่แสดงบน Card โปรไฟล์", type: "string" }),
    defineField({ name: "profileRole", title: "ตำแหน่งที่แสดงบน Card โปรไฟล์", type: "string" }),
    defineField({ name: "profileBio", title: "คำอธิบายบน Card โปรไฟล์", type: "text", rows: 4 }),
    defineField({ name: "profileAvatar", title: "รูปบน Card โปรไฟล์", type: "imageWithAlt" }),
    defineField({ name: "profileCtaLabel", title: "ข้อความลิงก์โปรไฟล์", type: "string", validation: (Rule) => Rule.max(80) }),
    defineField({
      name: "profileCtaUrl",
      title: "ลิงก์โปรไฟล์",
      type: "string",
      description: "ใช้ URL เต็ม, path ภายในเว็บไซต์ หรือ anchor เช่น #about-ccpun",
      validation: (Rule) =>
        Rule.custom((value) =>
          !value || /^(https?:\/\/|\/(?!\/)|#)/.test(value)
            ? true
            : "กรอก URL, path ภายในเว็บไซต์ หรือ anchor ที่ขึ้นต้นด้วย #",
        ),
    }),
    defineField({
      name: "credentials",
      title: "Credentials (เดิม)",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      readOnly: true,
      hidden: ({ value }) => value === undefined,
      deprecated: { reason: "ใช้คุณวุฒิวิชาชีพด้านล่างแทน โดยเก็บ field เดิมไว้เพื่อรองรับข้อมูลเก่า" },
    }),
    defineField({
      name: "professionalQualifications",
      title: "คุณวุฒิวิชาชีพ",
      type: "array",
      description: "ข้อมูลคุณวุฒิวิชาชีพแบบมีโครงสร้าง เช่น AFPT™ หรือ CFP® โดยไม่เปลี่ยน field Credentials เดิม",
      validation: (Rule) => Rule.max(10),
      of: [
        defineArrayMember({
          name: "professionalQualification",
          title: "คุณวุฒิวิชาชีพ",
          type: "object",
          fields: [
            defineField({ name: "shortName", title: "ชื่อย่อที่ใช้แสดง", type: "string", validation: (Rule) => Rule.required().max(40) }),
            defineField({ name: "name", title: "ชื่อคุณวุฒิ", type: "string", validation: (Rule) => Rule.required().max(160) }),
            defineField({ name: "identifier", title: "เลขคุณวุฒิ / รหัส", type: "string", validation: (Rule) => Rule.max(80) }),
            defineField({ name: "issuer", title: "หน่วยงานผู้ออกคุณวุฒิ", type: "string", validation: (Rule) => Rule.required().max(160) }),
            defineField({ name: "issuerUrl", title: "เว็บไซต์หน่วยงาน", type: "url", validation: (Rule) => Rule.uri({ scheme: ["http", "https"] }) }),
          ],
          preview: { select: { title: "shortName", subtitle: "identifier" } },
        }),
      ],
    }),
    defineField({
      name: "sameAs",
      title: "Profile URLs",
      type: "array",
      of: [defineArrayMember({ type: "url", validation: (Rule) => Rule.uri({ scheme: ["http", "https"] }) })],
    }),
  ],
  preview: { select: { title: "profileName", subtitle: "profileRole", media: "profileAvatar" } },
});
