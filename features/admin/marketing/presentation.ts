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
  see_source_health: "ดูสถานะข้อมูลต้นทางด้านล่าง", queued: "รอคิววิเคราะห์", repeatable_event_count: "นับกิจกรรมที่อาจเกิดซ้ำ", native_snapshot_not_period_activity: "ยอดสะสม ณ วันที่เก็บข้อมูล", investigation: "ตรวจหาสาเหตุ",
  win: "ผลที่ดีขึ้น", risk: "จุดที่ควรระวัง", opportunity: "โอกาส", watch: "สิ่งที่ควรติดตาม", learning: "สิ่งที่ได้เรียนรู้", monitor: "ติดตามต่อ", title: "ปรับชื่อเรื่อง", description: "ปรับคำอธิบาย", refresh: "อัปเดตเนื้อหา", cta: "ปรับปุ่มชวนติดต่อ", internal_link: "เพิ่มลิงก์ภายใน", expansion: "ขยายเนื้อหา", promotion: "ประชาสัมพันธ์", keyword: "ปรับคำค้นเป้าหมาย",
};

export const labelStatus = (value: string) => statusText[value] ?? value;

const metricLabels: Record<string, string> = {
  organic_sessions: "การเข้าชมจาก Google", search_clicks: "คลิกจาก Google Search", search_impressions: "การแสดงใน Google Search", line_clicks: "คลิกไป LINE", calculator_complete: "คำนวณจนเสร็จ", social_views: "ยอดดูโพสต์",
};

export const ownerMetricLabel = (value: string) => metricLabels[value] ?? value;

export function ownerUnitLabel(value?: string): string {
  const units: Record<string, string> = { sessions: "ครั้ง", clicks: "คลิก", impressions: "ครั้ง", percent: "%", position: "อันดับ", views: "ครั้ง", events: "ครั้ง", native_reach: "บัญชี", native_counter: "ครั้ง" };
  return value ? units[value] ?? value : "";
}

export function ownerContentTitle(title: string, assetId: string, platform?: string | null): string {
  // ponytail: providers sometimes return only an opaque post ID; label the asset without inventing a title.
  return title === assetId.split(":").at(-1) ? `โพสต์${platform || assetId.split(":")[1] || "โซเชียล"} (ยังไม่มีชื่อเรื่อง)` : title;
}

export function ownerEventLabel(value: string): string {
  const events: Record<string, string> = { line_oa_click: "กดไป LINE", ci_start: "เริ่มเครื่องมือประกันโรคร้ายแรง", ci_complete: "คำนวณประกันโรคร้ายแรงสำเร็จ", ci_calculator_complete: "คำนวณประกันโรคร้ายแรงสำเร็จ", fhc_start: "เริ่มตรวจสุขภาพการเงิน", fhc_complete: "ตรวจสุขภาพการเงินสำเร็จ" };
  return events[value] ?? (value.startsWith("ci_") ? "กิจกรรมในเครื่องมือประกันโรคร้ายแรง" : value.startsWith("fhc_") ? "กิจกรรมในเครื่องมือตรวจสุขภาพการเงิน" : "กิจกรรมบนเว็บไซต์");
}

export function ownerLeaderboardTitle(value: string): string {
  const names: Record<string, string> = { "Top Organic Content": "บทความที่มีคนเข้าจาก Google มากที่สุด", "Top Search Content": "บทความที่มีคนคลิกจาก Google Search มากที่สุด", "Top LINE Intent Activity": "เนื้อหาที่พาคนกดไป LINE มากที่สุด", "Top Calculator Completion Activity": "เนื้อหาที่พาคนคำนวณจนเสร็จมากที่สุด", "Top Facebook published posts · snapshot views": "โพสต์ Facebook ที่มียอดดูมากที่สุด", "Top Instagram published posts · snapshot views": "โพสต์ Instagram ที่มียอดดูมากที่สุด", "Top growing organic content": "บทความที่กำลังเติบโต", "Top declining organic content": "บทความที่ยอดลดลง", "Top new organic content": "บทความใหม่ที่มีคนอ่าน", "Top evergreen organic content": "บทความที่ทำผลงานต่อเนื่อง" };
  return names[value] ?? value;
}

