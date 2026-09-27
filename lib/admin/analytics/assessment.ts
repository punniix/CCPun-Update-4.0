import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { ANALYTICS_REVIEW_VERSION, analyticsReviewInputSchema, analyticsReviewOutputSchema, localAiJobStatusSchema, localAiReviewStatusSchema, type AnalyticsReviewInput, type AnalyticsReviewOutput } from "../../local-ai/contracts";
import { createLocalAiPayloadCrypto, createLocalAiRequestFingerprint } from "../../local-ai/crypto";
import { getLocalAiAdminStatus, resolveLocalAiAdminRuntime, LOCAL_AI_MIGRATION_CHECKSUM } from "../local-ai/foundation";
import { analyticsDate, type AnalyticsDataset } from "./model";
import { buildPerformanceTables } from "./performance";
import { readAnalyticsDashboard } from "./store";

export const ANALYTICS_REVIEW_MIGRATION_VERSION = "20260927_analytics_local_review_v3";
export const ANALYTICS_REVIEW_MIGRATION_CHECKSUM = "sha256:df860b9218c535786bbdc3d6459e18cc76d76e6ea3b35c3d5e1ef64241b5d5ca";
const jobSchema = z.object({ jobId: z.string().uuid(), status: localAiJobStatusSchema, reviewStatus: localAiReviewStatusSchema.nullable(), modelName: z.string().nullable(), createdAt: z.string().datetime({ offset: true }), completedAt: z.string().datetime({ offset: true }).nullable(), output: analyticsReviewOutputSchema.nullable() }).strict();
export type AssessmentJob = z.infer<typeof jobSchema>;
export type DailyAssessmentView = { state: "ready" | "unavailable"; latest: AssessmentJob | null; lastGood: AssessmentJob | null };
export const analyticsAssessmentReadSchema = z.object({ latest: jobSchema.nullable(), lastGood: jobSchema.nullable(), dayJob: jobSchema.nullable(), workerReady: z.boolean() }).strict();
const digest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

