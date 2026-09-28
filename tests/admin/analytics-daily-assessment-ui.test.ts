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
  assert.match(html, /ข้อเสนอจากโมเดล · ยังไม่ได้ตรวจทาน/); assert.doesNotMatch(html, /qwen3:1\.7b/);
  assert.match(html, /2026-09-27T06:01:00Z/); assert.match(html, /2026-08-28/); assert.match(html, /2026-09-23/); assert.match(html, /analytics-review-v1/);
  assert.match(html, /ต้นทุนต่อคลิกโดยประมาณ<\/dt><dd[^>]*>ไม่มีข้อมูล/); assert.match(html, /คลิก<\/dt><dd[^>]*>0<\/dd>/); assert.match(html, /12\.5/);
  assert.match(html, /เขตเวลา ต้นทางไม่ได้ระบุ/); assert.match(html, /ข้อมูลมีการจำกัดจำนวน/); assert.match(html, /ตรวจคำค้น &lt;script&gt;/);
  assert.match(html, /รหัสชุดข้อมูล: a{64}/); assert.match(html, /รหัสตรวจสอบข้อมูล: b{64}/); assert.match(html, /href="\/operations\/local-ai\/?"/);
  assert.match(html, /ไม่เปลี่ยนตามตัวกรอง/); assert.doesNotMatch(html, /0%|<button|<script>/);
  const v2 = { ...good, output: { ...good.output!, promptVersion: "analytics-review-v2" as const, coverage: [{ action: "seo-review" as const, prepared: 20, sent: 2, dropped: 18 }] } };
  const current = render({ state: "ready", latest: v2, lastGood: null });
  assert.match(current, /ข้อมูลที่โมเดลได้รับ/); assert.match(current, /เตรียม 20/); assert.match(current, /ส่งให้โมเดล 2/); assert.match(current, /ไม่ได้ส่ง 18/);
  assert.equal((render({ state: "ready", latest: good, lastGood: good }).match(/รหัสชุดข้อมูล:/g) ?? []).length, 1);
  assert.match(render({ state: "ready", latest: { ...good, reviewStatus: "approved" }, lastGood: null }), /เจ้าของตรวจทานแล้ว/);
  const rejected = render({ state: "ready", latest: { ...good, reviewStatus: "rejected" }, lastGood: null });
  assert.match(rejected, /เจ้าของไม่รับข้อเสนอนี้/); assert.doesNotMatch(rejected, /ตรวจคำค้น &lt;script&gt;/);
  assert.match(render({ state: "ready", latest: { ...good, status: "queued", reviewStatus: null, output: null }, lastGood: null }), /รอโมเดลประเมิน/);
  assert.match(render({ state: "ready", latest: null, lastGood: null }), /ยังไม่มีรอบประเมินที่บันทึกไว้/);
  assert.match(render({ state: "unavailable", latest: null, lastGood: null }), /ยังอ่านสถานะการประเมินไม่ได้/);
  const unknown = render({ state: "ready", latest: { ...good, output: { ...good.output!, limitations: ["Provider quota exceeded"], findings: [{ ...good.output!.findings[0]!, why: "Unknown provider warning" }] } }, lastGood: null });
  assert.match(unknown, /มีคำอธิบายจากต้นทางที่ยังไม่ได้แปล/);
  assert.match(unknown, /ข้อจำกัดเดิม: Provider quota exceeded/);
  assert.match(unknown, /คำอธิบายเดิม: Unknown provider warning/);
  assert.doesNotMatch(unknown.split("<details")[0], /Provider quota exceeded|Unknown provider warning/);
});
