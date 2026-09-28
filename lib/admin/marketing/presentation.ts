import type { MarketingAnalysisOutput } from "../../local-ai/contracts";
import { marketingMetricLabels } from "./model";

export const MARKETING_AI_SUMMARY = "อ่านตัวเลขและช่วงข้อมูลที่แสดงก่อนตัดสินใจ กิจกรรมบนเว็บไซต์และการปรากฏในผลค้นหายังบอกความพร้อมของผู้ใช้หรือผลธุรกิจไม่ได้";
export const MARKETING_AI_DATA_NOTE = "คำอธิบายจาก AI เดิมไม่ใช้ประกอบการตัดสินใจ โปรดดูปริมาณ ความครบ และวันที่ของหลักฐานแต่ละรายการ";

// ponytail: v1 stores free prose; present only server-owned text until evidence-bound output replaces it.
export function marketingAiEvidenceGuidance(finding: MarketingAnalysisOutput["wins"][number]) {
  const labels = [...new Set(finding.evidence.map(item => marketingMetricLabels[item.metric]?.replace(/ · intent$/, "") ?? "ตัวชี้วัดที่อ้างอิง"))];
  return `ตรวจตัวเลข ${labels.join(" และ ")} ตามช่วงข้อมูลและคุณภาพหลักฐานด้านล่างก่อนเลือกงาน`;
}
