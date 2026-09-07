import { defineArrayMember, defineField, defineType } from "sanity";
import { ACTIVE_ARTICLE_CATEGORIES, isReservedArticleSlug } from "../../../../lib/content/taxonomy";
import SeoScoreInput from "../../components/SeoScoreInput";

const activeArticleCategorySlugs = ACTIVE_ARTICLE_CATEGORIES.map(({ slug }) => slug);

export const article = defineType({
  name: "article",
  title: "Article",
  type: "document",
  groups: [
    { name: "content", title: "เขียนบทความ", default: true },
    { name: "seoGeo", title: "SEO / การค้นหา" },
    { name: "review", title: "ตรวจสอบ / แหล่งอ้างอิง" },
    { name: "publication", title: "ตัวอย่าง / สถานะเผยแพร่" },
  ],
  fields: [
    defineField({ name: "title", title: "ชื่อบทความ", type: "string", group: "content", validation: (Rule) => Rule.required() }),
    defineField({
      name: "slug",
      title: "URL Slug (Protected หลังเผยแพร่)",
      type: "slug",
      group: "content",
      description: "กด Generate ก่อนเผยแพร่ เมื่อบทความมีวันเผยแพร่แล้ว URL Slug จะถูกล็อกและต้องใช้ SEO Migration Workflow หากต้องการย้าย URL",
      options: { source: "title", maxLength: 96 },
      readOnly: ({ document }) => Boolean(document?.publishedAt),
      validation: (Rule) =>
        Rule.required().custom((value) =>
          isReservedArticleSlug((value as { current?: string } | undefined)?.current)
            ? "URL นี้สงวนไว้สำหรับส่งต่อหมวดหมู่เดิม กรุณาใช้ slug อื่น"
            : true,
        ),
    }),
    defineField({
      name: "excerpt",
      title: "คำอธิบายสั้น / คำโปรยบทความ",
      type: "text",
      rows: 3,
      group: "content",
      description: "ใช้ใน Blog card / search preview เท่านั้น ไม่แสดงเป็นย่อหน้าเปิดในหน้า Article",
      validation: (Rule) => Rule.required().max(240),
    }),
    defineField({
      name: "category",
      title: "หมวดหมู่หลัก (Protected หลังเผยแพร่)",
      description: "หมวดหมู่นี้กำหนด path ของ URL จึงถูกล็อกหลังบทความมีวันเผยแพร่ ใช้ Semantic Topic สำหรับจัดความหมายโดยไม่ย้าย URL",
      type: "reference",
      to: [{ type: "category" }],
      group: "content",
      readOnly: ({ document }) => Boolean(document?.publishedAt),
      options: {
        disableNew: true,
        filter: "slug.current in $activeSlugs",
        filterParams: { activeSlugs: activeArticleCategorySlugs },
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "tags",
      title: "แท็กหัวข้อย่อย",
      description: "ใช้บอกหัวข้อเฉพาะที่บทความกล่าวถึง เช่น ประกันสุขภาพ หรือ ประกันโรคร้ายแรง และใส่ได้มากกว่า 1 แท็ก",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      group: "content",
      options: { layout: "tags" },
    }),
    defineField({ name: "author", title: "ผู้เขียน", type: "reference", to: [{ type: "author" }], group: "content", validation: (Rule) => Rule.required() }),
    defineField({ name: "featuredImage", title: "รูปหน้าปกบทความ (แนะนำ 1200×630 px)", type: "imageWithAlt", group: "content", description: "กรอบหน้า Article ใช้สัดส่วน 1200:630 (~1.91:1) ซึ่งตรงกับ Featured/OG image ปัจจุบัน; เลือกจุดสำคัญของภาพด้วย hotspot ได้" }),
    defineField({ name: "migratedFeaturedImage", title: "Migrated featured image", type: "migratedImage", readOnly: true, hidden: true }),
    defineField({ name: "body", title: "เนื้อหาบทความ", type: "portableText", group: "content", validation: (Rule) => Rule.required().min(1) }),
    defineField({ name: "faq", title: "FAQ ที่แสดงในบทความ", type: "array", of: [defineArrayMember({ type: "faqItem" })], group: "content" }),
    defineField({ name: "sources", title: "แหล่งอ้างอิง", type: "array", of: [defineArrayMember({ type: "sourceReference" })], group: "review" }),
    defineField({ name: "review", title: "ขั้นตรวจเนื้อหา", type: "reviewMetadata", group: "publication", validation: (Rule) => Rule.required() }),
    defineField({ name: "seo", title: "SEO Control Center", type: "seoMetadata", group: "seoGeo", components: { input: SeoScoreInput }, validation: (Rule) => Rule.required() }),
    defineField({ name: "geo", title: "GEO / AI Search", type: "geoMetadata", group: "seoGeo" }),
    defineField({ name: "migration", title: "Migration source", type: "migrationSource", readOnly: true, hidden: true }),
    defineField({
      name: "contentUpdatedAt",
      title: "วันที่แก้เนื้อหาล่าสุด",
      description: "ระบบอัปเดตอัตโนมัติเมื่อเผยแพร่การแก้ไข เพื่อให้หน้าเว็บ Article Schema และ sitemap.xml ใช้วันเดียวกัน",
      type: "datetime",
      group: "publication",
      readOnly: true,
    }),
    defineField({
      name: "publishedAt",
      title: "วันเวลาเผยแพร่",
      type: "datetime",
      group: "publication",
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const id = String(context.document?._id ?? "");
          return id.startsWith("drafts.") || value ? true : "Published documents require a published date";
      }),
    }),
  ],
  validation: (Rule) =>
    Rule.custom((document) => {
      const id = String(document?._id ?? "");
      const review = document?.review as { status?: string } | undefined;
      return id.startsWith("drafts.") || review?.status === "approved"
        ? true
        : "Published documents require review status Approved";
    }),
  orderings: [{ title: "Updated, newest", name: "updatedDesc", by: [{ field: "_updatedAt", direction: "desc" }] }],
  preview: {
    select: { title: "title", subtitle: "review.status", media: "featuredImage" },
    prepare: ({ title, subtitle, media }) => ({ title, subtitle: subtitle ? `Review: ${subtitle}` : "Review status missing", media }),
  },
});
