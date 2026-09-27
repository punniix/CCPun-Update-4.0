export function metricText(value: number | null | undefined, unit?: string): string {
  if (value == null || !Number.isFinite(value)) return "ยังไม่มีข้อมูล";
  return `${value.toLocaleString("th-TH", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}

export function changeText(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "ยังเทียบไม่ได้";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;
}

export function storedDateText(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "ยังไม่ระบุ";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", ...(day ? {} : { timeStyle: "short" }), timeZone: day ? "UTC" : "Asia/Bangkok" }).format(new Date(day ? `${value}T00:00:00Z` : value));
}

export function safeContentHref(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, "https://ccpun.com");
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export const statusText: Record<string, string> = {
  fresh: "ข้อมูลล่าสุด", expected_lag: "ล่าช้าตามรอบต้นทาง", stale: "ข้อมูลเก่า", failed: "อัปเดตไม่สำเร็จ", unknown: "ยังไม่ทราบ",
  insufficient_data: "ข้อมูลยังไม่พอ", insufficient_history: "ประวัติยังไม่พอ", insufficient_sample: "ปริมาณยังไม่พอ", low: "ต่ำ", medium: "ปานกลาง", high: "สูง",
  ready: "พร้อม", pending: "รอวิเคราะห์", running: "กำลังวิเคราะห์", unavailable: "ยังไม่พร้อม", unmapped: "ยังไม่จับคู่เนื้อหา", mapped: "จับคู่แล้ว",
  improved: "เพิ่มขึ้น", declined: "ลดลง", stable: "ใกล้เคียงเดิม", new_activity: "กิจกรรมใหม่", growing: "กำลังเติบโต", declining: "กำลังลดลง",
  improved_after: "ดีขึ้นหลังทำ", declined_after: "ลดลงหลังทำ", inconclusive: "ยังสรุปไม่ได้", missing: "ไม่มีข้อมูล", partial: "ข้อมูลบางส่วน", complete: "ครบตามขอบเขต",
  sufficient: "ปริมาณผ่านเกณฑ์", backlog: "รอจัดแผน", planned: "วางแผนแล้ว", doing: "กำลังทำ", measuring: "กำลังวัดผล", done: "เสร็จแล้ว",
  new: "ใหม่", mature: "เติบโตเต็มช่วง", evergreen: "ทำผลงานต่อเนื่อง", refresh_candidate: "ควรตรวจเพื่ออัปเดต", retired: "เลิกใช้งาน", observed: "ต้นทางรายงาน", tracking_unavailable: "ยังไม่มี tracking พร้อมใช้",
};

export const labelStatus = (value: string) => statusText[value] ?? value;
