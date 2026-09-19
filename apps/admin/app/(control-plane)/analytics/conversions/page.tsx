import type { Metadata } from "next";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { readConversionAnalytics } from "@/lib/admin/line/business-intelligence";
import { lineJourneyLabel } from "@/lib/admin/line/presentation";

export const metadata: Metadata = { title: "เส้นทางลูกค้าและผลลัพธ์" };

function pct(numerator: number, denominator: number) {
  if (!denominator) return "—";
  return new Intl.NumberFormat("th-TH", { style: "percent", maximumFractionDigits: 1 }).format(numerator / denominator);
}

function money(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toLocaleString("th-TH")}`;
  }
}

export default async function ConversionAnalyticsPage() {
  await requireAdminPermission("dashboard:read");
  const model = await readConversionAnalytics();

  if (model.state !== "ready" || !model.summary) {
    return (
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ผลลัพธ์</p>
        <h1 className="mt-2 text-3xl font-semibold">เส้นทางลูกค้าและผลลัพธ์</h1>
        <section className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm text-amber-50">
          ระบบสรุปผลจากข้อมูลส่วนตัวยังไม่พร้อม และจะไม่ข้ามขั้นตอนความปลอดภัยไปอ่านตารางข้อมูลลูกค้าโดยตรง
        </section>
      </div>
    );
  }

  const s = model.summary;
  const cards = [
    ["ไปคุยต่อใน LINE", s.line_continue_count],
    ["ผู้สนใจ", s.lead_count],
    ["ได้รับข้อมูลประกอบ", s.material_received_count],
    ["การคุยที่พร้อมให้คำแนะนำ", s.qualified_count],
    ["วางแนวทางหรือเสนอราคา", s.solution_quote_count],
    ["เริ่มดำเนินการ", s.implementation_started_count],
    ["ดำเนินการเสร็จ", s.implementation_complete_count],
    ["สำเร็จ", s.won_count],
    ["ไม่ดำเนินการต่อ", s.lost_count],
    ["รายการรายได้", s.revenue_record_count],
  ] as const;

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ผลลัพธ์ธุรกิจ · ข้อมูลส่วนตัว</p>
      <h1 className="mt-2 text-3xl font-semibold">เส้นทางลูกค้าและผลลัพธ์</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
        ใช้ “การคุยที่พร้อมให้คำแนะนำ” เป็นตัวชี้วัดหลัก หน้านี้แสดงเฉพาะยอดรวมและข้อมูลที่ลดความละเอียดแล้ว ไม่ส่งตัวตน ข้อความ ข้อมูลสุขภาพ การเงิน หรือยอดรายได้ของลูกค้าไปยังระบบวิเคราะห์ทั่วไป
      </p>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs text-white/45">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white/90">{value.toLocaleString("th-TH")}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-xs text-white/45">ผู้สนใจ → พร้อมให้คำแนะนำ</p>
          <p className="mt-2 text-2xl font-semibold">{pct(s.qualified_count, s.lead_count)}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-xs text-white/45">พร้อมให้คำแนะนำ → ดำเนินการเสร็จ</p>
          <p className="mt-2 text-2xl font-semibold">{pct(s.implementation_complete_count, s.qualified_count)}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-xs text-white/45">ดำเนินการเสร็จ → สำเร็จ</p>
          <p className="mt-2 text-2xl font-semibold">{pct(s.won_count, s.implementation_complete_count)}</p>
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <h2 className="text-lg font-semibold">รายได้ที่เชื่อมโยงได้</h2>
        <p className="mt-1 text-xs leading-5 text-white/50">ยอดรายได้อยู่ในศูนย์จัดการส่วนตัวเท่านั้น และแยกตามสกุลเงินเพื่อไม่รวมยอดที่มีความหมายต่างกัน</p>
        {model.revenue.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {model.revenue.map((row) => (
              <article key={row.currency} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-xs text-white/45">{row.currency}</p>
                <p className="mt-2 text-xl font-semibold">{money(row.revenueMinor, row.currency)}</p>
                <p className="mt-1 text-xs text-white/45">{row.revenueRecordCount.toLocaleString("th-TH")} รายการ</p>
              </article>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-white/45">ยังไม่มีรายได้ที่เชื่อมโยงได้</p>}
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <div>
          <h2 className="text-lg font-semibold">ผลลัพธ์ตามเนื้อหาและเส้นทางลูกค้า</h2>
          <p className="mt-1 text-xs leading-5 text-white/50">แสดงเฉพาะยอดรวมและรหัสที่ปลอดภัย ไม่มีรายบุคคล บทสนทนา หรือรหัสลูกค้า</p>
        </div>
        {model.content.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs text-white/45">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-3 font-medium">ที่มา / เรื่องที่คุย</th>
                  <th className="px-3 py-3 font-medium">เนื้อหา / แคมเปญ / เครื่องมือ</th>
                  <th className="px-3 py-3 font-medium">เริ่มต้น</th>
                  <th className="px-3 py-3 font-medium">ผู้สนใจ</th>
                  <th className="px-3 py-3 font-medium">ได้รับข้อมูล</th>
                  <th className="px-3 py-3 font-medium">พร้อมแนะนำ</th>
                  <th className="px-3 py-3 font-medium">อัตราพร้อมแนะนำ</th>
                  <th className="px-3 py-3 font-medium">หยุดระหว่างทาง</th>
                  <th className="px-3 py-3 font-medium">ดำเนินการเสร็จ</th>
                  <th className="px-3 py-3 font-medium">สำเร็จ / ไม่ต่อ</th>
                  <th className="px-3 py-3 font-medium">รายการรายได้</th>
                </tr>
              </thead>
              <tbody>
                {model.content.map((row, index) => (
                  <tr key={`${row.origin}:${row.journey}:${row.contentId ?? ""}:${row.campaignId ?? ""}:${row.toolId ?? ""}:${index}`} className="border-b border-white/5 text-white/70">
                    <td className="px-3 py-3"><strong className="text-white/85">{row.origin}</strong><br />{lineJourneyLabel(row.journey)}</td>
                    <td className="px-3 py-3 text-xs leading-5">{row.contentId ?? "—"}<br />{row.campaignId ?? "—"}<br />{row.toolId ?? "—"}</td>
                    <td className="px-3 py-3">{row.journeyStartCount}</td>
                    <td className="px-3 py-3">{row.leadCount}</td>
                    <td className="px-3 py-3">{row.materialReceivedCount}</td>
                    <td className="px-3 py-3">{row.qualifiedCount}</td>
                    <td className="px-3 py-3">{row.qualificationRate == null ? "—" : new Intl.NumberFormat("th-TH", { style: "percent", maximumFractionDigits: 1 }).format(row.qualificationRate)}</td>
                    <td className="px-3 py-3">{row.dropOffCount}</td>
                    <td className="px-3 py-3">{row.implementationCompleteCount}</td>
                    <td className="px-3 py-3">{row.wonCount} / {row.lostCount}</td>
                    <td className="px-3 py-3">{row.revenueRecordCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-4 text-sm text-white/45">ยังไม่มีข้อมูลเส้นทางลูกค้าแบบยอดรวม</p>}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <h2 className="text-lg font-semibold">รายได้ตามเนื้อหาและสกุลเงิน</h2>
          <p className="mt-1 text-xs leading-5 text-white/50">
            แยกตามสกุลเงิน และซ่อนยอดของกลุ่มที่มีข้อมูลน้อยกว่า 3 รายการ เพื่อลดโอกาสย้อนกลับไปหาเคสรายบุคคล
          </p>
          {model.contentRevenue.length ? (
            <div className="mt-4 space-y-2">
              {model.contentRevenue.slice(0, 12).map((row, index) => (
                <div key={`${row.origin}:${row.journey}:${row.contentId ?? ""}:${row.currency}:${index}`} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white/85">{row.origin} · {lineJourneyLabel(row.journey)}</p>
                    <p className="text-xs text-white/45">{row.currency} · {row.revenueRecordCount} รายการ</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/55">{row.contentId ?? "—"} / {row.campaignId ?? "—"} / {row.toolId ?? "—"}</p>
                  <p className="mt-2 text-base font-semibold">
                    {row.revenueSuppressed || row.revenueMinor == null ? "ซ่อนยอดเพราะมีข้อมูลน้อยกว่า 3 รายการ" : money(row.revenueMinor, row.currency)}
                  </p>
                </div>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-white/45">ยังไม่มีรายได้ที่เชื่อมโยงกับเนื้อหา</p>}
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <h2 className="text-lg font-semibold">คำถามที่ลูกค้าถามบ่อย</h2>
          <p className="mt-1 text-xs leading-5 text-white/50">
            นับจากหัวข้อคำถามที่กำหนดและผลลัพธ์ที่ปลอดภัยเท่านั้น ไม่มีข้อความอิสระ บทสนทนา หรือตัวตนลูกค้า
          </p>
          {model.questionFrequency.length ? (
            <div className="mt-4 space-y-2">
              {model.questionFrequency.slice(0, 12).map((row, index) => (
                <div key={`${row.questionId}:${row.journey}:${row.outcome}:${row.reason ?? ""}:${index}`} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white/85">{row.questionId}</p>
                    <p className="text-sm font-semibold">{row.requestCount.toLocaleString("th-TH")}</p>
                  </div>
                  <p className="mt-1 text-xs text-white/50">{row.journey} · {row.outcome}{row.reason ? ` · ${row.reason}` : ""}</p>
                </div>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-white/45">ยังไม่มีข้อมูลความถี่ของคำถาม</p>}
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <h2 className="text-lg font-semibold">หัวข้อเนื้อหาที่ยังขาด</h2>
        <p className="mt-1 text-xs leading-5 text-white/50">
          ใช้เฉพาะสัญญาณว่า “ยังไม่มีคำตอบที่อนุมัติ” หรือ “แหล่งข้อมูลไม่พร้อม” เพื่อเสนอหัวข้อที่ควรเติม โดยไม่ให้ AI อ่านบทสนทนาต้นฉบับ
        </p>
        {model.contentGapInputs.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {model.contentGapInputs.map((row) => (
              <article key={`${row.questionId}:${row.journey}`} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-sm font-semibold text-white/85">{row.questionId}</p>
                <p className="mt-1 text-xs text-white/45">{row.journey}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-semibold">{row.totalGapSignalCount}</p><p className="text-[11px] text-white/40">ทั้งหมด</p></div>
                  <div><p className="text-lg font-semibold">{row.noApprovedAnswerCount}</p><p className="text-[11px] text-white/40">ยังไม่มีคำตอบ</p></div>
                  <div><p className="text-lg font-semibold">{row.sourceUnavailableCount}</p><p className="text-[11px] text-white/40">แหล่งข้อมูลไม่พร้อม</p></div>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-white/45">ยังไม่พบหัวข้อที่ขาดจากคำถามที่ผ่านการตรวจแล้ว</p>}
      </section>
    </div>
  );
}
