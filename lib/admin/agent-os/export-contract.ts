import { z } from "zod";

export const CCPUN_TIME_ZONE = "Asia/Bangkok";
export const CCPUN_UTC_OFFSET = "+07:00";

export const EXPORT_FORMATS = ["csv", "google-sheet"] as const;
export const EXPORT_DATASETS = [
  "crm-overview",
  "crm-leads",
  "crm-follow-ups",
  "growth-funnel",
  "customer-insights",
  "automation-runs",
] as const;

export const exportFormatSchema = z.enum(EXPORT_FORMATS);
export const exportDatasetSchema = z.enum(EXPORT_DATASETS);

export type ExportFormat = z.infer<typeof exportFormatSchema>;
export type ExportDataset = z.infer<typeof exportDatasetSchema>;

function bangkokParts(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("EXPORT_DATE_INVALID");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CCPUN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

export function bangkokDateSuffix(value: string | Date) {
  const p = bangkokParts(value);
  return `${p.year}-${p.month}-${p.day}`;
}

export function formatBangkokDateTime(value: string | Date | null) {
  if (!value) return "";
  const p = bangkokParts(value);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function formatBangkokDateTimeWithOffset(value: string | Date | null) {
  if (!value) return "";
  const p = bangkokParts(value);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} ${CCPUN_UTC_OFFSET}`;
}

const DATASET_FILE_LABELS: Record<ExportDataset, string> = {
  "crm-overview": "CCPun_CRM_Overview",
  "crm-leads": "CCPun_CRM_Leads",
  "crm-follow-ups": "CCPun_CRM_Followups",
  "growth-funnel": "CCPun_Growth_Funnel",
  "customer-insights": "CCPun_Customer_Insights",
  "automation-runs": "CCPun_Automation_Runs",
};

export function exportFileName(input: {
  dataset: ExportDataset;
  format: ExportFormat;
  generatedAt: string | Date;
}) {
  const suffix = bangkokDateSuffix(input.generatedAt);
  const base = `${DATASET_FILE_LABELS[input.dataset]}_${suffix}`;
  return input.format === "csv" ? `${base}.csv` : base;
}

export const OWNER_FRIENDLY_EXPORT_COLUMNS = {
  "crm-leads": [
    "ชื่อลูกค้า",
    "สถานะ",
    "เรื่องที่สนใจ",
    "แหล่งที่มา",
    "แคมเปญ",
    "บทความ/เครื่องมือ",
    "ได้รับเอกสารแล้ว",
    "วันติดตามถัดไป (เวลาไทย)",
    "คุยล่าสุด (เวลาไทย)",
    "ผลลัพธ์",
  ],
  "crm-follow-ups": [
    "ชื่อลูกค้า",
    "เรื่องที่ต้องทำ",
    "สถานะงาน",
    "กำหนดติดตาม (เวลาไทย)",
    "เลยกำหนด",
    "หมายเหตุ",
  ],
  "growth-funnel": [
    "แหล่งที่มา",
    "แคมเปญ",
    "บทความ/เครื่องมือ",
    "เริ่มต้นเส้นทาง",
    "Lead",
    "Qualified Conversation",
    "เริ่มดำเนินการ",
    "ดำเนินการเสร็จ",
    "Won",
    "Lost",
    "รายการรายได้",
  ],
  "customer-insights": [
    "หัวข้อ",
    "ประเภท Insight",
    "จำนวนครั้ง",
    "Qualified",
    "Won",
    "แนวโน้ม",
    "ข้อเสนอแนะ",
  ],
  "automation-runs": [
    "งาน",
    "สถานะ",
    "ขั้นตอนล่าสุด",
    "เริ่มเมื่อ (เวลาไทย)",
    "จบเมื่อ (เวลาไทย)",
    "ใช้เวลา",
    "จำนวนครั้งที่ลอง",
    "ปัญหา",
  ],
} as const;

export type GoogleSheetPresentationSpec = {
  title: string;
  timeZone: typeof CCPUN_TIME_ZONE;
  tabs: Array<{
    title: string;
    freezeHeader: true;
    autoFilter: true;
    humanReadable: true;
  }>;
};

export function googleSheetPresentationSpec(input: {
  dataset: ExportDataset;
  generatedAt: string | Date;
}): GoogleSheetPresentationSpec {
  return {
    title: exportFileName({ dataset: input.dataset, format: "google-sheet", generatedAt: input.generatedAt }),
    timeZone: CCPUN_TIME_ZONE,
    tabs: [
      { title: "ภาพรวม", freezeHeader: true, autoFilter: true, humanReadable: true },
      { title: "ข้อมูล", freezeHeader: true, autoFilter: true, humanReadable: true },
    ],
  };
}
