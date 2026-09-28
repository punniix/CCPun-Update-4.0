import Link from "next/link";
import type { DailyAssessmentView } from "@/lib/admin/analytics/assessment";
import { ownerAnalyticsOverviewLabel } from "./owner-copy";

type AssessmentJob = NonNullable<DailyAssessmentView["latest"]>;
const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value)) : "ยังไม่ระบุ";
const statuses: Record<string, string> = { queued: "รอโมเดลประเมิน", leased: "โมเดลกำลังประเมิน", succeeded: "ประเมินเสร็จแล้ว", failed: "รอบนี้ประเมินไม่สำเร็จ", "reconciliation-required": "ต้องตรวจสถานะงานก่อนประเมินใหม่", cancelled: "ยกเลิกรอบประเมิน" };
const review = (job: AssessmentJob) => job.reviewStatus === "approved" ? "เจ้าของตรวจทานแล้ว" : job.reviewStatus === "rejected" ? "เจ้าของไม่รับข้อเสนอนี้" : job.output ? "ข้อเสนอจากโมเดล · ยังไม่ได้ตรวจทาน" : "ยังไม่มีข้อเสนอให้ตรวจทาน";
const groups: Record<string, string> = { "measurement-gap": "ความพร้อมในการวัดผล", "seo-review": "งานตรวจคำค้น", "keyword-planning": "วางแผนคำค้น", "campaign-review": "แคมเปญและหน้าเข้า", "activity-review": "กิจกรรมบนเว็บไซต์", "social-review": "โพสต์โซเชียล" };
const reportNames: Record<string, string> = { "gsc-summary": "ภาพรวมการค้นหา Google", "gsc-query-page": "คำค้นและหน้าเว็บบน Google", "ga4-summary": "ภาพรวมผู้เข้าชมเว็บ", "ga4-organic-landing": "หน้าที่เข้าจากการค้นหา", "ga4-session-performance": "ผู้เข้าชมตามช่องทางและแคมเปญ", "ga4-marketing-events": "การใช้เครื่องมือและคลิก LINE", "social-performance": "ผลลัพธ์โพสต์โซเชียล", "seo-intelligence": "ข้อมูลคำค้นและการปรากฏในคำตอบ AI", "ubersuggest-web-keywords": "รายงานคำค้นจาก Ubersuggest" };
const whyTerms: Array<[string, string]> = [
  ["qualified lead", "ลูกค้าที่ผ่านการคัดกรอง"], ["Key event", "เหตุการณ์สำคัญ"], ["CPA/ROAS", "CPA/ROAS (ต้นทุนต่อผลลัพธ์และผลตอบแทนโฆษณา)"], ["Ads", "โฆษณา"], ["CRM", "ระบบจัดการลูกค้า"], ["source/medium", "แหล่งที่มาและช่องทาง"], ["funnel drop-off", "อัตราหลุดระหว่างขั้น"], ["native metric", "ตัวเลขจากแพลตฟอร์ม"], ["raw data", "ข้อมูลต้นฉบับ"], ["inference", "การประเมินของโมเดล"], ["integration", "ระบบเชื่อมต่อ"], ["sourceAsOf", "วันที่ข้อมูลต้นทาง"], ["ไม่ใช่ benchmark", "ไม่ใช่เกณฑ์อ้างอิง"], ["benchmark", "เกณฑ์อ้างอิง"], ["SERP", "หน้าผลการค้นหา"], ["Intent/Volume", "เจตนาค้นหาและปริมาณค้นหา"], ["Reach", "Reach (การเข้าถึงตามนิยามของแต่ละแพลตฟอร์ม)"], ["URL", "ที่อยู่หน้าเว็บ"], ["object", "โพสต์"], ["rate", "อัตรา"], ["event", "กิจกรรม"], ["Daily", "รายวัน"], ["lead", "ลูกค้าที่ติดต่อ"], ["GA4", "Google Analytics"], ["GSC", "Google Search Console"], ["CI", "เครื่องมือวางแผนโรคร้ายแรง"], ["FHC", "เครื่องมือตรวจสุขภาพการเงิน"],
];
const hasUntranslatedEnglish = (value: string) => /[A-Za-z]/.test(value.replaceAll("LINE", "").replaceAll("Google", "").replaceAll("Ubersuggest", "").replaceAll("Reach", "").replaceAll("CPA/ROAS", ""));
const ownerWhy = (value: string) => {
  const translated = whyTerms.reduce((copy, [from, to]) => copy.replaceAll(from, to), value)
    .replaceAll("ตรวจ แหล่งที่มา", "ตรวจแหล่งที่มา").replaceAll("นิยาม เหตุการณ์", "นิยามเหตุการณ์")
    .replaceAll("ไม่ใช่ ลูกค้า", "ไม่ใช่ลูกค้า").replaceAll("ตรวจ กิจกรรม", "ตรวจกิจกรรม")
    .replaceAll("กับ ระบบ", "กับระบบ").replaceAll("ของ ตัวเลข", "ของตัวเลข")
    .replaceAll("หนึ่ง โพสต์", "หนึ่งโพสต์").replaceAll("ไม่ใช่ ข้อมูล", "ไม่ใช่ข้อมูล")
    .replaceAll("เข้า การประเมิน", "เข้าการประเมิน");
  return hasUntranslatedEnglish(translated) ? "มีคำอธิบายจากต้นทางที่ยังไม่ได้แปล กรุณาเปิดข้อความต้นฉบับสำหรับทีมดูแลก่อนใช้ข้อเสนอนี้" : translated;
};
const ownerMetric = (name: string) => {
  const label = ({ CPC: "ต้นทุนต่อคลิกโดยประมาณ", "Difficulty Ubersuggest (0–100)": "ความยากของคำค้น (0–100)", "การแสดงผล GSC": "จำนวนครั้งที่แสดงบน Google", "คลิก GSC": "คลิกจาก Google", "อันดับเฉลี่ย GSC": "อันดับเฉลี่ยบน Google", "ปฏิกิริยา / Like": "การกดถูกใจและปฏิกิริยา", "จำนวน event ในแถวที่เก็บ": "จำนวนครั้งที่เกิดกิจกรรมในแถวที่เก็บ" })[name] ?? ownerAnalyticsOverviewLabel("", name);
  return hasUntranslatedEnglish(label) ? "ตัวเลขที่ยังไม่มีชื่อภาษาไทย กรุณาดูชื่อเดิมในที่มา" : label;
};
const ownerLabel = (value: string) => value.replaceAll("Social", "โพสต์โซเชียล").replaceAll("Key event", "เหตุการณ์สำคัญ").replaceAll("SEO", "ค้นหา Google").replaceAll("CI / FHC / LINE", "เครื่องมือวางแผนและ LINE");
const ownerLimitation = ownerWhy;

