import { defineField, defineType } from "sanity";

const reviewStatuses = [
  { title: "กำลังตรวจเนื้อหา", value: "content-review" },
  { title: "พร้อมให้คุณอนุมัติ", value: "ready-for-coo" },
  { title: "อนุมัติเนื้อหาแล้ว", value: "approved" },
];

export const reviewMetadata = defineType({
  name: "reviewMetadata",
  title: "ขั้นตรวจเนื้อหา",
  type: "object",
  fields: [
    defineField({
      name: "status",
      title: "สถานะการตรวจเนื้อหา",
      description: "สถานะนี้ใช้กับฉบับที่กำลังแก้เท่านั้น การเลือกอนุมัติยังไม่เปลี่ยนหน้าเว็บ ต้องยืนยันเผยแพร่อีกครั้งหลังตรวจตัวอย่าง",
      type: "string",
      initialValue: "content-review",
      options: { list: reviewStatuses, layout: "dropdown" },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: "contentReviewedAt", title: "ตรวจเนื้อหาเมื่อ", type: "datetime" }),
    defineField({ name: "factCheckedAt", title: "ตรวจข้อเท็จจริงเมื่อ", type: "datetime" }),
    defineField({ name: "complianceReviewedAt", title: "ตรวจข้อกำหนดและกฎหมายเมื่อ", type: "datetime" }),
    defineField({ name: "notes", title: "บันทึกภายใน", type: "text", rows: 4 }),
  ],
});
