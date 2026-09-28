import { aisvSourceRuntimeLabel } from "@/lib/admin/seo-intelligence/aisv";

const seoOverviewLabels: Record<string, string> = {
  "Keyword Research ที่บันทึกไว้": "คำค้นที่บันทึกไว้",
  "AISV Prompt": "คำถามที่ติดตามการปรากฏในคำตอบ AI",
  "สถานะ AISV": "สถานะข้อมูลการปรากฏในคำตอบ AI",
  "AI Visibility": "สัดส่วนคำตอบ AI ที่มี CCPun",
  "AI Mentions": "ครั้งที่กล่าวถึง CCPun ในคำตอบ AI",
  "AI Answers": "คำตอบ AI ที่ตรวจ",
  "ช่วงรายงาน AISV": "ช่วงรายงานการปรากฏในคำตอบ AI",
  "Research ล่าสุด": "ข้อมูลคำค้นล่าสุด",
  "AISV Runtime": "วิธีเก็บข้อมูลการปรากฏในคำตอบ AI",
  "ขอบเขตไฟล์": "ขอบเขตข้อมูล",
};

const seoLimitations: Record<string, string> = {
  "AISV เป็นแหล่งเสริมที่ยังไม่ configured; รายงานรอบนี้มีเฉพาะ stored Research ไม่ใช่ AISV ค่า 0": "ยังไม่ได้เชื่อมข้อมูลการปรากฏในคำตอบ AI รอบนี้จึงมีเฉพาะคำค้นที่บันทึกไว้ การไม่มีข้อมูล AI ไม่ได้หมายถึงผลเป็น 0%",
  "อ่าน stored Research/AISV เดิม ไม่ยิง Ubersuggest ใหม่; แถว keyword และ prompt มี grain ต่างกัน; provider runtime อยู่บน Local Mac; ไม่รวม 2 คำค้นทดสอบ CSV ที่ COO อนุมัติ": "ใช้ข้อมูลคำค้นและคำตอบ AI ที่บันทึกไว้แล้ว ไม่ดึง Ubersuggest ใหม่ ข้อมูลสองชนิดนับคนละแบบ เก็บข้อมูลจากเครื่องภายใน CCPun และไม่รวมคำค้นทดสอบ 2 รายการ",
  "ถึงขีดจำกัด snapshot 50,000 แถว; raw มี sentinel แถวที่ 50,001 เพื่อยืนยัน coverage ไม่ครบ": "เก็บข้อมูลได้สูงสุด 50,000 แถวในรอบนี้ จึงอาจไม่ครอบคลุมข้อมูลทั้งหมด",
};

export function ownerAnalyticsOverviewLabel(report: string, label: string): string {
  return report === "seo-intelligence" ? seoOverviewLabels[label] ?? label : label;
}

export function ownerAnalyticsOverviewValue(report: string, label: string, value: string | number | boolean): string | number | boolean {
  if (report !== "seo-intelligence") return value;
  if (label === "AISV Runtime") return aisvSourceRuntimeLabel(typeof value === "string" ? value : null);
  if (label === "ขอบเขตไฟล์" && value === "Stored Research + Ubersuggest AISV · export ไม่ยิง provider สด") return "ข้อมูลคำค้นที่บันทึกไว้และผลการปรากฏในคำตอบ AI จาก Ubersuggest โดยไม่ดึงข้อมูลใหม่ตอนส่งออก";
  return value;
}

export function ownerAnalyticsLimitation(report: string, value: string): string {
  if (report !== "seo-intelligence") return value;
  return seoLimitations[value] ?? (/\b(?:stored|grain|runtime|configured|snapshot|sentinel|provider|raw)\b/i.test(value) ? "มีข้อจำกัดของข้อมูลที่ต้องให้ทีมดูแลตรวจรายละเอียด" : value);
}