function AssessmentResult({ job }: { job: AssessmentJob }) {
  const output = job.output;
  return <div className="mt-4 min-w-0 rounded-xl border border-white/15 bg-black/10 p-4">
    <p className="text-sm font-medium text-[#e0c985]">{review(job)}</p>
    <p className="mt-2 text-xs leading-5 text-white/65">{statuses[job.status] ?? "กำลังตรวจสถานะงาน"} · เริ่มเมื่อ <time dateTime={job.createdAt}>{date(job.createdAt)}</time> (เวลาไทย){job.completedAt ? <> · เสร็จเมื่อ <time dateTime={job.completedAt}>{date(job.completedAt)}</time> (เวลาไทย)</> : null}</p>
    <p className="mt-1 break-words text-xs leading-5 text-white/60">วิเคราะห์ ณ {output ? output.assessmentDate : "ยังไม่ระบุวันที่"} · {statuses[job.status] ?? "กำลังตรวจสถานะงาน"}</p>
    {output && job.reviewStatus !== "rejected" ? <>
      {output.coverage ? <div className="mt-4 rounded-lg border border-white/10 p-3"><h3 className="text-sm font-medium">ข้อมูลที่โมเดลได้รับ</h3><p className="mt-1 text-xs leading-5 text-white/65">กระจายงานจากแต่ละกลุ่มก่อนจำกัดขนาด ข้อเสนอที่เตรียมไม่ใช่ข้อมูลทั้งหมด รายการที่ไม่ได้ส่งยังเปิดดูในรายงานต้นทางได้</p><ul className="mt-2 space-y-1 text-xs leading-5 text-white/75">{output.coverage.filter(item => item.prepared > 0).map(item => <li key={item.action}>{groups[item.action]} · เตรียม {item.prepared.toLocaleString("th-TH")} · ส่งให้โมเดล {item.sent} · ไม่ได้ส่ง {item.dropped.toLocaleString("th-TH")}</li>)}</ul></div> : null}
      <ol className="mt-4 list-decimal space-y-5 pl-5">{output.findings.slice(0, 5).map(finding => <li key={finding.id} className="min-w-0 pl-1">
        <p className="mb-1 text-xs text-[#e0c985]">{groups[finding.action]}</p>
        <h3 className="break-words font-medium">{ownerLabel(finding.label)}</h3>
        <p className="mt-1 break-words text-sm leading-6 text-white/75">{ownerWhy(finding.why)}</p>
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{finding.metrics.map((metric, index) => <div key={`${metric.name}-${index}`} className="min-w-0 text-xs"><dt className="break-words text-white/60">{ownerMetric(metric.name)}</dt><dd className="mt-1 font-medium">{metric.value === null ? "ไม่มีข้อมูล" : metric.value.toLocaleString("th-TH", { maximumFractionDigits: 4 })}</dd></div>)}</dl>
        {finding.evidenceIds.length ? <ul className="mt-2 space-y-1 text-xs leading-5 text-white/60">{output.evidence.filter(item => finding.evidenceIds.includes(item.id)).map(item => <li key={item.id} className="break-words">{reportNames[item.report] ?? "รายงานที่ยังไม่มีชื่อภาษาไทย"} · ช่วง {item.windowStart ?? "ไม่ระบุ"} ถึง {item.windowEnd ?? "ไม่ระบุ"} · ต้นทาง ณ {item.sourceAsOf ?? "ต้นทางไม่ได้ระบุ"} · เขตเวลา {item.nativeTimeZone ?? "ต้นทางไม่ได้ระบุ"}{item.truncated ? " · ข้อมูลมีการจำกัดจำนวน" : ""}</li>)}</ul> : <p className="mt-2 text-xs leading-5 text-white/60">ชุดรายงานนี้ยังไม่มีหลักฐานผลธุรกิจสำหรับรายการนี้ ไม่ใช่ผลตรวจว่า ระบบต้นทางไม่ได้เชื่อมต่อ</p>}
      </li>)}</ol>
      {output.limitations.length ? <ul className="mt-4 space-y-1 border-t border-white/10 pt-3 text-xs leading-5 text-amber-100">{output.limitations.map((note, index) => <li key={index} className="break-words">{ownerLimitation(note)}</li>)}</ul> : null}
      <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-xs text-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]">ดูที่มาของรอบประเมิน</summary><p className="break-all text-xs leading-5 text-white/60">รหัสชุดข้อมูล: {output.snapshotHash}<br />รหัสงาน: {job.jobId} · รุ่นคำสั่ง AI: {output.promptVersion}</p><ul className="mt-2 space-y-2 text-xs leading-5 text-white/60">{output.findings.map(item => <li key={item.id} className="break-words">ข้อความข้อเสนอเดิม: {item.label}<br />คำอธิบายเดิม: {item.why}<br />ชื่อตัวเลขเดิม: {item.metrics.map(metric => metric.name).join(" · ") || "ไม่มี"}</li>)}{output.limitations.map((item, index) => <li key={`limitation-${index}`} className="break-words">ข้อจำกัดเดิม: {item}</li>)}{output.evidence.map(item => <li key={item.id} className="break-all">{item.report} · รอบนำเข้า {item.batchId}<br />รหัสตรวจสอบข้อมูล: {item.rawHash}</li>)}</ul></details>
    </> : null}
  </div>;
}