export function ownerLeaderboardBasis(value: string): string {
  if (value.includes("descending; URL tie-break")) return "เรียงตามยอดจริงของช่วงที่เลือก หากยอดเท่ากันใช้ที่อยู่หน้าเว็บช่วยเรียง";
  if (value.startsWith("Posts published in selected period")) return "โพสต์ที่เผยแพร่ในช่วงนี้ เรียงตามยอดดูสะสมล่าสุด ไม่ใช่ยอดดูเฉพาะช่วงนี้";
  if (value.startsWith("Valid comparable period change")) return "เรียงตามจำนวนที่เปลี่ยนไปเมื่อเทียบช่วงก่อน โดยใช้เฉพาะข้อมูลที่มากพอ";
  if (value.startsWith("Organic sessions; new/lifecycle")) return "เรียงตามการเข้าชมจาก Google ของเนื้อหาที่เข้าเกณฑ์";
  return value;
}

export function ownerEvidenceLabel(value: string, contentTitle?: string): string {
  if (value.startsWith("content:")) return `ข้อมูล${ownerMetricLabel(value.split(":")[1] ?? "เนื้อหา")} ของ${contentTitle ? ` “${contentTitle}”` : "เนื้อหานี้"}`;
  if (value.startsWith("kpi:")) return `ตัวเลขรวม: ${ownerMetricLabel(value.slice(4))}`;
  if (value.startsWith("health:")) return `สถานะการอัปเดต: ${ownerReportLabel(value.slice(7))}`;
  if (value.startsWith("social:")) return "ข้อมูลโพสต์จากแพลตฟอร์มต้นทาง";
  return "ข้อมูลต้นทางที่ระบบใช้ตรวจสอบ";
}

export function ownerReportLabel(value: string): string {
  const reports: Record<string, string> = {
    "ga4-daily-organic": "การเข้าชมจาก Google", "gsc-daily-page": "ผลค้นหาจาก Google", "ga4-content-events": "กิจกรรมบนเว็บไซต์", "ga4-session-performance": "แคมเปญและการเข้าชม", "ga4-marketing-events": "กิจกรรมการตลาดบนเว็บไซต์",
    "gsc-summary": "ภาพรวมการค้นหาจาก Google", "gsc-query-page": "คำค้นและหน้าเว็บบน Google", "ga4-summary": "ภาพรวมการเข้าชมเว็บไซต์", "ga4-organic-landing": "หน้าเว็บที่เข้าจาก Google", "social-performance": "ผลลัพธ์โพสต์โซเชียล", "seo-intelligence": "คำค้นและการปรากฏในคำตอบ AI", "ubersuggest-web-keywords": "คำค้นจาก Ubersuggest",
  };
  return reports[value] ?? value.replaceAll("-", " ");
}

export function ownerSourceLabel(value: string): string {
  const sources: Record<string, string> = { ga4: "การเข้าชมเว็บไซต์", gsc: "Google Search", meta: "Facebook / Instagram", ubersuggest: "Ubersuggest", "ai-visibility": "การปรากฏในคำตอบ AI" };
  return sources[value] ?? value;
}

export function ownerTimezoneLabel(value: string | null): string {
  return value === "Asia/Bangkok" ? "เวลาไทย" : value === "America/Los_Angeles" ? "เวลาตาม Google Search" : value || "ยังไม่ระบุเขตเวลา";
}

