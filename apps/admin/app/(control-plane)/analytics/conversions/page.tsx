import type { Metadata } from "next";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { readConversionAnalytics } from "@/lib/admin/line/business-intelligence";

export const metadata: Metadata = { title: "Conversions & Attribution" };

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
        <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ANALYTICS</p>
        <h1 className="mt-2 text-3xl font-semibold">Conversions & Attribution</h1>
        <section className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm text-amber-50">
          Private conversion runtime ยังไม่พร้อม ระบบไม่ fallback ไปอ่าน private tables โดยตรง
        </section>
      </div>
    );
  }

  const s = model.summary;
  const cards = [
    ["LINE continue", s.line_continue_count],
    ["Leads", s.lead_count],
    ["Material received", s.material_received_count],
    ["Qualified conversations", s.qualified_count],
    ["Solution / Quote", s.solution_quote_count],
    ["Implementation started", s.implementation_started_count],
    ["Implementation complete", s.implementation_complete_count],
    ["Won", s.won_count],
    ["Lost", s.lost_count],
    ["Revenue records", s.revenue_record_count],
  ] as const;

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">PRIVATE BUSINESS ANALYTICS</p>
      <h1 className="mt-2 text-3xl font-semibold">Conversions & Attribution</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
        Qualified Conversations เป็น North Star ของ funnel นี้ ข้อมูลหน้านี้มาจาก aggregate/private projections เท่านั้น ไม่ส่ง customer identity, message, health/financial inputs หรือ revenue amount ไป generic analytics
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
          <p className="text-xs text-white/45">Lead → Qualified</p>
          <p className="mt-2 text-2xl font-semibold">{pct(s.qualified_count, s.lead_count)}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-xs text-white/45">Qualified → Implementation complete</p>
          <p className="mt-2 text-2xl font-semibold">{pct(s.implementation_complete_count, s.qualified_count)}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-xs text-white/45">Implementation complete → Won</p>
          <p className="mt-2 text-2xl font-semibold">{pct(s.won_count, s.implementation_complete_count)}</p>
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <h2 className="text-lg font-semibold">Attributed revenue</h2>
        <p className="mt-1 text-xs leading-5 text-white/50">Revenue อยู่ใน private Admin เท่านั้น และแยกตาม currency เพื่อไม่รวมสกุลเงินเข้าด้วยกันโดยผิดความหมาย</p>
        {model.revenue.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {model.revenue.map((row) => (
              <article key={row.currency} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-xs text-white/45">{row.currency}</p>
                <p className="mt-2 text-xl font-semibold">{money(row.revenueMinor, row.currency)}</p>
                <p className="mt-1 text-xs text-white/45">{row.revenueRecordCount.toLocaleString("th-TH")} records</p>
              </article>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-white/45">ยังไม่มี revenue attribution</p>}
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <div>
          <h2 className="text-lg font-semibold">Content / Journey Intelligence</h2>
          <p className="mt-1 text-xs leading-5 text-white/50">Aggregate safe IDs only — ไม่มีรายบุคคล ไม่มี transcript และไม่มี customer code</p>
        </div>
        {model.content.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs text-white/45">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-3 font-medium">Origin / Journey</th>
                  <th className="px-3 py-3 font-medium">Content / Campaign / Tool</th>
                  <th className="px-3 py-3 font-medium">Starts</th>
                  <th className="px-3 py-3 font-medium">Leads</th>
                  <th className="px-3 py-3 font-medium">Material</th>
                  <th className="px-3 py-3 font-medium">Qualified</th>
                  <th className="px-3 py-3 font-medium">Qual. rate</th>
                  <th className="px-3 py-3 font-medium">Drop-off</th>
                  <th className="px-3 py-3 font-medium">Impl. complete</th>
                  <th className="px-3 py-3 font-medium">Won / Lost</th>
                  <th className="px-3 py-3 font-medium">Revenue records</th>
                </tr>
              </thead>
              <tbody>
                {model.content.map((row, index) => (
                  <tr key={`${row.origin}:${row.journey}:${row.contentId ?? ""}:${row.campaignId ?? ""}:${row.toolId ?? ""}:${index}`} className="border-b border-white/5 text-white/70">
                    <td className="px-3 py-3"><strong className="text-white/85">{row.origin}</strong><br />{row.journey}</td>
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
        ) : <p className="mt-4 text-sm text-white/45">ยังไม่มี aggregate conversion lineage</p>}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <h2 className="text-lg font-semibold">Content revenue by currency</h2>
          <p className="mt-1 text-xs leading-5 text-white/50">
            แยกตาม currency และซ่อนยอดของกลุ่มที่มี revenue records น้อยกว่า 3 เพื่อไม่ให้ aggregate เล็กเกินไปจนย้อนกลับไปหาเคสรายบุคคลได้ง่าย
          </p>
          {model.contentRevenue.length ? (
            <div className="mt-4 space-y-2">
              {model.contentRevenue.slice(0, 12).map((row, index) => (
                <div key={`${row.origin}:${row.journey}:${row.contentId ?? ""}:${row.currency}:${index}`} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white/85">{row.origin} · {row.journey}</p>
                    <p className="text-xs text-white/45">{row.currency} · {row.revenueRecordCount} records</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/55">{row.contentId ?? "—"} / {row.campaignId ?? "—"} / {row.toolId ?? "—"}</p>
                  <p className="mt-2 text-base font-semibold">
                    {row.revenueSuppressed || row.revenueMinor == null ? "ยอดถูก suppress (<3 records)" : money(row.revenueMinor, row.currency)}
                  </p>
                </div>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-white/45">ยังไม่มี content-level revenue attribution</p>}
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <h2 className="text-lg font-semibold">Approved question frequency</h2>
          <p className="mt-1 text-xs leading-5 text-white/50">
            นับจาก predefined question ID + safe outcome เท่านั้น ไม่มีคำถาม free-text, transcript หรือ customer identity
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
          ) : <p className="mt-4 text-sm text-white/45">ยังไม่มี Safe Knowledge frequency</p>}
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <h2 className="text-lg font-semibold">Content gap signals</h2>
        <p className="mt-1 text-xs leading-5 text-white/50">
          deterministic signal จาก no_approved_answer / source_unavailable เท่านั้น เป็น input ให้ Content Intelligence ไม่ใช่การให้ AI อ่าน raw conversation
        </p>
        {model.contentGapInputs.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {model.contentGapInputs.map((row) => (
              <article key={`${row.questionId}:${row.journey}`} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-sm font-semibold text-white/85">{row.questionId}</p>
                <p className="mt-1 text-xs text-white/45">{row.journey}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-semibold">{row.totalGapSignalCount}</p><p className="text-[11px] text-white/40">signals</p></div>
                  <div><p className="text-lg font-semibold">{row.noApprovedAnswerCount}</p><p className="text-[11px] text-white/40">no answer</p></div>
                  <div><p className="text-lg font-semibold">{row.sourceUnavailableCount}</p><p className="text-[11px] text-white/40">source down</p></div>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-white/45">ยังไม่มี content-gap signal จาก approved question workflow</p>}
      </section>
    </div>
  );
}
