import { defineArrayMember, defineField, defineType } from "sanity";

export const blogSettings = defineType({
  name: "blogSettings",
  title: "ตั้งค่าหน้า Blog",
  type: "document",
  fields: [
    defineField({
      name: "featuredArticles",
      title: "บทความแนะนำหน้า Blog",
      type: "array",
      description: "เลือกบทความที่ต้องการดันบน /blog/ แล้วลากเพื่อเรียงลำดับ ระบบจะแสดงเฉพาะบทความที่เผยแพร่จริง และเติมบทความล่าสุดอัตโนมัติหากเลือกไม่ครบ",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "article" }],
          options: {
            disableNew: true,
            filter: "_type == 'article' && defined(publishedAt)",
          },
        }),
      ],
      validation: (Rule) => Rule.max(8).unique(),
    }),
  ],
  preview: {
    prepare: () => ({
      title: "ตั้งค่าหน้า Blog",
      subtitle: "จัดลำดับบทความแนะนำสำหรับ /blog/",
    }),
  },
});
