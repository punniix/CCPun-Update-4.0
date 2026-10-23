import { defineArrayMember, defineField, defineType } from "sanity";
import { PUBLIC_COPY_SCOPES, parsePublicCopy, publicCopyInitialEntries, type PublicCopyScope } from "../../../../lib/content/public-copy-registry";

export const publicPageCopy = defineType({
  name: "publicPageCopy",
  title: "ข้อความหน้าเว็บไซต์",
  type: "document",
  fields: [
    defineField({ name: "scope", title: "หน้าเว็บไซต์", type: "string", readOnly: true, options: { list: Object.entries(PUBLIC_COPY_SCOPES).map(([value, scope]) => ({ value, title: scope.label })) }, validation: Rule => Rule.required() }),
    defineField({ name: "locale", title: "ภาษา", type: "string", readOnly: true, initialValue: "th", validation: Rule => Rule.required().custom(value => value === "th" ? true : "รองรับภาษาไทยในขณะนี้") }),
    defineField({
      name: "entries", title: "ข้อความ", type: "array",
      description: "แก้เฉพาะข้อความ ตำแหน่ง รูปแบบ เครื่องคำนวณ และที่อยู่หน้าเว็บคงควบคุมจากระบบ ไม่รองรับ HTML และต้องคงข้อความใน {วงเล็บปีกกา} ที่ระบบใช้เติมค่าผลลัพธ์",
      options: { insertMenu: { views: [{ name: "list" }] }, sortable: false },
      of: [defineArrayMember({ name: "publicCopyEntry", type: "object", fields: [
        defineField({ name: "key", title: "ตำแหน่งข้อความ", type: "string", readOnly: true, validation: Rule => Rule.required() }),
        defineField({ name: "text", title: "ข้อความที่แสดง", type: "text", rows: 3, validation: Rule => Rule.required().max(12000) }),
      ], preview: { select: { title: "text", subtitle: "key" } } })],
      validation: Rule => Rule.required(),
    }),
  ],
  initialValue: ({ scope }: { scope?: PublicCopyScope }) => scope && Object.hasOwn(PUBLIC_COPY_SCOPES, scope)
    ? { scope, locale: "th", entries: publicCopyInitialEntries(scope) }
    : { locale: "th" },
  validation: Rule => Rule.custom(value => {
    if (!value?.scope || !Object.hasOwn(PUBLIC_COPY_SCOPES, String(value.scope))) return "เลือกหน้าเว็บที่ระบบรองรับ";
    try {
      parsePublicCopy(value.scope as PublicCopyScope, { ...value, _id: String(value._id ?? "").replace(/^drafts\./, "") });
      return true;
    } catch { return "เอกสารหรือตำแหน่งข้อความไม่ตรงกับหน้าเว็บ หรือมีข้อความว่าง/HTML"; }
  }),
  preview: { select: { scope: "scope" }, prepare: ({ scope }) => ({ title: PUBLIC_COPY_SCOPES[scope as PublicCopyScope]?.label ?? "ข้อความหน้าเว็บไซต์", subtitle: "แก้เนื้อหาใน Sanity · รูปแบบหน้าเว็บคงเดิม" }) },
});
