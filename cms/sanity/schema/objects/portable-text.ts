import { defineArrayMember, defineField, defineType } from "sanity";
import { articleFontSizeDecorators } from "../../components/ArticleFontSizeMarks";

export const portableText = defineType({
  name: "portableText",
  title: "เนื้อหาบทความ",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [
        { title: "ย่อหน้าปกติ", value: "normal" },
        { title: "หัวข้อหลัก (H2)", value: "h2" },
        { title: "หัวข้อย่อย (H3)", value: "h3" },
        { title: "หัวข้อย่อยระดับ 4 (H4)", value: "h4" },
        { title: "ข้อความอ้างอิง", value: "blockquote" },
      ],
      lists: [
        { title: "รายการหัวข้อ", value: "bullet" },
        { title: "รายการลำดับเลข", value: "number" },
      ],
      marks: {
        // Listing decorators replaces Sanity's defaults, so the five defaults stay
        // (existing articles already use strong/em/underline). Values are persisted: never rename.
        decorators: [
          { title: "ตัวหนา", value: "strong" },
          { title: "ตัวเอียง", value: "em" },
          { title: "ขีดเส้นใต้", value: "underline" },
          { title: "ขีดฆ่า", value: "strike-through" },
          { title: "โค้ด", value: "code" },
          ...articleFontSizeDecorators,
        ],
        annotations: [
          defineArrayMember({
            name: "link",
            title: "ลิงก์",
            type: "object",
            preview: { select: { title: "href" }, prepare: ({ title }) => ({ title: title || "ลิงก์ใหม่" }) },
            fields: [
              defineField({
                name: "href",
                title: "URL",
                type: "string",
                validation: (Rule) => Rule.required().custom((value) => !value || /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/.test(value) ? true : "ใช้ https://, path ภายใน, #, mailto: หรือ tel: เท่านั้น"),
              }),
              defineField({ name: "openInNewTab", title: "เปิดในแท็บใหม่", type: "boolean", initialValue: false }),
              defineField({ name: "nofollow", title: "ไม่ส่งสัญญาณอันดับ (nofollow)", type: "boolean", initialValue: false }),
              defineField({ name: "sponsored", title: "ลิงก์โฆษณา/ผู้สนับสนุน", type: "boolean", initialValue: false }),
            ],
          }),
        ],
      },
    }),
    defineArrayMember({ type: "callout" }),
    defineArrayMember({ type: "imageWithAlt" }),
    defineArrayMember({ type: "imageGallery" }),
    defineArrayMember({ type: "ctaBlock" }),
    defineArrayMember({ type: "pdfDownload" }),
    defineArrayMember({ type: "detailsBlock" }),
    defineArrayMember({ type: "migratedImage" }),
    defineArrayMember({ type: "simpleTable" }),
    defineArrayMember({ type: "signatureEditorial" }),
    defineArrayMember({ type: "signatureStructuredTable" }),
    defineArrayMember({ type: "signaturePlanExplorer" }),
    defineArrayMember({ type: "divider" }),
  ],
});
