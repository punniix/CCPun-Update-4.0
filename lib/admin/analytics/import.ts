import { parseCsvRecords, parseUbersuggestKeywordCsv } from "../ubersuggest-csv";
import { analyticsDatasetSchema, analyticsHash, isAnalyticsCredentialKey, sanitizeAnalyticsRaw, type AnalyticsDataset } from "./model";

export type WebCsvMetadata = { windowStart: string; windowEnd: string; market: string; language: string; currency: string | null; sourceAsOf?: string | null };
export function prepareUbersuggestWebImport(csv: string, metadata: WebCsvMetadata, batchId: string, collectedAt: string) {
  const parsed = parseUbersuggestKeywordCsv(csv, 50_000);
  const records = parseCsvRecords(csv);
  // Preserve every original column/row, including invalid and duplicate rows, in private raw.
  const safeHeaders = records[0]!.map((header, index) => ({ header, index })).filter((item) => !isAnalyticsCredentialKey(item.header));
  const body = sanitizeAnalyticsRaw({ headers: safeHeaders.map((item) => item.header), records: records.slice(1).map((record) => safeHeaders.map((item) => record[item.index] ?? "")), ...metadata, sourceAsOf: metadata.sourceAsOf ?? null, reportType: parsed.reportType });
  const hash = analyticsHash(body);
  const changeIndex = records[0]!.findIndex((header) => header.trim().toLowerCase() === "change");
  const columns = ["คำค้น", "Intent", "Volume", "Difficulty (0–100)", "CPC", "สกุลเงิน CPC", "Paid difficulty (0–100)", "อันดับ", "การเปลี่ยนอันดับ (ต้นทาง)", "Estimated visits", "หน้าเว็บ", "พื้นที่", "ภาษา", "แถวต้นทาง"];
  const data: AnalyticsDataset = analyticsDatasetSchema.parse({ report: "ubersuggest-web-keywords", source: "ubersuggest", title: "Ubersuggest · Website CSV", batchId, collectedAt, ...metadata, sourceAsOf: metadata.sourceAsOf ?? null, nativeTimeZone: null,
    columns, rows: parsed.rows.map((row) => ({ "คำค้น": row.keyword, "Intent": row.intent ?? null, "Volume": row.volume ?? null, "Difficulty (0–100)": row.difficulty ?? null, "CPC": row.cpc ?? null, "สกุลเงิน CPC": metadata.currency, "Paid difficulty (0–100)": row.paidDifficulty ?? null, "อันดับ": row.position ?? null, "การเปลี่ยนอันดับ (ต้นทาง)": changeIndex >= 0 ? records[row.sourceRow - 1]?.[changeIndex] ?? null : null, "Estimated visits": row.estimatedVisits ?? null, "หน้าเว็บ": sanitizeAnalyticsRaw(row.url ?? null), "พื้นที่": metadata.market, "ภาษา": metadata.language, "แถวต้นทาง": row.sourceRow })),
    overview: [{ label: "ประเภทไฟล์", value: parsed.reportType }, { label: "แถวต้นฉบับ", value: parsed.sourceRows }, { label: "แถวซ้ำ", value: parsed.duplicateRows }, { label: "แถวผิดรูปแบบ", value: parsed.invalidRowCount }],
    limitations: ["ไฟล์ report ที่ owner export จากเว็บไซต์ Ubersuggest; ไม่เรียก MCP/API และไม่ใช้เครดิตค้นหา", "ช่วงข้อมูลและวันที่ต้นทางอัปเดตมาจาก owner; sourceAsOf ที่ระบุเป็นวันที่เท่านั้น ไม่ทราบเวลา/เขตเวลาต้นทาง", "raw เก็บทุกแถว/คอลัมน์หลังตัด credential; normalized เลือกแถวคำค้นซ้ำที่ข้อมูลครบกว่าและไม่นำแถวผิดรูปแบบไปวิเคราะห์", "CPC ตามสกุลเงินที่ระบุ; ว่าง = ไม่ทราบ"], truncated: false, rawHash: hash, lastAttemptAt: collectedAt, lastAttemptStatus: "completed" });
  return { data, body, hash, parsed };
}