export function DailyAssessment({ assessment }: { assessment: DailyAssessmentView }) {
  const previous = assessment.lastGood && assessment.lastGood.jobId !== assessment.latest?.jobId ? assessment.lastGood : null;
  return <section className="mt-8 min-w-0 border-t border-white/15 pt-6" aria-labelledby="daily-assessment-heading">
    <h2 id="daily-assessment-heading" className="text-xl font-semibold">AI เสนองานตรวจจากข้อมูลที่มี</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">ระบบ AI จัดลำดับงานจากหลักฐานที่บันทึกไว้ ตัวเลขและช่วงวันมาจากรายงานเดิม การเปิดหน้านี้ไม่เรียกข้อมูลต้นทางใหม่ ข้อเสนอต้องผ่านเจ้าของตรวจทานก่อนนำไปใช้</p>
    <p className="mt-2 text-xs leading-5 text-white/60">รอบประเมินใช้ข้อมูลล่าสุดจากทุกแหล่งที่มี ไม่เปลี่ยนตามตัวกรองรายงานด้านบน และอาจใช้ข้อมูลคนละช่วงวัน</p>
    {assessment.state === "unavailable" ? <p className="mt-4 text-sm leading-6 text-amber-100">ยังอ่านสถานะการประเมินไม่ได้ รายงานและไฟล์ข้อมูลเดิมยังใช้งานได้</p> : null}
    {assessment.latest ? <AssessmentResult job={assessment.latest} /> : assessment.state === "ready" ? <p className="mt-4 text-sm leading-6 text-white/65">ยังไม่มีรอบประเมินที่บันทึกไว้ จึงยังไม่มีข้อเสนอจากโมเดล</p> : null}
    {previous ? <div className="mt-5"><h3 className="text-sm font-semibold">รอบก่อนหน้าที่ประเมินสำเร็จ</h3><p className="mt-1 text-xs leading-5 text-white/60">คงข้อเสนอเดิมไว้เมื่อรอบใหม่ยังไม่มีผลสำเร็จ อ่านวันที่และสถานะตรวจทานประกอบ</p><AssessmentResult job={previous} /></div> : null}
    <Link href="/operations/local-ai/" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 py-2 text-sm text-[#e0c985] hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e0c985]">ดูสถานะงานและตรวจทานข้อเสนอ</Link>
  </section>;
}
