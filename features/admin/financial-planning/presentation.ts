import type { FaRatioResult, FaRatioStatus } from "./calculations";

/** Thai labels for the financial planning room. Plain, no promises, no superlatives. */

export const FA_MODES = [
  { id: "prep", label: "เตรียมก่อนนัด" },
  { id: "face", label: "คุยต่อหน้า" },
  { id: "online", label: "คุยออนไลน์ (แชร์จอ)" },
] as const;
export type FaMode = (typeof FA_MODES)[number]["id"];

export const FA_EMPLOYMENT_LABELS = {
  salaried: "มีเงินเดือนประจำ",
  self_employed: "อาชีพอิสระ / เจ้าของกิจการ",
} as const;

export const FA_FREQUENCY_LABELS = { monthly: "ต่อเดือน", yearly: "ต่อปี" } as const;

export const FA_INCOME_TYPE_LABELS = {
  "40(1)": "40(1) เงินเดือน ค่าจ้าง",
  "40(2)": "40(2) ค่าจ้างทำงาน ค่านายหน้า",
  "40(3)": "40(3) ค่าลิขสิทธิ์",
  "40(4)": "40(4) ดอกเบี้ย เงินปันผล",
  "40(5)": "40(5) ค่าเช่า",
  "40(6)": "40(6) วิชาชีพอิสระ",
  "40(7)": "40(7) รับเหมา",
  "40(8)": "40(8) ธุรกิจ และอื่น ๆ",
} as const;

export const FA_EXPENSE_KIND_LABELS = {
  living: "ค่าใช้จ่ายในบ้าน",
  insurance: "เบี้ยประกัน",
  saving: "ออม / ลงทุน",
  education: "การศึกษา",
  other: "อื่น ๆ",
} as const;

export const FA_LIQUIDITY_LABELS = {
  liquid: "สภาพคล่อง",
  invest: "ลงทุน / ออมระยะยาว",
  personal: "ใช้ส่วนตัว",
} as const;

export const FA_LIABILITY_KIND_LABELS = {
  mortgage: "สินเชื่อบ้าน",
  vehicle: "สินเชื่อรถ",
  credit_card: "บัตรเครดิต",
  personal: "สินเชื่อส่วนบุคคล",
  other: "อื่น ๆ",
} as const;

export const FA_NOTE_TAG_LABELS = {
  goal: "เป้าหมาย",
  worry: "สิ่งที่กังวล",
  family: "ครอบครัว",
  follow_up: "ต้องติดตาม",
  product_interest: "สนใจผลิตภัณฑ์",
} as const;

export const FA_CLIENT_STATUS_LABELS = { active: "ลูกค้าปัจจุบัน", former: "เลิกเป็นลูกค้าแล้ว" } as const;

export const FA_STATUS_LABELS: Record<FaRatioStatus, string> = {
  good: "ตามเกณฑ์",
  watch: "ควรระวัง",
  adjust: "ควรปรับ",
  unavailable: "ยังคำนวณไม่ได้",
};

export const FA_STATUS_CLASSES: Record<FaRatioStatus, string> = {
  good: "border-emerald-200/20 bg-emerald-300/10 text-emerald-100",
  watch: "border-amber-200/20 bg-amber-300/10 text-amber-100",
  adjust: "border-rose-200/20 bg-rose-300/10 text-rose-100",
  unavailable: "border-white/10 bg-white/[0.04] text-white/60",
};

export function ratioNote(result: FaRatioResult): string {
  if (result.status === "adjust" && result.value === null && result.unavailableReason === "no-assets") {
    return "มีหนี้แต่ยังไม่ได้กรอกสินทรัพย์";
  }
  switch (result.unavailableReason) {
    case "no-income": return "ยังไม่มีรายได้ในตาราง";
    case "no-expense": return "ยังไม่มีรายจ่ายในตาราง";
    case "no-assets": return "ยังไม่มีสินทรัพย์ในตาราง";
    case "net-worth-not-positive": return "ความมั่งคั่งสุทธิยังติดลบหรือเป็นศูนย์";
    default: return result.incompleteInputs ? "บางช่องยังไม่ได้กรอก ตัวเลขอาจเปลี่ยน" : result.formula;
  }
}

export const FA_ERROR_MESSAGES: Record<string, string> = {
  "planning-not-configured": "ห้องวางแผนยังไม่ได้ตั้งค่าฐานข้อมูลหรือกุญแจเข้ารหัส",
  "revision-conflict": "มีการบันทึกจากอีกหน้าต่างก่อนหน้านี้ กรุณาโหลดหน้าใหม่แล้วกรอกอีกครั้ง",
  "invalid-request": "ข้อมูลบางช่องไม่ถูกต้อง ลองตรวจตัวเลขอีกครั้ง",
  "not-found": "ไม่พบครอบครัวนี้",
  forbidden: "บัญชีนี้ไม่มีสิทธิ์เปิดห้องวางแผน",
  unauthorized: "กรุณาเข้าสู่ระบบอีกครั้ง",
  "invalid-origin": "คำขอนี้ไม่ได้มาจากหน้าศูนย์จัดการ",
};

export function errorMessage(code: unknown): string {
  return (typeof code === "string" && FA_ERROR_MESSAGES[code]) || "ยังบันทึกไม่ได้ ลองใหม่อีกครั้ง";
}
