import type { FaFinancialAnalysis } from "./calculations";
import { FA_BENCHMARKS, FA_BENCHMARK_PENDING, FA_EMERGENCY_FUND_SELF_EMPLOYED } from "./benchmarks";
import { formatBaht } from "./format";
import styles from "./FinancialPlanning.module.css";
import { FA_STATUS_CLASSES, FA_STATUS_LABELS, ratioNote } from "./presentation";

const COLORS = { liquid: "#6fd39b", invest: "#e0c985", personal: "#8fa8ff", in: "#6fd39b", out: "#f5b84a", deficit: "#ffb4a8" } as const;

function share(value: number, total: number) {
  return total > 0 ? `${Math.max(0, Math.min(100, (value / total) * 100))}%` : "0%";
}

export function FinancialSummaryPanel({ analysis, large }: { analysis: FaFinancialAnalysis; large: boolean }) {
  const { summary, ratios } = analysis;
  const maxFlow = Math.max(summary.monthlyIncome, summary.monthlyExpenseTotal, Math.abs(summary.monthlySurplus), 1);
  const flows = [
    { label: "เงินเข้า", value: summary.monthlyIncome, color: COLORS.in },
    { label: "เงินออก", value: summary.monthlyExpenseTotal, color: COLORS.out },
    {
      label: summary.monthlySurplus >= 0 ? "เหลือ" : "ขาด",
      value: summary.monthlySurplus,
      color: summary.monthlySurplus >= 0 ? COLORS.invest : COLORS.deficit,
    },
  ];
  const missingTotal = Object.values(summary.missing).reduce((sum, count) => sum + count, 0);

  return (
    <aside aria-label="สรุปสถานะการเงิน" className="flex flex-col gap-3">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <p className="text-sm text-white/65">ความมั่งคั่งสุทธิ</p>
        <p className={`mt-1 font-semibold tabular-nums ${summary.netWorth < 0 ? "text-rose-200" : ""}`} style={{ fontSize: large ? "3rem" : "2.25rem", lineHeight: 1.1 }}>
          {formatBaht(summary.netWorth)}
        </p>
        <p className="mt-1 text-xs text-white/55">
          สินทรัพย์ {formatBaht(summary.assetsTotal)} − หนี้สิน {formatBaht(summary.liabilitiesTotal)} บาท
        </p>
        <div aria-hidden="true" className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full" style={{ width: share(summary.assetsLiquid, summary.assetsTotal), backgroundColor: COLORS.liquid }} />
          <span className="block h-full" style={{ width: share(summary.assetsInvest, summary.assetsTotal), backgroundColor: COLORS.invest }} />
          <span className="block h-full" style={{ width: share(summary.assetsPersonal, summary.assetsTotal), backgroundColor: COLORS.personal }} />
        </div>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/65">
          <div className="flex gap-1"><dt>สภาพคล่อง</dt><dd className="tabular-nums">{formatBaht(summary.assetsLiquid)}</dd></div>
          <div className="flex gap-1"><dt>ลงทุน</dt><dd className="tabular-nums">{formatBaht(summary.assetsInvest)}</dd></div>
          <div className="flex gap-1"><dt>ใช้ส่วนตัว</dt><dd className="tabular-nums">{formatBaht(summary.assetsPersonal)}</dd></div>
        </dl>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <p className="text-sm text-white/65">เงินเข้า–ออกต่อเดือน (บาท)</p>
        <div className="mt-3 flex flex-col gap-2">
          {flows.map((flow) => (
            <div key={flow.label} className={`${styles.flowRow} text-sm`}>
              <span className="text-white/70">{flow.label}</span>
              <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (Math.abs(flow.value) / maxFlow) * 100)}%`, backgroundColor: flow.color }} />
              </span>
              <span className="text-right tabular-nums">{formatBaht(flow.value)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-white/50">เงินออกรวมค่างวดหนี้ {formatBaht(summary.monthlyDebtPayments)} บาทจากตารางหนี้สินแล้ว</p>
      </section>

      <section aria-label="อัตราส่วนการเงิน" className="grid gap-2 sm:grid-cols-2">
        {ratios.map((ratio) => (
          <article key={ratio.id} className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <span className="text-xs text-white/65">{ratio.label}</span>
            <span className={`${large ? "text-3xl" : "text-2xl"} font-semibold tabular-nums`}>{ratio.display}</span>
            <span className={`w-fit rounded-full border px-2 py-0.5 text-xs ${FA_STATUS_CLASSES[ratio.status]}`}>{FA_STATUS_LABELS[ratio.status]}</span>
            <span className="text-xs text-white/50">{ratioNote(ratio)}</span>
          </article>
        ))}
      </section>

      {missingTotal > 0 ? (
        <p role="status" className="rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] p-3 text-xs leading-5 text-amber-50/80">
          ยังมี {missingTotal.toLocaleString("th-TH")} ช่องที่ยังไม่ได้กรอกตัวเลข ระบบไม่นับช่องว่างเป็นศูนย์ ตัวเลขด้านบนจึงอาจเปลี่ยนเมื่อกรอกครบ
        </p>
      ) : null}

      <p className="rounded-2xl border border-white/10 bg-black/15 p-3 text-xs leading-5 text-white/65">{analysis.disclaimer}</p>

      <details className="rounded-2xl border border-white/10 bg-black/15 p-3 text-xs leading-5 text-white/60">
        <summary className="min-h-11 cursor-pointer py-3 text-white/75">เกณฑ์ที่ใช้และที่มา ({FA_BENCHMARK_PENDING})</summary>
        <ul className="mt-2 flex flex-col gap-2">
          {Object.values(FA_BENCHMARKS).map((benchmark) => (
            <li key={benchmark.id}>
              <span className="text-white/80">{benchmark.label}</span> · {benchmark.formula} · {benchmark.confirmation}
              {benchmark.sources.map((source) => (
                <span key={source.url} className="block">
                  <a href={source.url} target="_blank" rel="noreferrer noopener" className="underline decoration-white/30 hover:text-white">{source.publisher}</a>: “{source.quote}”
                </span>
              ))}
            </li>
          ))}
          <li>{FA_EMERGENCY_FUND_SELF_EMPLOYED.note} · {FA_EMERGENCY_FUND_SELF_EMPLOYED.confirmation}</li>
        </ul>
      </details>
    </aside>
  );
}
