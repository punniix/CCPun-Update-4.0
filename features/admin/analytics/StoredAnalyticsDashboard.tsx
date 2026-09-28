import Link from "next/link";
import { cache } from "react";
import { AnalyticsCharts } from "./AnalyticsCharts";
import { PerformanceInsights } from "./PerformanceInsights";
import { DailyAssessment } from "./DailyAssessment";
import { readDailyAssessment } from "@/lib/admin/analytics/assessment";
import { readAnalyticsDashboard } from "@/lib/admin/analytics/store";
import { requireAdminPermission } from "@/lib/admin/require-permission";

const SOURCES: Record<string, string> = { gsc: "Google Search Console", ga4: "Google Analytics 4", meta: "Facebook / Instagram", ubersuggest: "Ubersuggest" };
const REPORTS: Record<string, string> = {
  "gsc-summary": "ภาพรวมการค้นหา Google", "gsc-query-page": "คำค้นและหน้าที่ปรากฏบน Google",
  "ga4-summary": "ภาพรวมผู้เข้าชมเว็บ", "ga4-organic-landing": "หน้าที่เข้าจากการค้นหา",
  "ga4-session-performance": "ผู้เข้าชมตามวัน ช่องทาง และแคมเปญ", "ga4-marketing-events": "การใช้เครื่องมือและคลิก LINE",
  "social-performance": "ผลลัพธ์โพสต์โซเชียล", "seo-intelligence": "คำค้นและการปรากฏในคำตอบ AI",
  "ubersuggest-web-keywords": "รายงานคำค้นจากเว็บ Ubersuggest",
};
// ponytail: resolve the server clock once per request, never during client hydration.
export const readAnalyticsNow = cache(() => Date.now());
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e0c985]";
const control = `mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[#251818] px-3 text-sm text-white ${focus}`;
const link = `inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5 ${focus}`;
function date(value: string | null | undefined) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value + "T00:00:00Z"));
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value)) : "ยังไม่มีข้อมูล";
}

