import { Images } from "lucide-react";
import { defineArrayMember, defineField, defineType } from "sanity";

export const imageGallery = defineType({
  name: "imageGallery",
  title: "แกลเลอรีรูปภาพ",
  type: "object",
  icon: Images,
  fields: [
    defineField({
      name: "images",
      title: "รูปภาพ",
      type: "array",
      of: [defineArrayMember({ type: "imageWithAlt" })],
      validation: (Rule) => Rule.required().min(2).max(12),
    }),
  ],
  preview: { select: { media: "images.0", count: "images" }, prepare: ({ media, count }) => ({ title: `แกลเลอรี ${Array.isArray(count) ? count.length : 0} รูป`, media }) },
});
