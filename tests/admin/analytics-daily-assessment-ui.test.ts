import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DailyAssessment } from "../../features/admin/analytics/DailyAssessment";
import type { DailyAssessmentView } from "../../lib/admin/analytics/assessment";

test("stored VPS proposal keeps review state, native evidence and missing metrics truthful when a newer run fails", () => {
  const good: NonNullable<DailyAssessmentView["lastGood"]> = {
    jobId: "00000000-0000-4000-8000-000000000001", status: "succeeded", reviewStatus: "pending", modelName: "qwen3:1.7b",
    createdAt: "2026-09-27T06:00:00Z", completedAt: "2026-09-27T06:01:00Z",
    output: { assessmentDate: "2026-09-27", promptVersion: "analytics-review-v1", snapshotHash: "a".repeat(64), reviewRequired: true,
      evidence: [{ id: "e1", report: "ubersuggest-web-keywords", batchId: "00000000-0000-4000-8000-000000000002", rawHash: "b".repeat(64), windowStart: "2026-08-28", windowEnd: "2026-09-27", sourceAsOf: "2026-09-23", nativeTimeZone: null, truncated: true }],
      findings: [{ id: "c1", action: "keyword-planning", label: "ตรวจคำค้น <script>", why: "ยังไม่มีข้อมูลต้นทุนหรือยอดขาย", evidenceIds: ["e1"], metrics: [{ name: "CPC", value: null }, { name: "คลิก", value: 0 }, { name: "อันดับ", value: 12.5 }] }], limitations: ["คำค้นต้นทางอัปเดตรายสัปดาห์"] },
  };
  const render = (assessment: DailyAssessmentView) => renderToStaticMarkup(createElement(DailyAssessment, { assessment }));
  const html = render({ state: "ready", latest: { ...good, jobId: "00000000-0000-4000-8000-000000000003", status: "failed", reviewStatus: null, modelName: null, output: null }, lastGood: good });
  assert.match(html, /รอบนี้ประเมินไม่สำเร็จ/); assert.match(html, /รอบก่อนหน้าที่ประเมินสำเร็จ/);
  assert.match(html, /ข้อเสนอจากโมเดล · ยังไม่ได้ตรวจทาน/); assert.match(html, /qwen3:1\.7b/);
  assert.match(html, /2026-09-27T06:01:00Z/); assert.match(html, /2026-08-28/); assert.match(html, /2026-09-23/); assert.match(html, /analytics-review-v1/);
  assert.match(html, /CPC<\/dt><dd[^>]*>ไม่มีข้อมูล/); assert.match(html, /คลิก<\/dt><dd[^>]*>0<\/dd>/); assert.match(html, /12\.5/);
  assert.match(html, /เขตเวลา ต้นทางไม่ได้ระบุ/); assert.match(html, /ข้อมูลมีการจำกัดจำนวน/); assert.match(html, /ตรวจคำค้น &lt;script&gt;/);
  assert.match(html, /Snapshot: a{64}/); assert.match(html, /Raw hash: b{64}/); assert.match(html, /href="\/operations\/local-ai\/?"/);
  assert.match(html, /ไม่เปลี่ยนตามตัวกรอง/); assert.doesNotMatch(html, /0%|<button|<script>/);
  assert.equal((render({ state: "ready", latest: good, lastGood: good }).match(/Snapshot:/g) ?? []).length, 1);
  assert.match(render({ state: "ready", latest: { ...good, reviewStatus: "approved" }, lastGood: null }), /เจ้าของตรวจทานแล้ว/);
  const rejected = render({ state: "ready", latest: { ...good, reviewStatus: "rejected" }, lastGood: null });
  assert.match(rejected, /เจ้าของไม่รับข้อเสนอนี้/); assert.doesNotMatch(rejected, /ตรวจคำค้น &lt;script&gt;/);
  assert.match(render({ state: "ready", latest: { ...good, status: "queued", reviewStatus: null, output: null }, lastGood: null }), /รอโมเดลประเมิน/);
  assert.match(render({ state: "ready", latest: null, lastGood: null }), /ยังไม่มีรอบประเมินที่บันทึกไว้/);
  assert.match(render({ state: "unavailable", latest: null, lastGood: null }), /ยังอ่านสถานะการประเมินไม่ได้/);
});