export async function StoredAnalyticsDashboard({ searchParams, searchOnly = false, now }: { searchParams: Record<string, string | string[] | undefined>; searchOnly?: boolean; now: number }) {
  await requireAdminPermission("settings:read");
  const [model, assessment] = await Promise.all([readAnalyticsDashboard(), readDailyAssessment()]);
  const datasets = model.datasets.filter((item) => !searchOnly || item.source === "gsc" || item.source === "ga4");
  const source = typeof searchParams.source === "string" ? searchParams.source : "";
  const report = typeof searchParams.report === "string" ? searchParams.report : "";
  const period = typeof searchParams.period === "string" ? searchParams.period : "";
  const periodKey = (item: (typeof datasets)[number]) => `${item.windowStart ?? ""}|${item.windowEnd ?? ""}`;
  const periods = [...new Set(datasets.map(periodKey))].filter((value) => value !== "|");
  const visible = datasets.filter((item) => (!source || item.source === source) && (!report || item.report === report) && (!period || periodKey(item) === period));
  const statuses = model.sources.filter((item) => !searchOnly || item.source === "gsc" || item.source === "ga4");

  return <div className="min-w-0">
    <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ข้อมูลสำหรับตัดสินใจ</p>
    <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div>
      <h1 className="text-3xl font-semibold leading-snug">{searchOnly ? "การค้นหาและผู้เข้าชม" : "ภาพรวมข้อมูล"}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">อ่านข้อมูลที่บันทึกไว้จากรอบอัปเดตรายวัน เปิดหน้านี้หรือดาวน์โหลดไฟล์ได้โดยไม่ต้องขอข้อมูลจากต้นทางใหม่ แต่ละรายงานแสดงช่วงข้อมูลและเวลาที่บันทึกของตัวเอง</p>
    </div><Link href="/analytics/exports/" className={link}>ส่งออก CSV / Excel / Google Sheet</Link></div>

    <section className="mt-7 border-y border-white/15 py-5" aria-label="สถานะการอัปเดตแต่ละแหล่ง">
      <h2 className="text-lg font-semibold">สถานะอัปเดตรายวัน</h2>
      {model.state === "unavailable" ? <p className="mt-2 text-sm text-amber-100">ยังอ่านคลังข้อมูลไม่ได้ ลองเปิดใหม่ภายหลัง ตัวเลขที่ไม่มีข้อมูลจะไม่แสดงเป็นศูนย์</p> : null}
      <ul className="mt-3 grid gap-4 sm:grid-cols-2">{statuses.map((item) => {
        const saved = datasets.find((dataset) => dataset.source === item.source);
        const failed = item.lastAttemptStatus === "failed";
        return <li key={item.source} className="min-w-0"><h3 className="font-medium">{SOURCES[item.source] ?? item.source}</h3>
          <p className="mt-1 text-sm text-white/70">{saved ? `บันทึกเข้าคลังเมื่อ ${date(saved.collectedAt)}` : "ยังไม่มีข้อมูลที่บันทึกสำเร็จ"}</p>
          {item.lastAttemptAt ? <p className="mt-1 text-xs text-white/60">ลองอัปเดตล่าสุด: {date(item.lastAttemptAt)}</p> : null}
          {item.lastError === "not-configured" ? <p className="mt-1 text-xs text-amber-100">ยังต้องเชื่อมต่อแหล่งข้อมูลก่อนอัปเดตได้</p> : null}
          <p className={`mt-1 text-xs leading-5 ${failed ? "text-amber-100" : "text-white/60"}`}>{failed ? saved ? "รอบล่าสุดไม่สำเร็จ ยังใช้และส่งออกชุดที่บันทึกสำเร็จล่าสุดได้" : "รอบล่าสุดไม่สำเร็จ และยังไม่มีชุดข้อมูลก่อนหน้าที่ใช้แทนได้" : item.lastAttemptStatus === "running" ? "กำลังอัปเดต ข้อมูลที่บันทึกสำเร็จก่อนหน้ายังใช้งานได้" : saved ? "ใช้ชุดที่บันทึกสำเร็จล่าสุด" : "รอรอบอัปเดตแรกหรือการเชื่อมต่อแหล่งข้อมูล"}</p>
          {saved && now - Date.parse(saved.collectedAt) > 36 * 60 * 60 * 1000 ? <p className="mt-1 text-xs text-amber-100">ไม่ได้บันทึกชุดใหม่เกิน 36 ชั่วโมงแล้ว</p> : null}
        </li>;
      })}</ul>
    </section>

    <form className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]" method="get">
      <label className="text-sm text-white/70">แหล่งข้อมูล<select name="source" defaultValue={source} className={control}><option value="">ทุกแหล่ง</option>{Object.entries(SOURCES).filter(([key]) => !searchOnly || key === "gsc" || key === "ga4").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="text-sm text-white/70">รายงาน<select name="report" defaultValue={report} className={control}><option value="">ทุกรายงาน</option>{Object.entries(REPORTS).filter(([key]) => !searchOnly || key.startsWith("gsc-") || key.startsWith("ga4-")).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="text-sm text-white/70">ช่วงข้อมูล<select name="period" defaultValue={period} className={control}><option value="">ทุกช่วงที่บันทึกไว้</option>{periods.map((value) => <option key={value} value={value}>{value.split("|").map((part) => part || "ไม่ระบุ").join(" ถึง ")}</option>)}</select></label>
      <button type="submit" className={`min-h-11 self-end rounded-xl bg-[#e0c985] px-5 py-2 text-sm font-medium text-[#251818] ${focus}`}>แสดงรายงาน</button>
    </form>
    {!visible.length ? <p className="mt-6 rounded-2xl border border-white/15 p-5 text-sm leading-6 text-white/70">{datasets.length ? "ไม่มีรายงานตรงกับตัวกรองนี้ ลองเลือกทุกแหล่งและทุกช่วงข้อมูล" : "ยังไม่มีชุดข้อมูลที่บันทึกสำเร็จ เมื่ออัปเดตรอบแรกเสร็จ รายงานและไฟล์จะใช้ข้อมูลชุดเดียวกัน"}</p> : null}
    <PerformanceInsights datasets={datasets} />
    <DailyAssessment assessment={assessment} />
    {visible.map((item) => {
      const metrics = item.overview.length ? item.overview : item.report.endsWith("-summary") && item.rows.length === 1 ? item.columns.map((label) => ({ label, value: item.rows[0]![label] ?? "—" })) : [];
      return <section key={`${item.report}-${item.batchId}`} className="mt-7 min-w-0 rounded-2xl border border-white/15 bg-white/[0.025] p-4 md:p-6" aria-label={REPORTS[item.report] ?? item.report}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div>
        <p className="text-xs text-[#e0c985]">{SOURCES[item.source] ?? item.source}</p><h2 className="mt-1 text-xl font-semibold">{REPORTS[item.report] ?? item.report}</h2>
        <p className="mt-2 text-sm text-white/70">ช่วงข้อมูล: {item.windowStart ?? "ไม่ระบุ"} ถึง {item.windowEnd ?? "ไม่ระบุ"}</p>
        <p className="mt-1 text-xs text-white/60">ข้อมูลต้นทาง ณ {item.sourceAsOf ? <time dateTime={item.sourceAsOf}>{date(item.sourceAsOf)}</time> : "ต้นทางไม่ได้ระบุ"} {item.sourceAsOf && /^\d{4}-\d{2}-\d{2}$/.test(item.sourceAsOf) ? "(วันที่ตามรายงานต้นทาง)" : item.sourceAsOf ? "(เวลาไทย)" : ""} · บันทึกเข้าคลัง <time dateTime={item.collectedAt}>{date(item.collectedAt)}</time> (เวลาไทย)</p>
        {item.sourceAsOf && Date.parse(item.collectedAt) - Date.parse(item.sourceAsOf) > 48 * 60 * 60 * 1000 ? <p className="mt-1 text-xs text-amber-100">ข้อมูลต้นทางเก่ากว่ารอบบันทึกเกิน 2 วัน อ่านช่วงข้อมูลประกอบก่อนวิเคราะห์</p> : null}
      </div><a download href={`/api/admin/analytics/export/?report=${encodeURIComponent(item.report)}`} className={link}>ดาวน์โหลด CSV รายงานนี้</a></div>
      {metrics.length ? <dl className="mt-5 grid gap-3 border-y border-white/10 py-4 sm:grid-cols-2 lg:grid-cols-3">{metrics.map((metric, index) => <div key={`${metric.label}-${index}`} className="min-w-0 rounded-lg bg-black/15 p-3"><dt className="text-xs leading-5 text-white/65">{metric.label}</dt><dd className="mt-1 break-words text-xl font-semibold">{typeof metric.value === "number" ? metric.value.toLocaleString("th-TH", { maximumFractionDigits: 4 }) : typeof metric.value === "boolean" ? metric.value ? "ใช่" : "ไม่" : metric.value || "—"}</dd></div>)}</dl> : null}
      <AnalyticsCharts dataset={item} />
      <details className="mt-5"><summary className={`min-h-11 cursor-pointer py-2 text-sm text-white/80 ${focus}`}>ดูข้อมูลและความหมายของรายงาน ({item.rows.length.toLocaleString("th-TH")} แถว)</summary>
        <p className="mt-1 text-xs leading-5 text-white/60">แสดงตัวอย่างไม่เกิน 25 แถว ดาวน์โหลดไฟล์เพื่อดูทุกแถว ค่าว่างหมายถึงไม่มีข้อมูล ไม่ใช่ศูนย์ จำนวนผู้ใช้และการเข้าถึงอาจซ้ำกัน จึงไม่ควรบวกข้ามแหล่งข้อมูล ช่วงวันของต้นทางใช้ {item.nativeTimeZone || "เขตเวลาตามต้นทาง"}</p>
        {item.rows.length ? <div className="mt-3 max-w-full overflow-x-auto rounded-xl border border-white/10" tabIndex={0} role="region" aria-label={`ตาราง ${REPORTS[item.report] ?? item.report}`}><table className="w-full text-left text-sm"><caption className="sr-only">ตัวอย่างข้อมูลที่บันทึกไว้ของรายงาน {REPORTS[item.report] ?? item.report}</caption><thead className="bg-black/20"><tr>{item.columns.map((column) => <th scope="col" key={column} className="whitespace-nowrap px-4 py-3 font-medium">{column}</th>)}</tr></thead><tbody>{item.rows.slice(0, 25).map((row, index) => <tr key={index} className="border-t border-white/10">{item.columns.map((column) => <td key={column} className="max-w-sm px-4 py-3 align-top break-words">{row[column] == null ? "—" : typeof row[column] === "boolean" ? row[column] ? "ใช่" : "ไม่" : String(row[column])}</td>)}</tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-white/65">ต้นทางส่งกลับมาโดยไม่มีแถวข้อมูล รายงานนี้ยังส่งออกคำอธิบายและสถานะได้</p>}
      </details>
      {item.truncated ? <p className="mt-3 text-sm text-amber-100">ข้อมูลบางส่วนถูกจำกัดจำนวนจากการเก็บข้อมูล ไม่ใช่ข้อมูลทั้งหมดของต้นทาง</p> : null}
      {item.limitations.length ? <ul className="mt-3 space-y-1 text-xs leading-5 text-white/65">{item.limitations.map((note, index) => <li key={index}>{note}</li>)}</ul> : null}
    </section>;
    })}
  </div>;
}
