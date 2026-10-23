import { defineArrayMember, defineField, defineType } from "sanity";
import { PUBLIC_COPY_SCOPES, parsePublicCopy, publicCopyInitialEntries, type PublicCopyScope } from "../../../../lib/content/public-copy-registry";
import { COPY_SIZE_LIMITS, COPY_SIZE_PRESETS } from "../../../../lib/content/public-copy-style";
import PublicCopyEntriesInput from "../../components/PublicCopyEntriesInput";

export const publicPageCopy = defineType({
  name: "publicPageCopy",
  title: "ข้อความหน้าเว็บไซต์",
  type: "document",
  fields: [
    defineField({ name: "scope", title: "หน้าเว็บไซต์", type: "string", readOnly: true, options: { list: Object.entries(PUBLIC_COPY_SCOPES).map(([value, scope]) => ({ value, title: scope.label })) }, validation: Rule => Rule.required() }),
    defineField({ name: "locale", title: "ภาษา", type: "string", readOnly: true, initialValue: "th", validation: Rule => Rule.required().custom(value => value === "th" ? true : "รองรับภาษาไทยในขณะนี้") }),
    defineField({
      name: "entries", title: "ข้อความ", type: "array",
      description: "แก้ข้อความและขนาดตัวอักษรได้ ตำแหน่ง เครื่องคำนวณ และที่อยู่หน้าเว็บคงควบคุมจากระบบ ไม่รองรับ HTML และต้องคงข้อความใน {วงเล็บปีกกา} ที่ระบบใช้เติมค่าผลลัพธ์",
      options: { insertMenu: { views: [{ name: "list" }] }, sortable: false },
      of: [defineArrayMember({ name: "publicCopyEntry", type: "object", fields: [
        defineField({ name: "key", title: "ตำแหน่งข้อความ", type: "string", readOnly: true, validation: Rule => Rule.required() }),
        defineField({ name: "text", title: "ข้อความที่แสดง", type: "text", rows: 3, validation: Rule => Rule.required().max(12000) }),
        defineField({ name: "size", title: "ขนาดตัวอักษร", type: "string", options: { list: Object.entries(COPY_SIZE_PRESETS).map(([value, preset]) => ({ value, title: `${preset.title} · ${preset.mobile}/${preset.desktop}px` })) } }),
        defineField({ name: "sizeMobile", title: "ขนาดบนมือถือ (px)", type: "number", validation: Rule => Rule.min(COPY_SIZE_LIMITS.mobile.min).max(COPY_SIZE_LIMITS.mobile.max) }),
        defineField({ name: "sizeDesktop", title: "ขนาดบนจอใหญ่ (px)", type: "number", validation: Rule => Rule.min(COPY_SIZE_LIMITS.desktop.min).max(COPY_SIZE_LIMITS.desktop.max) }),
      ], preview: { select: { title: "text", subtitle: "key" } } })],
      components: { input: PublicCopyEntriesInput },
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