// Labels and reasons come from our rules; provider queries, URLs, campaigns and raw rows never enter inference.
export function buildDailyAssessmentInput(datasets: AnalyticsDataset[], date = analyticsDate()): AnalyticsReviewInput | null {
  if (!datasets.length) return null;
  const evidence = datasets.slice(0, 9).map((data, index) => ({ id: `e${index + 1}`, report: data.report, batchId: data.batchId, rawHash: data.rawHash, windowStart: data.windowStart, windowEnd: data.windowEnd, sourceAsOf: data.sourceAsOf, nativeTimeZone: data.nativeTimeZone, truncated: data.truncated }));
  const tables = buildPerformanceTables(datasets);
  const candidates: AnalyticsReviewInput["candidates"] = [];
  const add = (finding: Omit<AnalyticsReviewInput["candidates"][number], "id">) => { if (candidates.length < 16) candidates.push({ id: `c${candidates.length + 1}`, ...finding }); };
  const metrics = (row: Record<string, unknown>, keys: string[]) => keys.map(name => ({ name, value: typeof row[name] === "number" && Number.isFinite(row[name]) ? row[name] as number : null }));
  for (const row of tables.find(table => table.view === "measurement-gaps")!.rows.slice(0, 4)) add({ action: "measurement-gap", label: String(row["ข้อมูล"]), why: String(row["ขั้นตอนต่อไป"]), evidenceIds: [], metrics: [] });
  const seo = tables.find(table => table.view === "seo-review")!;
  for (const [index, row] of seo.rows.slice(0, 8).entries()) {
    const refs = evidence.filter(item => item.batchId === row["Batch ID"] || item.batchId === row["Ubersuggest Batch ID"]).map(item => item.id);
    if (!refs.length) continue;
    add({ action: row["การแสดงผล GSC"] === null ? "keyword-planning" : "seo-review", label: `SEO · รายการที่ ${index + 1} · ${String(row["งานที่ควรตรวจ"])}`, why: String(row["เหตุผล / กติกา"]), evidenceIds: refs, metrics: metrics(row, row["การแสดงผล GSC"] === null ? ["Volume Ubersuggest", "Difficulty Ubersuggest (0–100)", "อันดับ Ubersuggest"] : ["การแสดงผล GSC", "คลิก GSC", "อันดับเฉลี่ย GSC", "Volume Ubersuggest"]) });
  }
  for (const data of datasets.filter(item => item.report === "ga4-marketing-events")) {
    const ref = evidence.find(item => item.batchId === data.batchId && item.report === data.report);
    if (!ref) continue;
    const count = data.rows.reduce((sum, row) => sum + (typeof row["จำนวน event"] === "number" ? row["จำนวน event"] : 0), 0);
    add({ action: "activity-review", label: "ตรวจนิยามกิจกรรม CI / FHC / LINE", why: "จำนวน event เป็นกิจกรรมที่เกิดซ้ำได้; ต้องตรวจ Key event และ CRM ก่อนเรียกว่า lead หรือยอดขาย", evidenceIds: [ref.id], metrics: [{ name: "จำนวน event ในแถวที่เก็บ", value: count }] });
  }
  const limitations = ["ประเมินจากข้อมูลที่เก็บไว้; วันที่และเขตเวลาแต่ละแหล่งต่างกัน", "ไม่มีค่าโฆษณา ลูกค้าที่ผ่านการคัดกรอง และรายได้จริง; ยังคำนวณ CPA/ROAS ไม่ได้", "ชื่อคำค้น แคมเปญ URL และข้อมูลบุคคลไม่ส่งเข้าโมเดล; รายการ SEO อ้างลำดับในตารางงานตรวจ", ...(evidence.some(item => item.truncated) ? ["บางรายงานถูกจำกัดจำนวนแถว; ไม่ถือว่าเป็นข้อมูลทั้งหมด"] : [])];
  const make = () => { const snapshot = { locale: "th-TH" as const, assessmentDate: date, promptVersion: ANALYTICS_REVIEW_VERSION, evidence, limitations, candidates }; return { ...snapshot, snapshotHash: digest(JSON.stringify(snapshot)) }; };
  // ponytail: fixed 4096-token VPS model; drop lower-ranked candidates instead of enlarging its context.
  let result = make();
  if (Buffer.byteLength(JSON.stringify(result)) > 6000) limitations.push("จำกัด candidate เพื่อให้เหมาะกับ context ของโมเดล; ไม่ได้ประเมินทุกแถว");
  while (Buffer.byteLength(JSON.stringify(result = make())) > 6000 && candidates.length > 1) candidates.pop();
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
  try { const rows = await (await sqlClient()).query("SELECT ccpun_admin.admin_read_analytics_review_v3() AS data", []); const { latest, lastGood } = analyticsAssessmentReadSchema.parse(rows[0]?.data); return { state: "ready", latest, lastGood }; }
  catch { return { state: "unavailable", latest: null, lastGood: null }; }
}
export async function enqueueDailyAssessment(date = analyticsDate()) {
  if (date !== analyticsDate()) throw new Error("ANALYTICS_REVIEW_DATE_INVALID");
  const sql = await sqlClient();
  const current = analyticsAssessmentReadSchema.parse((await sql.query("SELECT ccpun_admin.admin_read_analytics_review_v3() AS data", []))[0]?.data);
  if (current.dayJob) return { state: current.dayJob.status, jobId: current.dayJob.jobId, reused: true };
  if (!current.workerReady || !getLocalAiAdminStatus().readyToEnqueue) throw new Error("ANALYTICS_REVIEW_WORKER_NOT_READY");
  const dashboard = await readAnalyticsDashboard();
  if (dashboard.state !== "ready") throw new Error("ANALYTICS_REVIEW_DATA_UNAVAILABLE");
  const payload = buildDailyAssessmentInput(dashboard.datasets, date);
  if (!payload) return { state: "skipped" as const, reason: "no-stored-reports" as const, reused: false };
  const jobId = randomUUID(), encrypted = createLocalAiPayloadCrypto().encrypt(jobId, "analytics-review", payload);
  const rows = await sql.query("SELECT * FROM ccpun_admin.admin_enqueue_analytics_review_v3($1::date,$2::uuid,$3,$4,$5,$6::smallint,$7,$8)", [date,jobId,encrypted.ciphertextB64,encrypted.nonceB64,encrypted.authTagB64,encrypted.keyVersion,createLocalAiRequestFingerprint("analytics-review",payload),digest(`${jobId}:analytics-daily-service`)]);
  const result = z.object({ job_id: z.string().uuid().nullable(), status: localAiJobStatusSchema.nullable(), reused: z.boolean(), outcome: z.enum(["inserted", "reused", "backpressure"]) }).parse(rows[0]);
  if (result.outcome === "backpressure") throw new Error("LOCAL_AI_BACKPRESSURE");
  if (!result.job_id || !result.status) throw new Error("ANALYTICS_REVIEW_ENQUEUE_FAILED");
  return { state: result.status, jobId: result.job_id, reused: result.reused, coverage: { reports: payload.evidence.length, candidates: payload.candidates.length } };
}
export type { AnalyticsReviewOutput };
