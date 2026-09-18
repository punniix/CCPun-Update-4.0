import type { Metadata } from "next";
import Link from "next/link";
import {
  LINE_ADVISOR_INBOX_STAGES,
  listAdvisorInboxSafe,
  type LineAdvisorInboxSafeItem,
} from "@/lib/admin/line/control-plane";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { listAdvisorInboxOperational, type AdvisorInboxFilters } from "@/lib/admin/line/advisor-workflow";

export const metadata: Metadata = { title: "Advisor Inbox" };

function formatBangkokDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function customerLabel(item: Pick<LineAdvisorInboxSafeItem, "customerCode">) {
  return `Customer ${item.customerCode.slice(-8)}`;
}

function priorityLabel(priority: LineAdvisorInboxSafeItem["priority"]) {
  switch (priority) {
    case "urgent": return "Urgent";
    case "high": return "High";
    case "low": return "Low";
    default: return "Normal";
  }
}

export default async function AdvisorInboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPermission("advisor:read");
  const params = await searchParams;
  const one = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const filters: AdvisorInboxFilters = {};
  const stage = one("stage"); if (LINE_ADVISOR_INBOX_STAGES.includes(stage as (typeof LINE_ADVISOR_INBOX_STAGES)[number])) filters.stage = stage as AdvisorInboxFilters["stage"];
  const priority = one("priority"); if (["low","normal","high","urgent"].includes(priority)) filters.priority = priority as AdvisorInboxFilters["priority"];
  const caseState = one("caseState"); if (["active","waiting","completed"].includes(caseState)) filters.caseState = caseState as AdvisorInboxFilters["caseState"];
  for (const [key, target] of [["journey","journey"],["tag","tag"],["q","q"]] as const) { const value=one(key).trim().toLowerCase(); if (/^[a-z0-9][a-z0-9_.:-]{0,79}$/.test(value)) filters[target]=value as never; }
  const filtersActive = Object.keys(filters).length > 0;
  const model = await listAdvisorInboxSafe();
  let filteredRows: Awaited<ReturnType<typeof listAdvisorInboxOperational>> | null = null;
  let filterUnavailable = false;
  if (filtersActive && !model.unavailableReason) {
    try { filteredRows = await listAdvisorInboxOperational(filters); } catch { filterUnavailable = true; }
  }
  const displayRows = filteredRows ?? model.rows;

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">LINE OA · HUMAN ADVISORY</p>
          <h1 className="mt-2 text-3xl font-semibold">Advisor Inbox</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            Advisor Inbox ใช้ safe operational context เป็นค่าเริ่มต้น ส่วน transcript และ reply จะเปิดได้เฉพาะ owner runtime ที่ผ่าน encryption/provider feature gate เท่านั้น
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/reviews/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white">
            SEO Reviews
          </Link>
          <Link href="/operations/health/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white">
            System Health
          </Link>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-sky-200/15 bg-sky-200/[0.05] p-4 text-sm leading-6 text-sky-100/85" aria-label="Private LINE boundary">
        <strong className="font-medium text-sky-100">Private-by-default:</strong> safe context เปิดตลอดเมื่อ runtime พร้อม ส่วน transcript/outbound จะ fail-closed จน owner เปิด feature gate และใส่ key/token ใน Vercel โดยตรง
      </section>

      <form method="get" className="mt-6 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-2 lg:grid-cols-6" aria-label="Safe operational filters">
        <select name="stage" defaultValue={one("stage")} className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-sm text-white"><option value="">ทุก stage</option>{LINE_ADVISOR_INBOX_STAGES.map((value)=><option key={value} value={value}>{value}</option>)}</select>
        <select name="priority" defaultValue={one("priority")} className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-sm text-white"><option value="">ทุก priority</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>
        <select name="caseState" defaultValue={one("caseState")} className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-sm text-white"><option value="">ทุก state</option><option value="active">Active</option><option value="waiting">Waiting</option><option value="completed">Completed</option></select>
        <input name="journey" defaultValue={one("journey")} placeholder="journey" pattern="[a-z0-9][a-z0-9_-]{0,79}" className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-sm text-white" />
        <input name="q" defaultValue={one("q")} placeholder="source/content/tool ID" pattern="[a-z0-9][a-z0-9_.:-]{0,79}" className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-sm text-white" />
        <button className="min-h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm text-white/75">Filter</button>
        <p className="sm:col-span-2 lg:col-span-6 text-xs leading-5 text-white/40">ค้นเฉพาะ safe operational references เท่านั้น ไม่มี raw transcript/name/phone/email search</p>
      </form>

      {filterUnavailable ? <p role="alert" className="mt-3 text-sm text-amber-200/80">Filter runtime ไม่พร้อม จึงแสดงรายการทั้งหมดแทน</p> : null}

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Advisor Inbox summary">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm text-white/60">Open cases</p>
          <p className="mt-2 text-2xl font-semibold">{model.unavailableReason ? "—" : model.aggregate.openCases}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm text-white/60">Needs human</p>
          <p className="mt-2 text-2xl font-semibold">{model.unavailableReason ? "—" : model.aggregate.needsHuman}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm text-white/60">Material received</p>
          <p className="mt-2 text-2xl font-semibold">{model.unavailableReason ? "—" : model.aggregate.materialReceived}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm text-white/60">Private safe view</p>
          <p className={`mt-2 text-lg font-semibold ${model.status.viewReady ? "text-emerald-200" : "text-amber-200"}`}>
            {model.status.viewReady ? "Ready" : "Not ready"}
          </p>
          <p className="mt-1 text-xs leading-5 text-white/50">raw customer data hidden · transcript/outbound feature-gated</p>
        </article>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8" aria-label="จำนวนเคสตาม stage">
        {LINE_ADVISOR_INBOX_STAGES.map((stage) => (
          <article key={stage} className="rounded-2xl border border-white/10 bg-black/10 p-3">
            <p className="text-xs leading-5 text-white/55">{stage}</p>
            <p className="mt-1 text-lg font-semibold text-white/85">{model.unavailableReason ? "—" : model.aggregate.stageCounts[stage]}</p>
          </article>
        ))}
      </section>

      {model.unavailableReason ? (
        <section role="alert" className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm leading-6 text-amber-50">
          <h2 className="font-semibold">Advisor Inbox ยังอ่าน private safe view ไม่ได้</h2>
          <p className="mt-2 text-amber-50/80">
            ระบบ fail-closed และไม่ตีความว่าเป็น 0 เคส รวมถึงไม่ fallback ไปอ่านตาราง raw หาก Admin runtime, Neon identity หรือ safe view ไม่พร้อม
          </p>
          <p className="mt-2 text-xs text-amber-50/65">สถานะ: {model.unavailableReason}</p>
        </section>
      ) : null}

      {!model.unavailableReason && displayRows.length === 0 ? (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-7 text-center">
          <h2 className="text-lg font-semibold">ยังไม่มีเคสใน Advisor Inbox</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/65">
            เมื่อ LINE conversation ถูกส่งต่อให้มนุษย์ ระบบจะแสดงเฉพาะ safe operational context ที่นี่ โดยไม่เปิดข้อความจริงหรือ external identity
          </p>
        </section>
      ) : null}

      {!model.unavailableReason && displayRows.length > 0 ? (
        <section className="mt-6 space-y-4" aria-label="Advisor cases">
          {filtersActive ? <p className="text-xs text-white/45">Filtered results: {displayRows.length}</p> : null}
          {displayRows.map((item) => (
            <article key={item.leadId} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-[#e0c985]/20 bg-[#e0c985]/10 px-2.5 py-1 text-[#f4df9b]">{item.stage}</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white/70">{item.journey}</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white/70">{item.conversationStatus}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-white/90">
                    <Link href={`/dashboard/inbox/${item.leadId}/`} className="hover:text-white hover:underline hover:underline-offset-4">
                      {customerLabel(item)}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-white/55">Lead {item.leadId.slice(0, 8)} · Case {item.advisorCaseId?.slice(0, 8) ?? "—"}</p>
                </div>
                <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm leading-6 text-white/60 md:block md:text-right">
                  <div><dt className="sr-only">กิจกรรมล่าสุด</dt><dd>{formatBangkokDate(item.lastActivityAt)}</dd></div>
                  <div><dt className="inline">Unread: </dt><dd className="inline">{item.unreadCount}</dd></div>
                  <div><dt className="inline">Priority: </dt><dd className="inline">{priorityLabel(item.priority)}</dd></div>
                </dl>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-black/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-white/45">Material</p>
                  <p className="mt-2 text-sm text-white/75">{item.materialReceived ? "ได้รับ material แล้ว" : "ยังไม่มี material"}</p>
                </div>
                <div className="rounded-2xl bg-black/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-white/45">Latest signal</p>
                  <p className="mt-2 text-sm text-white/75">{item.latestMessageType ?? "—"} · {item.latestMessageStatus ?? "—"}</p>
                  <p className="mt-1 text-xs text-white/50">Needs human: {item.latestMessageNeedsHuman == null ? "—" : item.latestMessageNeedsHuman ? "Yes" : "No"}</p>
                </div>
                <div className="rounded-2xl border border-[#e0c985]/15 bg-[#e0c985]/[0.05] p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#e0c985]">Owner context</p>
                  <p className="mt-2 text-sm text-white/75">Advisor: {item.assignedAdvisor ?? "ยังไม่ assign"}</p>
                  <p className="mt-1 text-xs leading-5 text-white/50">เปิดเคสเพื่อดู timeline, stage history และ action ที่ผ่าน private gate</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
