import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("SEO Control Center keeps semantic topic separate from protected published URL fields", () => {
  const schema = [
    readFileSync("cms/sanity/schema/documents/article.ts", "utf8"),
    readFileSync("cms/sanity/schema/objects/seo-metadata.ts", "utf8"),
  ].join("\n");
  const input = readFileSync("cms/sanity/components/SeoScoreInput.tsx", "utf8");
  const adminPage = readFileSync("app/(control-plane)/seo/page.tsx", "utf8");
  const detailPage = readFileSync("app/(control-plane)/seo/audits/[id]/page.tsx", "utf8");
  const contract = readFileSync("docs/seo-control-center-v1.md", "utf8");

  assert.match(schema, /BLOG_TOPIC_HUBS/);
  assert.match(schema, /name: "semanticTopic"/);
  assert.match(schema, /การเปลี่ยนช่องนี้ไม่ใช่การย้าย URL/);

  assert.match(schema, /title: "URL Slug \(Protected หลังเผยแพร่\)"/);
  assert.match(schema, /title: "หมวดหมู่หลัก \(Protected หลังเผยแพร่\)"/);
  assert.match(schema, /title: "Canonical override \(Protected\)"/);
  assert.match(schema, /title: "Noindex \(Protected\)"/);

  const publishedLocks = schema.match(/readOnly: \(\{ document \}\) => Boolean\(document\?\.publishedAt\)/g) ?? [];
  assert.ok(publishedLocks.length >= 4, "slug, category, canonical and noindex must be protected after publication");

  assert.match(input, /SEO Control Center/);
  assert.match(input, /ผลตรวจ SEO ล่าสุดที่บันทึก/);
  assert.match(input, /ไม่คำนวณผลตรวจซ้ำใน Studio/);
  assert.match(input, /Semantic Topic แยกจาก URL จริง/);
  assert.doesNotMatch(input, /Google Preview|สถานะ SEO ที่ควรตรวจ|useFormValue|const checks/);

  assert.match(adminPage, /SEO Control Center/);
  assert.match(adminPage, /แก้ผ่าน Draft ได้ตามปกติ/);
  assert.match(adminPage, /Protected หลังบทความเคยเผยแพร่/);
  assert.match(detailPage, /คะแนนคำนวณสดจากฉบับปัจจุบัน/);
  assert.match(detailPage, /ความพร้อมก่อนทำงานจริง/);

  assert.match(contract, /Redirect ownership remains in code\/URL migration contracts/);
  assert.match(contract, /Control Plane เป็นแหล่งเดียวสำหรับการคำนวณ audit และ readiness/);
  assert.match(contract, /AIA Health CI Hero remains semantically Health insurance/);
});
