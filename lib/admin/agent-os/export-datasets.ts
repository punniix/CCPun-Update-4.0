import "server-only";

import { listAdvisorInboxOperational } from "../line/advisor-workflow";
import { listResearchSnapshots } from "../research";
import { aisvReadStateLabel, deriveAisvReadState, matchReviewedIntentOwner } from "../seo-intelligence/aisv";
import { getSocialMarketingDashboard } from "../social/marketing-dashboard";
import { compactText, FORMAT_LABEL, PLATFORM_LABEL, qualityBucket } from "../social/marketing-dashboard-model";
import { getUbersuggestDashboardData } from "../ubersuggest-dashboard";
import { readConversionAnalytics } from "../line/business-intelligence";
import { lineJourneyLabel, lineStageLabel } from "../line/presentation";
import { readOperationsJobs } from "../operations/jobs-read-model";
import { formatBangkokDateTime, OWNER_FRIENDLY_EXPORT_COLUMNS, type ExportDataset } from "./export-contract";

export type OwnerExportDataset = {
  dataset: ExportDataset;
  title: string;
  generatedAt: string;
  timeZone: "Asia/Bangkok";
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  overview: Array<{ label: string; value: string | number }>;
};

function yesNo(value: boolean) {
  return value ? "ใช่" : "ไม่";
}

function caseStateLabel(value: string) {
  if (value === "active") return "กำลังดูแล";
  if (value === "waiting") return "รอ";
  if (value === "completed") return "เสร็จแล้ว";
  return value;
}

function priorityLabel(value: string | null) {
  if (value === "urgent") return "เร่งด่วน";
  if (value === "high") return "สูง";
  if (value === "normal") return "ปกติ";
  if (value === "low") return "ต่ำ";
  return "—";
}

function percentValue(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? null : Math.round(value * 10_000) / 100;
}

function socialQualityLabel(value: ReturnType<typeof qualityBucket>) {
  if (value === "ready") return "พร้อมวิเคราะห์";
  if (value === "needs_review") return "ควรตรวจข้อมูล";
  return "ข้อมูลบางส่วน";
}

function socialAnalysisLabel(value: string) {
  if (value === "ready") return "พร้อมวิเคราะห์";
  if (value === "partial") return "ข้อมูลบางส่วน";
  if (value === "insufficient") return "ข้อมูลไม่พอ";
  return value || "—";
}

function researchProviderLabel(value: string) {
  if (value === "ubersuggest") return "Ubersuggest Research";
  if (value === "gsc") return "Google Search Console";
  if (value === "serp") return "SERP Research";
  if (value === "manual") return "Manual Research";
  return value;
}

function externalDataNote(value: string | null | undefined) {
  return value === "untrusted-external-data" ? "ข้อมูลภายนอกที่ต้องอ่านพร้อมแหล่งที่มา" : "";
}

