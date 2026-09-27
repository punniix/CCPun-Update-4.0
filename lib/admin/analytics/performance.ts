import type { AnalyticsDataset } from "./model";
import type { OwnerExportDataset } from "../agent-os/export-datasets";

type Row = AnalyticsDataset["rows"][number];
import { EXPORT_ANALYSIS_VIEWS } from "../agent-os/export-contract";
export const PERFORMANCE_VIEWS = EXPORT_ANALYSIS_VIEWS;
export type PerformanceView = typeof PERFORMANCE_VIEWS[number];
export type PerformanceTable = { view: PerformanceView; title: string; columns: string[]; rows: Row[]; guidance: string };
const metaColumns = ["แหล่งข้อมูล", "ช่วงข้อมูลเริ่ม", "ช่วงข้อมูลสิ้นสุด", "ข้อมูลต้นทาง ณ", "เขตเวลาต้นทาง", "เก็บข้อมูล ณ (UTC)", "Batch ID", "Raw SHA256", "ข้อจำกัด"];
function metadata(data: AnalyticsDataset): Row {
  return { "แหล่งข้อมูล": data.source, "ช่วงข้อมูลเริ่ม": data.windowStart, "ช่วงข้อมูลสิ้นสุด": data.windowEnd, "ข้อมูลต้นทาง ณ": data.sourceAsOf, "เขตเวลาต้นทาง": data.nativeTimeZone, "เก็บข้อมูล ณ (UTC)": data.collectedAt, "Batch ID": data.batchId, "Raw SHA256": data.rawHash, "ข้อจำกัด": [...data.limitations, ...(data.truncated ? ["จำนวนแถวถูกจำกัด"] : [])].join(" | ") };
}
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
// ponytail: exact NFC/trim/case matching only; ambiguous matches stay unjoined, never fuzzy attribution.
const keyword = (value: unknown) => typeof value === "string" ? value.normalize("NFC").trim().toLowerCase() : "";
const eventMeaning: Record<string, string> = {
  ci_landing_view: "เปิดหน้า CI", ci_calculator_start: "เริ่มคำนวณ CI", ci_calculator_complete: "คำนวณ CI เสร็จ", ci_result_view: "ดูผล CI", ci_result_download: "ดาวน์โหลดผล CI", ci_contact_click: "คลิกติดต่อจาก CI",
  fhc_landing_view: "เปิดหน้า FHC", fhc_start: "เริ่ม FHC", fhc_complete: "ทำ FHC เสร็จ", fhc_result_view: "ดูผล FHC", fhc_result_download: "ดาวน์โหลดผล FHC", fhc_contact_click: "คลิกติดต่อจาก FHC", line_oa_click: "คลิก LINE ทั่วไป",
};
export function buildPerformanceTables(datasets: AnalyticsDataset[]): PerformanceTable[] {
  const gsc = datasets.filter(data => data.report === "gsc-query-page"), native = datasets.filter(data => data.report === "ubersuggest-web-keywords");
  const matches = new Map<string, Array<{ row: Row; data: AnalyticsDataset }>>();
  for (const data of native) for (const row of data.rows) { const key = keyword(row["คำค้น"]); if (key) matches.set(key, [...(matches.get(key) ?? []), { row, data }]); }
  const seoRows: Row[] = [];
  for (const data of gsc) for (const row of data.rows) {
    const joined = matches.get(keyword(row["คำค้น"])), match = joined?.length === 1 ? joined[0] : undefined;
    const impressions = number(row["การแสดงผล"]), clicks = number(row["คลิก"]), position = number(row["อันดับเฉลี่ย"]);
    const task = impressions !== null && impressions >= 100 && clicks === 0 ? "ตรวจชื่อหน้าและข้อความผลค้นหา" : position !== null && position >= 8 && position <= 20 ? "ตรวจความตรงคำค้นและเนื้อหาหน้า" : "ตรวจความเหมาะสมของหน้าเป้าหมาย";
    seoRows.push({ "คำค้น": row["คำค้น"] ?? null, "หน้าเป้าหมาย": row["หน้าเว็บ"] ?? null, "งานที่ควรตรวจ": task,
      "เหตุผล / กติกา": task.startsWith("ตรวจชื่อ") ? "แสดงผล ≥100 และ 0 คลิกในช่วงนี้; กติกาตรวจงาน ไม่ใช่ benchmark" : task.startsWith("ตรวจความตรง") ? "อันดับเฉลี่ย GSC 8–20; กติกาตรวจงาน ไม่ใช่การคาดการณ์อันดับ" : "ตรวจเจตนาการค้นหาและความเหมาะสมของหน้า; ไม่ทำนายผลลัพธ์",
      "การแสดงผล GSC": impressions, "คลิก GSC": clicks, "CTR GSC (%)": number(row["CTR (%)"]), "อันดับเฉลี่ย GSC": position,
      "Intent Ubersuggest": match?.row.Intent ?? null, "Volume Ubersuggest": match?.row.Volume ?? null, "Difficulty Ubersuggest (0–100)": match?.row["Difficulty (0–100)"] ?? null, "อันดับ Ubersuggest": match?.row["อันดับ"] ?? null,
      "การจับคู่คำค้น": match ? "ตรงกันหลัง NFC/trim/case; ไม่ใช่ attribution" : joined?.length ? "หลายแถวตรงกัน; ไม่จับคู่" : "ไม่มีคำตรงกัน",
      "Ubersuggest ต้นทาง ณ": match?.data.sourceAsOf ?? null, "Ubersuggest ช่วงเริ่ม": match?.data.windowStart ?? null, "Ubersuggest ช่วงสิ้นสุด": match?.data.windowEnd ?? null, "Ubersuggest เขตเวลา": match?.data.nativeTimeZone ?? null, "Ubersuggest Batch ID": match?.data.batchId ?? null, "Ubersuggest Raw SHA256": match?.data.rawHash ?? null, "Ubersuggest เก็บ ณ (UTC)": match?.data.collectedAt ?? null, "Ubersuggest ข้อจำกัด": match ? [...match.data.limitations, ...(match.data.truncated ? ["จำนวนแถวถูกจำกัด"] : [])].join(" | ") : null,
      ...metadata(data) });
  }
  if (!seoRows.length) for (const data of native) for (const row of data.rows) seoRows.push({ "คำค้น": row["คำค้น"] ?? null, "หน้าเป้าหมาย": row["หน้าเว็บ"] ?? null, "งานที่ควรตรวจ": "วางแผนหัวข้อและหน้าเป้าหมาย", "เหตุผล / กติกา": "ใช้ Intent/Volume เป็นบริบท; ยังไม่มีข้อมูลคำค้น GSC ที่ใช้ตรวจผลจริง", "การแสดงผล GSC": null, "คลิก GSC": null, "CTR GSC (%)": null, "อันดับเฉลี่ย GSC": null,
    "Intent Ubersuggest": row.Intent ?? null, "Volume Ubersuggest": row.Volume ?? null, "Difficulty Ubersuggest (0–100)": row["Difficulty (0–100)"] ?? null, "อันดับ Ubersuggest": row["อันดับ"] ?? null, "การจับคู่คำค้น": "ใช้รายงาน Ubersuggest โดยตรง", "Ubersuggest ต้นทาง ณ": data.sourceAsOf, "Ubersuggest ช่วงเริ่ม": data.windowStart, "Ubersuggest ช่วงสิ้นสุด": data.windowEnd, "Ubersuggest เขตเวลา": data.nativeTimeZone, "Ubersuggest Batch ID": data.batchId, "Ubersuggest Raw SHA256": data.rawHash, "Ubersuggest เก็บ ณ (UTC)": data.collectedAt, "Ubersuggest ข้อจำกัด": [...data.limitations, ...(data.truncated ? ["จำนวนแถวถูกจำกัด"] : [])].join(" | "), ...metadata(data) });
  seoRows.sort((a, b) => (number(b["การแสดงผล GSC"]) ?? number(b["Volume Ubersuggest"]) ?? -1) - (number(a["การแสดงผล GSC"]) ?? number(a["Volume Ubersuggest"]) ?? -1));
  const campaigns = datasets.filter(data => data.report === "ga4-session-performance"), activities = datasets.filter(data => data.report === "ga4-marketing-events");
  const gaps = [
    ["ค่าโฆษณาจริง", "ยังไม่มีในชุดข้อมูล", "เชื่อมรายงาน Ads Insights พร้อม campaign/ad IDs, currency, attribution window; CPC คำค้นไม่ใช่ค่าโฆษณาจริง"],
    ["ลูกค้าที่มีคุณภาพ", "ยังไม่มีในชุดข้อมูล", "เชื่อม CRM ที่แยก lead ID และสถานะ qualification; คลิก LINE ไม่ใช่ลูกค้าที่ผ่านการคัดกรอง"],
    ["รายได้จริง", "ยังไม่มีในชุดข้อมูล", "เชื่อมรายได้ที่ระบุแหล่งที่มา วันที่ และสกุลเงิน ก่อนคำนวณ ROAS"],
    ["การตั้งค่า Key event", "ยังไม่ได้ยืนยัน", "ตรวจ GA4 ว่า event ใดถูกทำเครื่องหมาย; ค่า 0 ไม่ยืนยันว่าไม่มีการติดต่อ"],
    ["แคมเปญและหน้าเข้า", campaigns.length ? "มีรายงานที่บันทึกไว้" : "ยังไม่มีรายงานที่บันทึกไว้", "ใช้ Session source/medium + campaign + landing page; (not set) คือค่าต้นทาง ไม่ใช่ Direct"],
    ["กิจกรรม CI / FHC / LINE", activities.length ? "มีรายงานที่บันทึกไว้" : "ยังไม่มีรายงานที่บันทึกไว้", "จำนวน event เป็นกิจกรรมที่เกิดซ้ำได้; ไม่คำนวณ funnel/drop-off หรือจำนวน lead"],
    ["ช่วงเวลาและขอบเขต", "ต้องตรวจแยกแต่ละแหล่ง", "อ่านวันที่/เขตเวลาแต่ละรายงาน; ห้ามใช้ GSC clicks กับ GA4 sessions เป็น funnel เดียว"],
  ];
  const seoColumns = ["คำค้น", "หน้าเป้าหมาย", "งานที่ควรตรวจ", "เหตุผล / กติกา", "การแสดงผล GSC", "คลิก GSC", "CTR GSC (%)", "อันดับเฉลี่ย GSC", "Intent Ubersuggest", "Volume Ubersuggest", "Difficulty Ubersuggest (0–100)", "อันดับ Ubersuggest", "การจับคู่คำค้น", "Ubersuggest ต้นทาง ณ", "Ubersuggest ช่วงเริ่ม", "Ubersuggest ช่วงสิ้นสุด", "Ubersuggest เขตเวลา", "Ubersuggest Batch ID", "Ubersuggest Raw SHA256", "Ubersuggest เก็บ ณ (UTC)", "Ubersuggest ข้อจำกัด", ...metaColumns];
  return [
    { view: "seo-review", title: "งานตรวจ SEO", columns: seoColumns, rows: seoRows, guidance: "เรียงตามการแสดงผล GSC; หากไม่มี GSC ใช้ Volume ต้นทางเพื่อวางแผน ไม่ใช่จำนวนผู้เข้าชมที่คาดการณ์ อันดับที่ว่างคือไม่ทราบ" },
    { view: "measurement-gaps", title: "ข้อมูลที่ต้องเชื่อม", columns: ["ข้อมูล", "สถานะ", "ขั้นตอนต่อไป"], rows: gaps.map(([field, status, next]) => ({ "ข้อมูล": field!, "สถานะ": status!, "ขั้นตอนต่อไป": next! })), guidance: "ยังคำนวณ CPA/ROAS ไม่ได้จนมีค่าใช้จ่ายและผลธุรกิจจริงที่เทียบช่วงเวลาเดียวกัน" },
    { view: "campaign-performance", title: "แคมเปญและหน้าเข้า", columns: [...new Set(campaigns.flatMap(data => data.columns)), ...metaColumns], rows: campaigns.flatMap(data => data.rows.map(row => ({ ...row, ...metadata(data) }))), guidance: "Pivot วันที่ → แหล่งทราฟฟิก / Medium → แคมเปญ → หน้าเข้า; รวมเซสชันได้เฉพาะแถวไม่ซ้ำขอบเขต ห้ามเฉลี่ย Session key event rate ตรง ๆ; Key events ไม่ใช่ lead" },
    { view: "marketing-activities", title: "กิจกรรมการตลาด", columns: ["วันที่", "Event", "ความหมาย", "จำนวน event", ...metaColumns], rows: activities.flatMap(data => data.rows.map(row => ({ ...row, "ความหมาย": eventMeaning[String(row.Event)] ?? "กิจกรรมอื่น; ต้องตรวจนิยามก่อนใช้", ...metadata(data) }))), guidance: "Pivot วันที่ → ความหมาย → จำนวน event; เป็นจำนวนการทำกิจกรรม ไม่ใช่คนที่ไม่ซ้ำ ไม่ใช่ funnel หรือยอดขาย" },
  ];
}
export function buildPerformanceExport(datasets: AnalyticsDataset[], view: PerformanceView, generatedAt: string): OwnerExportDataset {
  const table = buildPerformanceTables(datasets).find(item => item.view === view)!;
  return { dataset: "marketing-analytics", title: table.title, generatedAt, timeZone: "Asia/Bangkok", columns: table.columns, rows: table.rows, overview: [{ label: "ชุดวิเคราะห์", value: table.title }, { label: "สร้างไฟล์ ณ (UTC)", value: generatedAt }, { label: "วิธีใช้", value: table.guidance }, { label: "อ่านค่า", value: "ว่าง = ไม่ทราบ; 0 = ต้นทางรายงานศูนย์; % = 0–100; อ่านช่วงเวลาและข้อจำกัดก่อนเปรียบเทียบ" }, ...datasets.filter(data => view === "campaign-performance" ? data.report === "ga4-session-performance" : view === "marketing-activities" ? data.report === "ga4-marketing-events" : view === "seo-review" ? data.report === "gsc-query-page" || data.report === "ubersuggest-web-keywords" : true).flatMap(data => [{ label: data.title + " · ช่วง / เขตเวลา", value: `${data.windowStart ?? "ไม่ทราบ"} – ${data.windowEnd ?? "ไม่ทราบ"} / ${data.nativeTimeZone ?? "ไม่ทราบ"}` }, { label: data.title + " · ต้นทาง ณ / เก็บ ณ (UTC)", value: `${data.sourceAsOf ?? "ไม่ทราบ"} / ${data.collectedAt}` }, { label: data.title + " · Batch / Raw SHA256", value: `${data.batchId} / ${data.rawHash}` }, { label: data.title + " · ข้อจำกัด", value: [...data.limitations, ...(data.truncated ? ["จำนวนแถวถูกจำกัด"] : [])].join(" | ") }])] };
}
