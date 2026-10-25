import { CogIcon } from "@sanity/icons/Cog";
import { defineArrayMember, defineField, defineType } from "sanity";

// Owner-approved 2026-10-25 (LINE chat button system, L1-L9). Managed from
// admin.ccpun.com > Settings > ปุ่มแชท LINE; the website re-validates every value with
// lib/line/chat-config.ts and falls back to code defaults. There is deliberately no field for
// the LINE destination, the button design or analytics event names.
const JOURNEYS = [
  { title: "ชีวิต / สุขภาพ", value: "life_health" },
  { title: "ประกันรถ", value: "motor" },
  { title: "ลงทุน", value: "investment" },
  { title: "คุยกับปั้น", value: "human" },
];

function visibleLength(value: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) return [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(value)].length;
  return Array.from(value).length;
}

const maxVisible = (max: number) => (value: unknown) =>
  typeof value !== "string" || visibleLength(value.trim()) <= max ? true : `ยาวเกิน ${max} ตัวอักษร`;

export const lineChatConfig = defineType({
  name: "lineChatConfig",
  title: "ปุ่มแชท LINE (จัดการจาก Admin)",
  type: "document",
  icon: CogIcon,
  description: "หัวข้อ หน้าที่ใช้ และแคมเปญของปุ่มแชท LINE แนะนำให้แก้จาก admin.ccpun.com > Settings > ปุ่มแชท LINE",
  fields: [
    defineField({ name: "version", title: "Version", type: "number", readOnly: true }),
    defineField({ name: "enabled", title: "เปิดแผงหัวข้อ", type: "boolean", initialValue: true, description: "ปิดแล้วเว็บแสดงปุ่ม LINE ธรรมดา" }),
    defineField({
      name: "topics",
      title: "คลังหัวข้อ",
      type: "array",
      of: [defineArrayMember({
        type: "object",
        name: "lineChatTopic",
        fields: [
          defineField({ name: "topicId", title: "รหัสหัวข้อ (แก้ไม่ได้)", type: "string", readOnly: true }),
          defineField({ name: "ref", title: "เลขอ้างอิง", type: "number", readOnly: true }),
          // Visible characters, not UTF-16 units, so Thai vowel and tone marks do not count extra. The
          // full copy rules are enforced again by lib/line/chat-config.ts on every save and read.
          defineField({ name: "label", title: "ชื่อบนปุ่ม (ไม่เกิน 28 ตัวอักษร)", type: "string", validation: (Rule) => Rule.required().custom(maxVisible(28)) }),
          defineField({ name: "prefill", title: "ข้อความตั้งต้น (ไม่เกิน 120 ตัวอักษร)", type: "text", rows: 2, validation: (Rule) => Rule.required().custom(maxVisible(120)) }),
          defineField({ name: "journey", title: "หมวด", type: "string", options: { list: JOURNEYS } }),
          defineField({ name: "enabled", title: "เปิดใช้", type: "boolean", initialValue: true }),
        ],
        preview: { select: { title: "label", subtitle: "topicId" } },
      })],
    }),
    defineField({
      name: "placements",
      title: "หน้าไหนใช้หัวข้ออะไร",
      type: "array",
      of: [defineArrayMember({
        type: "object",
        name: "lineChatPlacement",
        fields: [
          defineField({ name: "pageKey", title: "กลุ่มหน้า", type: "string", readOnly: true }),
          defineField({ name: "topicIds", title: "หัวข้อตามลำดับ", type: "array", of: [defineArrayMember({ type: "string" })], validation: (Rule) => Rule.min(1).max(4) }),
        ],
        preview: { select: { title: "pageKey" } },
      })],
    }),
    defineField({
      name: "campaigns",
      title: "แคมเปญ",
      type: "array",
      of: [defineArrayMember({
        type: "object",
        name: "lineChatCampaign",
        fields: [
          defineField({ name: "code", title: "รหัสแคมเปญ = utm_campaign (แก้ไม่ได้)", type: "string", readOnly: true }),
          defineField({ name: "refCode", title: "อักษรรหัสอ้างอิง", type: "string", readOnly: true }),
          defineField({ name: "title", title: "ชื่อแคมเปญ", type: "string" }),
          defineField({ name: "campaignType", title: "ประเภท", type: "string", options: { list: [{ title: "ชั่วคราว", value: "temporary" }, { title: "ต่อเนื่อง", value: "evergreen" }] } }),
          defineField({ name: "startsAt", title: "เริ่ม", type: "datetime" }),
          defineField({ name: "endsAt", title: "จบ (ชั่วคราว)", type: "datetime" }),
          defineField({ name: "reviewAt", title: "วันทบทวน (ต่อเนื่อง)", type: "datetime" }),
          defineField({ name: "pageGroups", title: "หน้าที่ใช้", type: "array", of: [defineArrayMember({ type: "string" })] }),
          defineField({ name: "pinnedTopicIds", title: "หัวข้อที่ดันขึ้นบน", type: "array", of: [defineArrayMember({ type: "string" })] }),
          defineField({ name: "headline", title: "หัวแผงแชท", type: "string" }),
          defineField({ name: "paused", title: "พักแคมเปญ", type: "boolean", initialValue: false }),
        ],
        preview: { select: { title: "title", subtitle: "code" } },
      })],
    }),
    defineField({ name: "updatedAt", title: "อัปเดตล่าสุด", type: "datetime", readOnly: true }),
    defineField({ name: "updatedBy", title: "ผู้แก้ไข (รหัสย่อ)", type: "string", readOnly: true }),
  ],
  preview: {
    prepare: () => ({ title: "ปุ่มแชท LINE", subtitle: "ใช้ Admin เพื่อแก้หัวข้อและแคมเปญ" }),
  },
});
