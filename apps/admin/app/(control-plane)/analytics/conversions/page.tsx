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
                  <th className="px-3 py-3 font-medium">Leads</th>
                  <th className="px-3 py-3 font-medium">Material</th>
                  <th className="px-3 py-3 font-medium">Qualified</th>
                  <th className="px-3 py-3 font-medium">Impl. complete</th>
                  <th className="px-3 py-3 font-medium">Won</th>
                  <th className="px-3 py-3 font-medium">Revenue records</th>
                </tr>
              </thead>
              <tbody>
                {model.content.map((row, index) => (
                  <tr key={`${row.origin}:${row.journey}:${row.contentId ?? ""}:${row.campaignId ?? ""}:${row.toolId ?? ""}:${index}`} className="border-b border-white/5 text-white/70">
                    <td className="px-3 py-3"><strong className="text-white/85">{row.origin}</strong><br />{row.journey}</td>
                    <td className="px-3 py-3 text-xs leading-5">{row.contentId ?? "—"}<br />{row.campaignId ?? "—"}<br />{row.toolId ?? "—"}</td>
                    <td className="px-3 py-3">{row.leadCount}</td>
                    <td className="px-3 py-3">{row.materialReceivedCount}</td>
                    <td className="px-3 py-3">{row.qualifiedCount}</td>
                    <td className="px-3 py-3">{row.implementationCompleteCount}</td>
                    <td className="px-3 py-3">{row.wonCount}</td>
                    <td className="px-3 py-3">{row.revenueRecordCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-4 text-sm text-white/45">ยังไม่มี aggregate conversion lineage</p>}
      </section>
    </div>
  );
}
