import { defineArrayMember, defineField, defineType } from "sanity";
import { validateCategoryRegistryDocument, validateCategorySlugFormat } from "../../policy/category-registry-validation";

export const category = defineType({
  name: "category",
  title: "Category",
  type: "document",
  fields: [
    defineField({ name: "title", title: "ชื่อบทความ", type: "string", validation: (Rule) => Rule.required() }),
    defineField({
      name: "slug",
      title: "URL Slug",
      type: "slug",
      description: "กำหนด public path /blog/<slug>/ และ canonical ของ Category โดยตรง",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required().custom(validateCategorySlugFormat),
    }),
    defineField({
      name: "status",
      title: "Registry Status",
      type: "string",
      initialValue: "draft",
      options: {
        layout: "radio",
        list: [
          { title: "Draft — Preview ได้ แต่ไม่ Public/Index", value: "draft" },
          { title: "Active — Public และแสดงใน Blog dropdown", value: "active" },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "redirectTo",
      title: "Redirect To (เมื่อ Deactivate)",
      type: "reference",
      to: [{ type: "category" }],
      description: "ใช้เมื่อ Category ที่เคย Active/มีบทความอ้างอิงถูกเปลี่ยนเป็น Draft ต้องชี้ตรงไปยัง Category Active ปลายทาง ห้ามทำ redirect chain",
      options: {
        disableNew: true,
        filter: "status == 'active'",
      },
    }),
    defineField({ name: "description", title: "Description", type: "text", rows: 3 }),
    defineField({
      name: "featuredArticles",
      title: "บทความแนะนำของหมวดหมู่นี้",
      type: "array",
      description: "เลือกเฉพาะบทความในหมวดนี้แล้วลากเพื่อเรียงลำดับ ระบบจะแสดงเฉพาะบทความที่เผยแพร่จริง และเติมบทความล่าสุดในหมวดอัตโนมัติหากเลือกไม่ครบ",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "article" }],
          options: {
            disableNew: true,
            filter: ({ document }) => {
              const categoryId = String(document?._id ?? "").replace(/^drafts\\./, "");
              return {
                filter: "_type == 'article' && category._ref == $categoryId && defined(publishedAt)",
                params: { categoryId },
              };
            },
          },
        }),
      ],
      validation: (Rule) => Rule.max(8).unique(),
    }),
  ],
  validation: (Rule) => Rule.custom(validateCategoryRegistryDocument),
  preview: {
    select: { title: "title", slug: "slug.current", status: "status" },
    prepare: ({ title, slug, status }) => ({
      title,
      subtitle: `${status === "active" ? "Active" : "Draft"} · ${slug || "ยังไม่มี slug"}`,
    }),
  },
});
