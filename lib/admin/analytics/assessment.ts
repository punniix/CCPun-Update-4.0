import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { ANALYTICS_REVIEW_VERSION, ANALYTICS_REVIEW_GROUPS, buildAnalyticsInferenceRequest, analyticsReviewInputSchema, analyticsReviewOutputSchema, localAiJobStatusSchema, localAiReviewStatusSchema, type AnalyticsReviewInput, type AnalyticsReviewOutput } from "../../local-ai/contracts";
import { createLocalAiPayloadCrypto, createLocalAiRequestFingerprint } from "../../local-ai/crypto";
import { getLocalAiAdminStatus, resolveLocalAiAdminRuntime, LOCAL_AI_MIGRATION_CHECKSUM } from "../local-ai/foundation";
import { analyticsDate, type AnalyticsDataset } from "./model";
import { buildPerformanceTables } from "./performance";
import { readAnalyticsDashboard } from "./store";

export const ANALYTICS_REVIEW_MIGRATION_VERSION = "20260927_analytics_local_review_v4";
export const ANALYTICS_REVIEW_MIGRATION_CHECKSUM = "sha256:307f9da387d20f4de7865636d2e446afd29a50abda6ed8b78f4a7fecae97d3ef";
const jobSchema = z.object({ jobId: z.string().uuid(), status: localAiJobStatusSchema, reviewStatus: localAiReviewStatusSchema.nullable(), modelName: z.string().nullable(), createdAt: z.string().datetime({ offset: true }), completedAt: z.string().datetime({ offset: true }).nullable(), output: analyticsReviewOutputSchema.nullable() }).strict();
export type AssessmentJob = z.infer<typeof jobSchema>;
export type DailyAssessmentView = { state: "ready" | "unavailable"; latest: AssessmentJob | null; lastGood: AssessmentJob | null };
export const analyticsAssessmentReadSchema = z.object({ latest: jobSchema.nullable(), lastGood: jobSchema.nullable(), dayJob: jobSchema.nullable(), workerReady: z.boolean() }).strict();
const digest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

