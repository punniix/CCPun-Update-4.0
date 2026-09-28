import type { MarketingAnalysisOutput } from "../../local-ai/contracts";
import { marketingMetricLabels } from "./model";

export const MARKETING_AI_SUMMARY = "อ่านตัวเลขและช่วงข้อมูลที่แสดงก่อนตัดสินใจ กิจกรรมบนเว็บไซต์และการปรากฏในผลค้นหายังบอกความพร้อมของผู้ใช้หรือผลธุรกิจไม่ได้";
export const MARKETING_AI_DATA_NOTE = "คำอธิบายจาก AI เดิมไม่ใช้ประกอบการตัดสินใจ โปรดดูปริมาณ ความครบ และวันที่ของหลักฐานแต่ละรายการ";

// ponytail: v1 stores free prose; present only server-owned text until evidence-bound output replaces it.
export function marketingAiEvidenceGuidance(finding: MarketingAnalysisOutput["wins"][number]) {
  const labels = [...new Set(finding.evidence.map(item => marketingMetricLabels[item.metric]?.replace(/ · intent$/, "") ?? "ตัวชี้วัดที่อ้างอิง"))];
  return `ตรวจตัวเลข ${labels.join(" และ ")} ตามช่วงข้อมูลและคุณภาพหลักฐานด้านล่างก่อนเลือกงาน`;
}

const hypotheses = {
  search_context: "ข้อมูลรวมยังแยกไม่ได้ว่าคำค้น หน้า หรือการมองเห็นใน Google Search ส่วนใดเปลี่ยน",
  organic_path: "ข้อมูลรวมยังแยกไม่ได้ว่าหน้าเริ่มต้นหรือที่มาของผู้เข้าชม Organic ส่วนใดเปลี่ยน",
  intent_path: "กิจกรรมที่วัดได้เปลี่ยน แต่ยังไม่รู้ว่าผู้ใช้หยุดที่ขั้นใด และยังนับเป็นลูกค้าไม่ได้",
  source_health: "ข้อมูลต้นทางล่าช้าหรือเก็บไม่สำเร็จ จึงยังตีความแนวโน้มจากชุดนี้ไม่ได้",
  unknown: "ข้อมูลที่มีบอกประเด็นให้ตรวจ แต่ยังไม่พอแยกสาเหตุ",
} as const;
const nextChecks = {
  query_page_position: "แยกดูคำค้น หน้า และตำแหน่งใน Google Search ของช่วงเดียวกัน",
  landing_source: "แยกดูหน้าเริ่มต้นและแหล่งที่มาของเซสชัน Organic ในช่วงเดียวกัน",
  intent_steps: "เทียบกิจกรรมก่อนหน้าและถัดไปตามหน้าและช่วงเดียวกัน โดยไม่ตีความเป็นจำนวนลูกค้า",
  check_collector: "ตรวจเวลาข้อมูลล่าสุดและงานเก็บข้อมูลต้นทางก่อนเทียบผล",
  check_source: "เปิดรายละเอียดต้นทางของช่วงเดียวกันและเก็บหลักฐานเพิ่มก่อนเปลี่ยนแผน",
} as const;
export function marketingAiDiagnosis(finding: MarketingAnalysisOutput["wins"][number]) {
  return finding.hypothesisCode && finding.nextCheckCode
    ? { hypothesis: hypotheses[finding.hypothesisCode], nextCheck: nextChecks[finding.nextCheckCode] }
    : null;
}
