import { defineArrayMember, defineField, defineType } from "sanity";
import { BLOG_TOPIC_HUBS } from "../../../../lib/content/taxonomy";
import { validateArticleCanonicalAgainstCategoryRegistry } from "../../policy/category-registry-validation";

const semanticTopicOptions = BLOG_TOPIC_HUBS.map(({ slug, title }) => ({ title, value: slug }));

export const seoMetadata = defineType({
  name: "seoMetadata",
  title: "SEO Control Center",
  type: "object",
  fields: [
    defineField({
      name: "title",
      title: "ชื่อสำหรับ Google (SEO Title — ไม่กรอกก็ได้)",
      description: "เว้นว่างเพื่อใช้ชื่อบทความอัตโนมัติ กรอกเฉพาะเมื่อต้องการให้ชื่อบน Google ต่างจากหน้าเว็บ",
      type: "string",
      validation: (Rule) => Rule.max(60).warning("แนะนำไม่เกิน 60 ตัวอักษร"),
    }),
    defineField({
      name: "description",
      title: "คำอธิบายใน Google (Meta Description)",
      type: "text",
      rows: 3,
      validation: (Rule) => Rule.required().max(160).warning("Recommended: 130–160 characters"),
    }),
    defineField({
      name: "focusKeyword",
      title: "คำค้นหลัก",
      description: "คำที่ต้องการให้บทความนี้ตอบโจทย์เป็นหลัก ใช้เป็นข้อมูลเดียวกับคะแนน SEO เดิม",
      type: "string",
    }),
    defineField({
      name: "secondaryKeywords",
      title: "คำค้นรอง",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
    }),
    defineField({
      name: "keywordCluster",
      title: "กลุ่มคำค้น (Keyword Cluster)",
      description: "ชื่อกลุ่มหัวข้อที่บทความนี้เป็นเจ้าของ ไม่ใช่หมวด URL",
      type: "string",
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: "searchIntent",
      title: "เป้าหมายการค้นหา",
      type: "string",
      options: {
        list: [
          { title: "Informational", value: "informational" },
          { title: "Commercial", value: "commercial" },
          { title: "Transactional", value: "transactional" },
          { title: "Navigational", value: "navigational" },
          { title: "Mixed", value: "mixed" },
        ],
      },
    }),
    defineField({
      name: "semanticTopic",
      title: "หัวข้อเชิงความหมาย (Semantic Topic)",
      description: "ใช้จัด Knowledge Graph และ breadcrumb/schema ในอนาคต แยกจากหมวดที่อยู่ใน URL การเปลี่ยนช่องนี้ไม่ใช่การย้าย URL",
      type: "string",
      options: { list: semanticTopicOptions },
    }),
    defineField({
      name: "ogTitle",
      title: "ชื่อเมื่อแชร์ Social (OG Title)",
      description: "เว้นว่างเพื่อใช้ SEO Title หรือชื่อบทความ",
      type: "string",
      validation: (Rule) => Rule.max(95).warning("แนะนำไม่เกิน 95 ตัวอักษร"),
    }),
    defineField({
      name: "ogDescription",
      title: "คำอธิบายเมื่อแชร์ Social (OG Description)",
      description: "เว้นว่างเพื่อใช้ Meta Description",
      type: "text",
      rows: 3,
      validation: (Rule) => Rule.max(200).warning("แนะนำไม่เกิน 200 ตัวอักษร"),
    }),
    defineField({
      name: "ogImage",
      title: "ภาพเมื่อแชร์ Social (OG Image)",
      description: "เว้นว่างเพื่อใช้รูปหน้าปกบทความ",
      type: "imageWithAlt",
    }),
    defineField({
      name: "auditSnapshot",
      title: "Latest SEO audit",
      type: "seoAuditSnapshot",
      readOnly: true,
    }),
    defineField({
      name: "canonical",
      title: "Canonical override (Protected)",
      description: "เว้นว่างเพื่อใช้ canonical จาก route ปัจจุบัน บทความที่เคยเผยแพร่แล้วต้องเปลี่ยนผ่าน SEO Migration Workflow เท่านั้น",
      type: "url",
      readOnly: ({ document }) => Boolean(document?.publishedAt),
      validation: (Rule) => Rule.uri({ scheme: ["http", "https"] }).custom(validateArticleCanonicalAgainstCategoryRegistry),
    }),
    defineField({
      name: "noindex",
      title: "Noindex (Protected)",
      description: "ใช้เฉพาะก่อนเผยแพร่หรือใน workflow ที่อนุมัติแล้ว เพื่อป้องกันหน้าที่เผยแพร่แล้วหลุดจาก Google โดยไม่ตั้งใจ",
      type: "boolean",
      initialValue: false,
      readOnly: ({ document }) => Boolean(document?.publishedAt),
    }),
  ],
});