// Full provenance is stored; only curated facts enter inference, never provider names or personal dimensions.
export function buildDailyAssessmentInput(datasets: AnalyticsDataset[], date = analyticsDate()): AnalyticsReviewInput | null {
  if (!datasets.length) return null;
  const reports = [...datasets].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt)).filter((data, index, all) => all.findIndex(item => item.report === data.report) === index).sort((a, b) => a.report.localeCompare(b.report)).slice(0, 9);
  const evidence = reports.map((data, index) => ({ id: `e${index + 1}`, report: data.report, batchId: data.batchId, rawHash: data.rawHash, windowStart: data.windowStart, windowEnd: data.windowEnd, sourceAsOf: data.sourceAsOf, nativeTimeZone: data.nativeTimeZone, truncated: data.truncated }));
  type Candidate = Omit<AnalyticsReviewInput["candidates"][number], "id">;
  const pools = new Map<string, Candidate[]>(ANALYTICS_REVIEW_GROUPS.map(action => [action, []]));
  const add = (item: Candidate) => pools.get(item.action)!.push(item);
  const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
  const metrics = (row: Record<string, unknown>, names: string[]) => names.map(name => ({ name, value: number(row[name]) }));
  const refs = (report: string, batchId?: string) => evidence.filter(item => item.report === report && (!batchId || item.batchId === batchId)).map(item => item.id);
  add({ action: "measurement-gap", reasonCode: "business-inputs-missing", label: "ความพร้อม · ต้นทุน ลีดที่ผ่านการคัดกรอง และรายได้", why: "ชุดรายงานนี้ไม่มีค่าโฆษณาจริง qualified lead และรายได้ที่ระบุแหล่งที่มา ตรวจรายงาน Ads และ CRM ให้เทียบช่วงเดียวกันก่อนใช้ CPA/ROAS; ไม่ใช่ข้อสรุปว่า integration ขาด", evidenceIds: [], metrics: [] });
  if (reports.some(data => data.report.startsWith("ga4-"))) add({ action: "measurement-gap", reasonCode: "event-definition", label: "ความพร้อม · ยืนยันนิยาม Key event และลีด", why: "ตรวจชื่อ Key event ใน GA4 และจับคู่ผลจริงใน CRM; มีจำนวน event ไม่ได้ยืนยันว่าเป็นคนที่ไม่ซ้ำหรือลีดที่มีคุณภาพ ตรวจนิยามก่อนตัดสินประสิทธิภาพ", evidenceIds: refs("ga4-session-performance"), metrics: [] });
  const dated = reports.map(data => ({ data, age: data.sourceAsOf ? Math.floor((Date.parse(date + "T00:00:00Z") - Date.parse(data.sourceAsOf.slice(0, 10) + "T00:00:00Z")) / 86400000) : null })).filter(item => item.age !== null && Number.isFinite(item.age) && item.age > 3).sort((a, b) => b.age! - a.age!);
  if (dated[0]) add({ action: "measurement-gap", reasonCode: "source-age", label: "ความพร้อม · ตรวจวันที่ข้อมูลก่อนเปรียบเทียบ", why: "มีต้นทางเก่ากว่า 3 วันตามกติกาตรวจความสด อ่าน sourceAsOf และช่วงแต่ละรายงานก่อนเปรียบเทียบ; อายุข้อมูลไม่ยืนยันว่างาน Daily ล้มเหลว", evidenceIds: refs(dated[0].data.report), metrics: [{ name: "อายุข้อมูล (วัน)", value: dated[0].age }] });
  const seo = buildPerformanceTables(reports).find(table => table.view === "seo-review")!;
  for (const [index, row] of seo.rows.entries()) {
    const evidenceIds = evidence.filter(item => (item.report === "gsc-query-page" && item.batchId === row["Batch ID"]) || (item.report === "ubersuggest-web-keywords" && (item.batchId === row["Ubersuggest Batch ID"] || item.batchId === row["Batch ID"]))).map(item => item.id);
    if (!evidenceIds.length) continue;
    const planning = row["การแสดงผล GSC"] === null;
    add({ action: planning ? "keyword-planning" : "seo-review", reasonCode: planning ? "keyword-context" : number(row["อันดับเฉลี่ย GSC"]) !== null && Number(row["อันดับเฉลี่ย GSC"]) > 10 ? "seo-rank-fit" : "seo-click-inspection", label: `SEO · รายการที่ ${index + 1} · ${String(row["งานที่ควรตรวจ"])}`, why: String(row["เหตุผล / กติกา"]), evidenceIds, metrics: metrics(row, planning ? ["Volume Ubersuggest", "Difficulty Ubersuggest (0–100)", "อันดับ Ubersuggest"] : ["การแสดงผล GSC", "คลิก GSC", "อันดับเฉลี่ย GSC", "Volume Ubersuggest"]) });
  }
  for (const data of reports.filter(item => item.report === "ga4-session-performance")) {
    const rows = data.rows.map((row, index) => ({ row, index })).filter(item => number(item.row["เซสชัน"]) !== null).sort((a, b) => Number(b.row["เซสชัน"]) - Number(a.row["เซสชัน"]));
    for (const { row, index } of rows) add({ action: "campaign-review", reasonCode: "campaign-inspection", label: `แคมเปญและหน้าเข้า · แถวต้นทางที่ ${index + 1}`, why: "เปิดแถวนี้ในรายงานแคมเปญ ตรวจ source/medium และหน้าเข้า แล้วตรวจนิยาม Key event; rate เป็นค่าต้นทางของแถวนี้ ไม่ใช่ qualified lead หรือหลักฐานว่าแคมเปญมีกำไร", evidenceIds: refs(data.report), metrics: metrics(row, ["เซสชัน", "Engaged sessions", "Key events", "Session key event rate (%)"]) });
  }
  for (const data of reports.filter(item => item.report === "ga4-marketing-events")) {
    const values = data.rows.map(row => number(row["จำนวน event"])).filter((value): value is number => value !== null);
    if (values.length) add({ action: "activity-review", reasonCode: "activity-definition", label: "กิจกรรม · ตรวจ CI / FHC / LINE กับผลการติดต่อจริง", why: "เปิดรายงานกิจกรรม ตรวจ event ที่บันทึกได้และนิยามการติดต่อกับ CRM; จำนวนนี้เป็นการทำกิจกรรมซ้ำได้ ไม่ใช่คนที่ไม่ซ้ำ funnel drop-off หรือลีด", evidenceIds: refs(data.report), metrics: [{ name: "จำนวน event ในแถวที่เก็บ", value: values.reduce((sum, value) => sum + value, 0) }] });
  }
  for (const data of reports.filter(item => item.report === "social-performance")) {
    const names = ["ยอดดู", "Total interactions", "ปฏิกิริยา / Like", "คลิก"];
    const rows = data.rows.map((row, index) => ({ row, index })).filter(item => names.some(name => number(item.row[name]) !== null)).sort((a, b) => (number(b.row["Total interactions"]) ?? number(b.row["ยอดดู"]) ?? -1) - (number(a.row["Total interactions"]) ?? number(a.row["ยอดดู"]) ?? -1));
    for (const { row, index } of rows) add({ action: "social-review", reasonCode: "social-inspection", label: `Social · แถวต้นทางที่ ${index + 1}`, why: "เปิดโพสต์ในรายงานต้นทาง ตรวจรูปแบบเนื้อหาและการคลิกพร้อมช่วงของ native metric; ตัวเลขเป็นหนึ่ง object อาจเป็นยอดสะสม ไม่ใช้รวม Reach ข้ามโพสต์หรือยืนยันยอดขาย", evidenceIds: refs(data.report), metrics: metrics(row, names) });
  }
  // ponytail: one model, one bounded ranking; round-robin preserves represented families before filling detail.
  const selected: Candidate[] = [];
  for (let index = 0; selected.length < 16; index++) {
    let added = false;
    for (const action of ANALYTICS_REVIEW_GROUPS) { const candidate = pools.get(action)![index]; if (candidate && selected.length < 16) { selected.push(candidate); added = true; } }
    if (!added) break;
  }
  const limitations = ["ประเมินข้อมูลที่เก็บไว้; ช่วงและเขตเวลาอาจต่างกัน ไม่มีช่วงก่อนหน้าที่เทียบกันได้", "ไม่มีค่าโฆษณาจริง qualified lead และรายได้ในรายงานชุดนี้ จึงไม่เสนอ CPA/ROAS หรืองบ", "โมเดลเห็นข้อเสนอที่เลือก ไม่ใช่ raw data ทุกแถว; ชื่อคำค้น แคมเปญ URL และบุคคลไม่ส่งเข้า inference", ...(evidence.some(item => item.truncated) ? ["บางรายงานจำกัดจำนวนแถว; ไม่ถือว่าเป็นข้อมูลทั้งหมด"] : [])];
  const make = () => {
    const candidates = selected.map((item, index) => ({ id: `c${index + 1}`, ...item }));
    const coverage = ANALYTICS_REVIEW_GROUPS.map(action => { const prepared = pools.get(action)!.length, sent = selected.filter(item => item.action === action).length; return { action, prepared, sent, dropped: prepared - sent }; });
    const snapshot = { locale: "th-TH" as const, assessmentDate: date, promptVersion: ANALYTICS_REVIEW_VERSION, evidence, limitations, coverage, candidates };
    return { ...snapshot, snapshotHash: digest(JSON.stringify(snapshot)) };
  };
  let result = make();
  while (Buffer.byteLength(JSON.stringify(result)) > 20000 || buildAnalyticsInferenceRequest(result).promptBytes > 6000) {
    const largest = ANALYTICS_REVIEW_GROUPS.map(action => ({ action, count: selected.filter(item => item.action === action).length })).sort((a, b) => b.count - a.count)[0]!;
    if (largest.count <= 1) throw new Error("ANALYTICS_REVIEW_CONTEXT_EXCEEDED");
    selected.splice(selected.findLastIndex(item => item.action === largest.action), 1);
    result = make();
  }
  return analyticsReviewInputSchema.parse(result);
}

