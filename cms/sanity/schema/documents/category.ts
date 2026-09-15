import { defineField, defineType } from "sanity";

export const category = defineType({
  name: "category",
  title: "หมวดหมู่บทความ",
  type: "document",
  fields: [
    defineField({ name: "title", title: "ชื่อหมวดหมู่", type: "string", validation: (Rule) => Rule.required() }),
    defineField({
      name: "slug",
      title: "URL Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required().custom((value) => {
        const slug = (value as { current?: string } | undefined)?.current ?? "";
        return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? true : "Slug ต้องใช้ a-z, 0-9 และขีดกลางเท่านั้น";
      }),
    }),
    defineField({
      name: "routingStatus",
      title: "สถานะการใช้งาน",
      type: "string",
      initialValue: "draft",
      options: {
        layout: "radio",
        list: [
          { title: "Draft", value: "draft" },
          { title: "Active", value: "active" },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: "description", title: "Description", type: "text", rows: 3 }),
  ],
  preview: {
    select: { title: "title", slug: "slug.current", status: "routingStatus" },
    prepare: ({ title, slug, status }) => ({ title, subtitle: `${status === "active" ? "Active" : "Draft"} · ${slug ?? "no-slug"}` }),
  },
});
