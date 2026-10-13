import { defineField, defineType } from "sanity";
import { getPageSeoPage, PAGE_SEO_PAGES, isPageSeoImageUrlAllowed, PAGE_SEO_FIELDS, validatePageSeoFields } from "../../../../lib/content/page-seo-registry";

export const pageSeo = defineType({
  name: "pageSeo", title: "SEO หน้าเว็บ", type: "document",
  fields: [
    defineField({ name: "pathname", title: "หน้าเว็บ", type: "string", readOnly: true, options: { list: PAGE_SEO_PAGES.map(page => ({ title: page.label, value: page.pathname })) }, validation: Rule => Rule.required().custom(value => getPageSeoPage(String(value ?? "")) ? true : "ต้องเป็นหน้าเว็บที่ระบบรองรับ") }),
    defineField({ name: "seoTitle", title: "ชื่อสำหรับผลค้นหา", type: "string", description: "เว้นว่างเพื่อใช้ค่าเริ่มต้นจากหน้าเว็บ", validation: Rule => Rule.max(120) }),
    defineField({ name: "seoDescription", title: "คำอธิบายสำหรับผลค้นหา", type: "text", rows: 3, description: "ข้อความบรรทัดเดียว เว้นว่างเพื่อใช้ค่าเริ่มต้น", validation: Rule => Rule.max(320) }),
    defineField({ name: "ogTitle", title: "ชื่อเมื่อแชร์", type: "string", validation: Rule => Rule.max(120) }),
    defineField({ name: "ogDescription", title: "คำอธิบายเมื่อแชร์", type: "text", rows: 3, validation: Rule => Rule.max(320) }),
    defineField({ name: "ogImageUrl", title: "URL ภาพเมื่อแชร์", type: "url", validation: Rule => Rule.uri({ scheme: ["https"] }).custom(value => !value || isPageSeoImageUrlAllowed(value) ? true : "ใช้ภาพสาธารณะของ CCPun หรือ Sanity UAT เท่านั้น") }),
  ],
  validation: Rule => Rule.custom(value => {
    const page = getPageSeoPage(String(value?.pathname ?? ""));
    if (!page || String(value?._id ?? "").replace(/^drafts\./, "") !== page.documentId) return "เอกสารต้องตรงกับหน้าเว็บที่ระบบกำหนด";
    try { validatePageSeoFields(Object.fromEntries(PAGE_SEO_FIELDS.flatMap(key => value?.[key] === undefined ? [] : [[key, value[key]]]))); return true; }
    catch { return "ข้อความหรือ URL ภาพไม่ถูกต้อง"; }
  }),
  preview: { select: { pathname: "pathname" }, prepare: ({ pathname }) => ({ title: getPageSeoPage(String(pathname))?.label ?? "SEO หน้าเว็บ", subtitle: pathname }) },
});