export function ownerMarketingText(value: string): string {
  if (value.startsWith("Investigate material decline: ")) return `ตรวจการลดลงของ${ownerMetricLabel(value.slice(30))}`;
  if (value.startsWith("Check source freshness: ")) return `ตรวจข้อมูลล่าสุดของ${ownerReportLabel(value.slice(24))}`;
  const known: Record<string, string> = {
    investigation: "ตรวจหาสาเหตุ",
    "Comparable covered periods exceed minimum volumes; decline is an observation, not a causal conclusion": "ตัวเลขลดลงเมื่อเทียบสองช่วงที่มีข้อมูลเพียงพอ แต่ยังบอกสาเหตุไม่ได้",
    "Source is stale or latest attempt failed; qualify recommendations until current evidence is available": "ข้อมูลต้นทางเก่าหรืออัปเดตครั้งล่าสุดไม่สำเร็จ ควรรอข้อมูลใหม่ก่อนตัดสินใจ",
    "Behavioral events are not confirmed leads; no cohort/session sequence, so conversion/drop-off rates and downstream outcomes are unavailable": "กิจกรรมบนเว็บยังไม่ใช่ลูกค้าที่ติดต่อจริง และข้อมูลที่มีอยู่ยังคำนวณอัตราผ่านแต่ละขั้นไม่ได้",
    "Business calendar Asia/Bangkok; mature provider cutoff; equivalent weekdays; partial month elapsed days capped to prior month; full-month day counts may differ": "ใช้วันตามเวลาไทยและรอข้อมูลต้นทางที่ครบพอ เดือนที่ยังไม่จบเทียบกับจำนวนวันเท่ากันของเดือนก่อน",
    "Monday-start; provider-native dates; common mature cutoff; MTD equal elapsed days": "สัปดาห์เริ่มวันจันทร์ และเดือนที่ยังไม่จบเทียบจำนวนวันเท่ากันของเดือนก่อน",
    "Numerical facts use latest native-key provider revisions; overlapping rolling reports are never summed.": "ใช้ข้อมูลล่าสุดจากแต่ละต้นทาง และไม่บวกยอดจากรายงานที่มีช่วงวันซ้ำกัน",
    "Blank is unavailable; zero requires a successfully covered report window.": "ช่องว่างหมายถึงยังไม่มีข้อมูล ส่วนเลขศูนย์หมายถึงมีข้อมูลครบแต่ไม่พบกิจกรรม",
    "GA4 distinct users and native Reach are nonadditive; no summed distinct-user metric is emitted.": "จำนวนผู้ใช้และการเข้าถึงอาจซ้ำกัน จึงไม่บวกยอดจากหลายแถวเข้าด้วยกัน",
    "North Star qualified conversations, appointments and revenue are unavailable without governed business outcomes.": "ยังไม่มีข้อมูลยืนยันจำนวนลูกค้าที่คุยจริง นัดหมาย หรือรายได้",
    "Growth/decline, evergreen lifecycle and benchmark confidence require sufficient comparable history.": "การประเมินว่าเติบโตหรือลดลงต้องมีข้อมูลย้อนหลังเพียงพอ",
    "MTD uses equivalent elapsed days; cross-source native-date/timezone alignment is disclosed.": "เดือนที่ยังไม่จบเทียบจำนวนวันเท่ากัน โดยแต่ละต้นทางอาจใช้เขตเวลาต่างกัน",
    "Actions are managed in Admin/Neon; bounded versioned Sheet imports preserve human fields and conflicts.": "งานที่คุณบันทึกในแผนจะไม่ถูกผลวิเคราะห์รอบใหม่เขียนทับ",
    "Data unavailable; no fabricated zeros": "ยังไม่มีข้อมูลที่พร้อมใช้ ระบบจะไม่แสดงเป็นศูนย์แทน",
    "Marketing analytical store unavailable; existing analytics exports remain available.": "ยังอ่านข้อมูลการตลาดไม่ได้ แต่ไฟล์วิเคราะห์เดิมยังใช้งานได้",
    "Marketing stored snapshot unavailable; no source API refresh attempted.": "ยังอ่านข้อมูลการตลาดที่บันทึกไว้ไม่ได้",
    "GSC clicks ตาม SQL": "จำนวนคลิกจาก Google Search",
  };
  return known[value] ?? value;
}