async function sqlClient() {
  const runtime = resolveLocalAiAdminRuntime();
  if (!runtime || !process.env.CCPUN_ADMIN_DATABASE_URL?.trim()) throw new Error("ANALYTICS_REVIEW_NOT_CONFIGURED");
  const sql = neon(process.env.CCPUN_ADMIN_DATABASE_URL.trim(), { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
  const rows = await sql.query(`SELECT current_database() AS db,current_user AS role,
    EXISTS(SELECT 1 FROM ccpun_admin.local_ai_identity WHERE singleton AND lane=$1 AND project_id=$2 AND branch_id=$3 AND endpoint_id=$4 AND database_name='neondb' AND migration_checksum=$5) AS identity,
    EXISTS(SELECT 1 FROM ccpun_admin.schema_migration WHERE version=$6 AND checksum=$7) AS ledger`, [runtime.lane,runtime.localAiIdentity.projectId,runtime.localAiIdentity.branchId,runtime.localAiIdentity.endpointId,LOCAL_AI_MIGRATION_CHECKSUM,ANALYTICS_REVIEW_MIGRATION_VERSION,ANALYTICS_REVIEW_MIGRATION_CHECKSUM]);
  if (rows[0]?.db !== "neondb" || rows[0]?.role !== runtime.localAiIdentity.runtimeRole || !rows[0]?.identity || !rows[0]?.ledger) throw new Error("ANALYTICS_REVIEW_NOT_CONFIGURED");
  return sql;
}
export async function readDailyAssessment(): Promise<DailyAssessmentView> {
  try { const rows = await (await sqlClient()).query("SELECT ccpun_admin.admin_read_analytics_review_v4() AS data", []); const { latest, lastGood } = analyticsAssessmentReadSchema.parse(rows[0]?.data); return { state: "ready", latest, lastGood }; }
  catch { return { state: "unavailable", latest: null, lastGood: null }; }
}
export async function enqueueDailyAssessment(date = analyticsDate()) {
  if (date !== analyticsDate()) throw new Error("ANALYTICS_REVIEW_DATE_INVALID");
  const sql = await sqlClient();
  const current = analyticsAssessmentReadSchema.parse((await sql.query("SELECT ccpun_admin.admin_read_analytics_review_v4() AS data", []))[0]?.data);
  if (current.dayJob) return { state: current.dayJob.status, jobId: current.dayJob.jobId, reused: true };
  if (!current.workerReady || !getLocalAiAdminStatus().readyToEnqueue) throw new Error("ANALYTICS_REVIEW_WORKER_NOT_READY");
  const dashboard = await readAnalyticsDashboard();
  if (dashboard.state !== "ready") throw new Error("ANALYTICS_REVIEW_DATA_UNAVAILABLE");
  const payload = buildDailyAssessmentInput(dashboard.datasets, date);
  if (!payload) return { state: "skipped" as const, reason: "no-stored-reports" as const, reused: false };
  const jobId = randomUUID(), encrypted = createLocalAiPayloadCrypto().encrypt(jobId, "analytics-review", payload);
  const rows = await sql.query("SELECT * FROM ccpun_admin.admin_enqueue_analytics_review_v4($1::date,$2::uuid,$3,$4,$5,$6::smallint,$7,$8)", [date,jobId,encrypted.ciphertextB64,encrypted.nonceB64,encrypted.authTagB64,encrypted.keyVersion,createLocalAiRequestFingerprint("analytics-review",payload),digest(`${jobId}:analytics-daily-service`)]);
  const result = z.object({ job_id: z.string().uuid().nullable(), status: localAiJobStatusSchema.nullable(), reused: z.boolean(), outcome: z.enum(["inserted", "reused", "backpressure"]) }).parse(rows[0]);
  if (result.outcome === "backpressure") throw new Error("LOCAL_AI_BACKPRESSURE");
  if (!result.job_id || !result.status) throw new Error("ANALYTICS_REVIEW_ENQUEUE_FAILED");
  return { state: result.status, jobId: result.job_id, reused: result.reused, coverage: { reports: payload.evidence.length, candidates: payload.candidates.length } };
}
export type { AnalyticsReviewOutput };
