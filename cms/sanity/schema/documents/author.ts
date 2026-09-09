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
    defineField({ name: "credentials", title: "Credentials", type: "array", of: [defineArrayMember({ type: "string" })] }),
    defineField({
      name: "sameAs",
      title: "Profile URLs",
      type: "array",
      of: [defineArrayMember({ type: "url", validation: (Rule) => Rule.uri({ scheme: ["http", "https"] }) })],
    }),
  ],
  preview: { select: { title: "profileName", subtitle: "profileRole", media: "profileAvatar" } },
});