function latestTimestamp(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

function jobStatusLabel(value: string) {
  const labels: Record<string, string> = {
    queued: "รอคิว",
    running: "กำลังทำงาน",
    processing: "กำลังทำงาน",
    executing: "กำลังทำงาน",
    waiting_external: "รอระบบภายนอก",
    waiting_ai: "รอ AI",
    validating: "กำลังตรวจผล",
    awaiting_review: "รอตรวจ",
    retrying: "กำลังลองใหม่",
    succeeded: "สำเร็จ",
    completed: "สำเร็จ",
    failed: "ไม่สำเร็จ",
    cancelled: "ยกเลิก",
    reconciliation_required: "ต้องตรวจผล",
    "reconciliation-required": "ต้องตรวจผล",
  };
  return labels[value] ?? value;
}

export function buildSocialPerformanceExport(
  model: Awaited<ReturnType<typeof getSocialMarketingDashboard>>,
  generatedAt: string,
): OwnerExportDataset {
  const rows = model.posts.map((row) => ({
      "วันที่เผยแพร่ (เวลาไทย)": row.publishedAtBkk || formatBangkokDateTime(row.publishedAtUtc),
      "แพลตฟอร์ม": PLATFORM_LABEL[row.platform],
      "รูปแบบ": FORMAT_LABEL[row.formatStandard] ?? row.formatStandard,
      "เนื้อหา": compactText(row.text, 280),
      "ลิงก์โพสต์": row.permalink ?? "",
      "ยอดดู": row.views,
      "Reach": row.reach,
      "คลิก": row.clicks,
      "ปฏิกิริยา": row.reactionsTotal,
      "คอมเมนต์": row.commentsTotal,
      "แชร์": row.shares,
      "บันทึก": row.saves,
      "การมีส่วนร่วมที่ยืนยันได้": row.knownEngagementTotal,
      "การมีส่วนร่วมเชิงลึก": row.knownDeepEngagementTotal,
      "อัตราคลิกต่อการดู (%)": percentValue(row.clicksPerView),
      "อัตรามีส่วนร่วมต่อ Reach (%)": percentValue(row.knownEngagementRateByReach),
      "Coverage (%)": percentValue(row.metricCoverageRate),
      "สถานะวิเคราะห์": socialAnalysisLabel(row.analysisStatus),
      "คุณภาพข้อมูล": socialQualityLabel(qualityBucket(row)),
      "Snapshot ล่าสุด (เวลาไทย)": formatBangkokDateTime(row.snapshotAt),
      "Content ID": row.contentId,
      "Publication ID": row.publicationId ?? "",
      "Provider Object ID": row.providerObjectId,
    }));
    const quality = model.posts.map(qualityBucket);
  return {
      dataset: "social-performance",
      title: "Social Performance",
      generatedAt,
      timeZone: "Asia/Bangkok",
      columns: [...OWNER_FRIENDLY_EXPORT_COLUMNS["social-performance"]],
      rows,
      overview: [
        { label: "โพสต์ทั้งหมด", value: model.posts.length },
        { label: "Facebook", value: model.posts.filter((row) => row.platform === "facebook").length },
        { label: "Instagram", value: model.posts.filter((row) => row.platform === "instagram").length },
        { label: "พร้อมวิเคราะห์", value: quality.filter((value) => value === "ready").length },
        { label: "ควรตรวจข้อมูล", value: quality.filter((value) => value === "needs_review").length },
        { label: "ข้อมูลบางส่วน", value: quality.filter((value) => value === "partial").length },
        { label: "Snapshot ล่าสุด", value: formatBangkokDateTime(model.latestSnapshotAt) || "—" },
        { label: "แหล่งข้อมูล", value: model.sourceMode === "clean-mart" ? "Social clean marketing mart" : "ข้อมูลต้นทางสำหรับ UAT" },
      ],
    };
}

export function buildSeoIntelligenceExport(
  research: Awaited<ReturnType<typeof listResearchSnapshots>>,
  dashboard: Awaited<ReturnType<typeof getUbersuggestDashboardData>>,
  generatedAt: string,
): OwnerExportDataset {
    if (research.error && dashboard.error && !dashboard.geo) throw new Error("EXPORT_SEO_DATA_NOT_READY");

    const geo = dashboard.geo;
    const aisvState = deriveAisvReadState({ error: dashboard.error, snapshot: geo });
    const aisvStatus = aisvReadStateLabel(aisvState);
    const aisvLimitations = geo?.limitations ?? [];

    const aisvRows = (geo?.prompts ?? []).map((prompt) => {
      const owner = matchReviewedIntentOwner(prompt.promptText);
      return {
        "ประเภทข้อมูล": "AISV Prompt",
        "คำค้น / Prompt": prompt.promptText,
        "หัวข้อ / Scope": prompt.topic ?? "",
        "แหล่งข้อมูล": "Ubersuggest AISV",
        "ภาษา": prompt.language ?? "",
        "พื้นที่": prompt.locId == null ? "" : String(prompt.locId),
        "Intent": (prompt.intents ?? []).join(" / "),
        "Volume": null,
        "Difficulty": null,
        "SERP": null,
        "คู่แข่ง / แบรนด์เด่น": (prompt.topBrands ?? []).join(", "),
        "AI Answers": prompt.totalAnswers ?? null,
        "AI Mentions": prompt.userTotalMentions ?? null,
        "AI Visibility (%)": prompt.userVisibilityPercentage ?? null,
        "AI Rank": prompt.userAverageRank ?? null,
        "บทความเจ้าของ": owner?.ownerUrl ?? "",
        "สถานะจับคู่": owner ? "จับคู่แล้ว" : "ยังไม่ได้จับคู่ / รอตรวจ",
        "ช่วงข้อมูลเริ่ม": geo?.windowStart ?? "",
        "ช่วงข้อมูลสิ้นสุด": geo?.windowEnd ?? "",
        "ดึงเมื่อ (เวลาไทย)": formatBangkokDateTime(geo?.fetchedAt ?? geo?.checkedAt ?? null),
        "สถานะข้อมูล": aisvStatus,
        "ข้อจำกัด": aisvLimitations.join(" | "),
      };
    });

    const researchRows = research.rows.map((row) => ({
      "ประเภทข้อมูล": "Keyword Research",
      "คำค้น / Prompt": row.keyword,
      "หัวข้อ / Scope": row.scope ?? "",
      "แหล่งข้อมูล": researchProviderLabel(row.provider),
      "ภาษา": row.language ?? "",
      "พื้นที่": row.location ?? "",
      "Intent": row.intent ?? "",
      "Volume": row.volume ?? null,
      "Difficulty": row.difficulty ?? null,
      "SERP": row.serpCount,
      "คู่แข่ง / แบรนด์เด่น": row.competitors.join(", "),
      "AI Answers": null,
      "AI Mentions": null,
      "AI Visibility (%)": null,
      "AI Rank": null,
      "บทความเจ้าของ": "",
      "สถานะจับคู่": "",
      "ช่วงข้อมูลเริ่ม": "",
      "ช่วงข้อมูลสิ้นสุด": "",
      "ดึงเมื่อ (เวลาไทย)": formatBangkokDateTime(row.checkedAt),
      "สถานะข้อมูล": "มีข้อมูลวิจัย",
      "ข้อจำกัด": externalDataNote(row.trustClass),
    }));

    const latestResearchAt = latestTimestamp(research.rows.map((row) => row.checkedAt));
    return {
      dataset: "seo-intelligence",
      title: "SEO Search Intelligence",
      generatedAt,
      timeZone: "Asia/Bangkok",
      columns: [...OWNER_FRIENDLY_EXPORT_COLUMNS["seo-intelligence"]],
      rows: [...aisvRows, ...researchRows],
      overview: [
        { label: "Keyword Research ที่บันทึกไว้", value: research.rows.length },
        { label: "AISV Prompt", value: geo?.prompts.length ?? 0 },
        { label: "สถานะ AISV", value: aisvStatus },
        { label: "AI Visibility", value: geo?.visibilityPercentage == null ? "—" : String(geo.visibilityPercentage) + "%" },
        { label: "AI Mentions", value: geo?.totalMentions ?? "—" },
        { label: "AI Answers", value: geo?.totalAnswers ?? "—" },
        { label: "ช่วงรายงาน AISV", value: geo?.windowStart && geo.windowEnd ? geo.windowStart + " → " + geo.windowEnd : "—" },
        { label: "Research ล่าสุด", value: formatBangkokDateTime(latestResearchAt) || "—" },
        { label: "AISV Runtime", value: geo?.sourceRuntime ?? "ไม่ทราบ" },
        { label: "ขอบเขตไฟล์", value: "Stored Research + Ubersuggest AISV · export ไม่ยิง provider สด" },
      ],
    };
}

export async function buildOwnerExportDataset(
  dataset: ExportDataset,
  generatedAt = new Date().toISOString(),
  variables: Record<string, string | undefined> = process.env,
): Promise<OwnerExportDataset> {
  if (dataset === "social-performance") {
    return buildSocialPerformanceExport(await getSocialMarketingDashboard(variables), generatedAt);
  }

  if (dataset === "seo-intelligence") {
    const [research, dashboard] = await Promise.all([
      listResearchSnapshots(200),
      getUbersuggestDashboardData(100),
    ]);
    return buildSeoIntelligenceExport(research, dashboard, generatedAt);
  }

  if (dataset === "crm-leads" || dataset === "crm-follow-ups" || dataset === "crm-overview") {
    const leads = await listAdvisorInboxOperational({}, variables);

    if (dataset === "crm-overview") {
      const active = leads.filter((row) => row.caseState !== "completed").length;
      const followUps = leads.filter((row) => row.followUpAt).length;
      const overdue = leads.filter((row) => row.followUpAt && Date.parse(row.followUpAt) < Date.parse(generatedAt)).length;
      return {
        dataset,
        title: "ภาพรวม CRM",
        generatedAt,
        timeZone: "Asia/Bangkok",
        columns: ["รายการ", "จำนวน"],
        rows: [
          { "รายการ": "Lead ทั้งหมด", "จำนวน": leads.length },
          { "รายการ": "กำลังดูแล", "จำนวน": active },
          { "รายการ": "มีวันติดตาม", "จำนวน": followUps },
          { "รายการ": "เลยกำหนดติดตาม", "จำนวน": overdue },
          { "รายการ": "ได้รับเอกสารแล้ว", "จำนวน": leads.filter((row) => row.materialReceived).length },
          { "รายการ": "Won", "จำนวน": leads.filter((row) => row.stage === "Won").length },
        ],
        overview: [
          { label: "Lead ทั้งหมด", value: leads.length },
          { label: "กำลังดูแล", value: active },
          { label: "เลยกำหนดติดตาม", value: overdue },
        ],
      };
    }

    if (dataset === "crm-follow-ups") {
      const rows = leads
        .filter((row) => row.followUpAt || row.latestMessageNeedsHuman)
        .sort((a, b) => Date.parse(a.followUpAt ?? "9999-12-31") - Date.parse(b.followUpAt ?? "9999-12-31"))
        .map((row) => ({
          "ลูกค้า": "ลูกค้า " + row.customerCode.slice(-8),
          "เรื่องที่คุย": lineJourneyLabel(row.journey),
          "สถานะ": lineStageLabel(row.stage),
          "ความสำคัญ": priorityLabel(row.priority),
          "กำหนดติดตาม (เวลาไทย)": formatBangkokDateTime(row.followUpAt),
          "เลยกำหนด": row.followUpAt ? yesNo(Date.parse(row.followUpAt) < Date.parse(generatedAt)) : "—",
          "ต้องให้คนดูต่อ": yesNo(Boolean(row.latestMessageNeedsHuman)),
          "คุยล่าสุด (เวลาไทย)": formatBangkokDateTime(row.lastActivityAt),
        }));
      const fallback = {
        "ลูกค้า": "", "เรื่องที่คุย": "", "สถานะ": "", "ความสำคัญ": "",
        "กำหนดติดตาม (เวลาไทย)": "", "เลยกำหนด": "", "ต้องให้คนดูต่อ": "", "คุยล่าสุด (เวลาไทย)": "",
      };
      return {
        dataset,
        title: "งานติดตามลูกค้า",
        generatedAt,
        timeZone: "Asia/Bangkok",
        columns: Object.keys(rows[0] ?? fallback),
        rows,
        overview: [
          { label: "รายการทั้งหมด", value: rows.length },
          { label: "เลยกำหนด", value: rows.filter((row) => row["เลยกำหนด"] === "ใช่").length },
          { label: "ต้องให้คนดูต่อ", value: rows.filter((row) => row["ต้องให้คนดูต่อ"] === "ใช่").length },
        ],
      };
    }

    const rows = leads.map((row) => ({
      "ลูกค้า": "ลูกค้า " + row.customerCode.slice(-8),
      "สถานะ": lineStageLabel(row.stage),
      "เรื่องที่คุย": lineJourneyLabel(row.journey),
      "สถานะการดูแล": caseStateLabel(row.caseState),
      "ความสำคัญ": priorityLabel(row.priority),
      "แหล่งที่มา": row.origin ?? "—",
      "แคมเปญ": row.campaignId ?? "—",
      "บทความ": row.contentId ?? "—",
      "เครื่องมือ": row.toolId ?? "—",
      "ได้รับเอกสารแล้ว": yesNo(row.materialReceived),
      "ข้อความยังไม่อ่าน": row.unreadCount,
      "วันติดตามถัดไป (เวลาไทย)": formatBangkokDateTime(row.followUpAt),
      "คุยล่าสุด (เวลาไทย)": formatBangkokDateTime(row.lastActivityAt),
      "แท็ก": row.tags.join(", "),
    }));
    return {
      dataset,
      title: "รายชื่อลูกค้า CRM",
      generatedAt,
      timeZone: "Asia/Bangkok",
      columns: Object.keys(rows[0] ?? {}),
      rows,
      overview: [
        { label: "Lead ทั้งหมด", value: rows.length },
        { label: "Won", value: leads.filter((row) => row.stage === "Won").length },
        { label: "Qualified", value: leads.filter((row) => row.stage === "Qualified").length },
      ],
    };
  }

  if (dataset === "growth-funnel" || dataset === "customer-insights") {
    const model = await readConversionAnalytics(variables);
    if (model.state !== "ready") throw new Error("EXPORT_ANALYTICS_NOT_READY");

    if (dataset === "growth-funnel") {
      const rows = model.content.map((row) => ({
        "แหล่งที่มา": row.origin,
        "เส้นทางลูกค้า": lineJourneyLabel(row.journey),
        "บทความ": row.contentId ?? "—",
        "แคมเปญ": row.campaignId ?? "—",
        "เครื่องมือ": row.toolId ?? "—",
        "เริ่มต้นเส้นทาง": row.journeyStartCount,
        "Lead": row.leadCount,
        "ได้รับเอกสาร": row.materialReceivedCount,
        "Qualified Conversation": row.qualifiedCount,
        "อัตรา Qualified": row.qualificationRate == null ? "—" : (row.qualificationRate * 100).toFixed(1) + "%",
        "ดำเนินการเสร็จ": row.implementationCompleteCount,
        "Won": row.wonCount,
        "Lost": row.lostCount,
        "รายการรายได้": row.revenueRecordCount,
        "หลุดระหว่างทาง": row.dropOffCount,
      }));
      return {
        dataset,
        title: "Growth Funnel",
        generatedAt,
        timeZone: "Asia/Bangkok",
        columns: Object.keys(rows[0] ?? {}),
        rows,
        overview: [
          { label: "Lead", value: model.summary?.lead_count ?? 0 },
          { label: "Qualified Conversation", value: model.summary?.qualified_count ?? 0 },
          { label: "Won", value: model.summary?.won_count ?? 0 },
          { label: "รายการรายได้", value: model.summary?.revenue_record_count ?? 0 },
        ],
      };
    }

    const questionRows = model.questionFrequency.map((row) => ({
      "หัวข้อ": row.questionId,
      "เส้นทางลูกค้า": lineJourneyLabel(row.journey),
      "ประเภท": "คำถามที่พบบ่อย",
      "จำนวนครั้ง": row.requestCount,
      "ผลลัพธ์": row.outcome,
      "เหตุผล": row.reason ?? "—",
      "พบล่าสุด (เวลาไทย)": formatBangkokDateTime(row.lastSeenAt),
    }));
    const gapRows = model.contentGapInputs.map((row) => ({
      "หัวข้อ": row.questionId,
      "เส้นทางลูกค้า": lineJourneyLabel(row.journey),
      "ประเภท": "Content Gap",
      "จำนวนครั้ง": row.totalGapSignalCount,
      "ผลลัพธ์": "ควรพิจารณาเพิ่ม/ปรับเนื้อหา",
      "เหตุผล": "ยังไม่มีคำตอบ " + row.noApprovedAnswerCount + " · แหล่งข้อมูลไม่พร้อม " + row.sourceUnavailableCount,
      "พบล่าสุด (เวลาไทย)": formatBangkokDateTime(row.lastSeenAt),
    }));
    const rows = [...questionRows, ...gapRows];
    return {
      dataset,
      title: "Customer Insights",
      generatedAt,
      timeZone: "Asia/Bangkok",
      columns: Object.keys(rows[0] ?? {}),
      rows,
      overview: [
        { label: "หัวข้อคำถาม", value: model.questionFrequency.length },
        { label: "Content Gap", value: model.contentGapInputs.length },
      ],
    };
  }

  if (dataset === "automation-runs") {
    const model = await readOperationsJobs(100, variables);
    const rows = model.jobs.map((job) => ({
      "งาน": job.kind,
      "ระบบ": job.source === "agent-os" ? "Agent OS / n8n" : job.source === "article-scheduler" ? "Article Scheduler" : "Social",
      "สถานะ": jobStatusLabel(job.status),
      "กำหนดเริ่ม (เวลาไทย)": formatBangkokDateTime(job.scheduledAt),
      "อัปเดตล่าสุด (เวลาไทย)": formatBangkokDateTime(job.updatedAt),
      "จบเมื่อ (เวลาไทย)": formatBangkokDateTime(job.completedAt),
      "จำนวนครั้งที่ลอง": job.attempts ? String(job.attempts.current) + "/" + String(job.attempts.max) : "—",
      "ปัญหา": job.error ?? "—",
      "รายละเอียด": job.detail,
    }));
    return {
      dataset,
      title: "Automation Runs",
      generatedAt,
      timeZone: "Asia/Bangkok",
      columns: Object.keys(rows[0] ?? {}),
      rows,
      overview: [
        { label: "งานล่าสุด", value: rows.length },
        { label: "ไม่สำเร็จ/ต้องตรวจ", value: model.jobs.filter((job) => ["failed", "reconciliation-required", "reconciliation_required"].includes(job.status)).length },
      ],
    };
  }

  throw new Error("EXPORT_DATASET_UNSUPPORTED");
}

