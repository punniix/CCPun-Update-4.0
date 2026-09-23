import type { Metadata } from "next";
import Link from "next/link";
import {
  LINE_ADVISOR_INBOX_STAGES,
  listAdvisorInboxSafe,
  type LineAdvisorInboxSafeItem,
} from "@/lib/admin/line/control-plane";
import {
  lineConversationStatusLabel,
  lineJourneyLabel,
  lineMessageStatusLabel,
  lineMessageTypeLabel,
  lineStageLabel,
} from "@/lib/admin/line/presentation";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getLinePrivateProfiles, type LinePrivateProfile } from "@/lib/admin/line/conversation-archive";
import { listAdvisorInboxOperational, type AdvisorInboxFilters } from "@/lib/admin/line/advisor-workflow";

export const metadata: Metadata = { title: "ลูกค้า LINE" };

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

function customerLabel(
  item: Pick<LineAdvisorInboxSafeItem, "customerCode" | "leadId">,
  displayName?: string | null,
) {
  return displayName?.trim() || `ลูกค้า ${item.customerCode.slice(-8)}`;
}

export default async function AdvisorInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("advisor:read");
  const params = await searchParams;
  const stageParam = typeof params.stage === "string" ? params.stage : "";
  const filters: AdvisorInboxFilters = {};

  if (LINE_ADVISOR_INBOX_STAGES.includes(stageParam as (typeof LINE_ADVISOR_INBOX_STAGES)[number])) {
    filters.stage = stageParam as AdvisorInboxFilters["stage"];
  }

  const model = await listAdvisorInboxSafe();
  let filteredRows: Awaited<ReturnType<typeof listAdvisorInboxOperational>> | null = null;
  let filterUnavailable = false;

  if (filters.stage && !model.unavailableReason) {
    try {
      filteredRows = await listAdvisorInboxOperational(filters);
    } catch {
      filterUnavailable = true;
    }
  }

  const displayRows = filteredRows ?? model.rows;
  const privateProfiles = model.unavailableReason
    ? new Map<string, LinePrivateProfile | null>()
    : await getLinePrivateProfiles(displayRows.map((row) => row.leadId));

  const newCount = model.aggregate.stageCounts.New;
  const activeCount =
    model.aggregate.stageCounts.Qualified +
    model.aggregate.stageCounts["Expert Review"] +
    model.aggregate.stageCounts.Solution +
    model.aggregate.stageCounts.Quote +
    model.aggregate.stageCounts.Implementation;
  const doneCount = model.aggregate.stageCounts.Won;
  const closedCount = model.aggregate.stageCounts.Lost;

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">LINE OA</p>
          <h1 className="mt-2 text-3xl font-semibold">ลูกค้า LINE</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            ดูว่าใครทักมา คุยเรื่องอะไร มีเอกสารหรือยัง และต้องกลับไปติดตามเมื่อไร
            ส่วนการตอบลูกค้า ให้ตอบใน LINE OA ตามเดิม
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/operations/health/"
            className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            สถานะระบบ
          </Link>
        </div>
      </div>

      <section
        className="mt-6 rounded-2xl border border-sky-200/15 bg-sky-200/[0.05] p-4 text-sm leading-6 text-sky-100/85"
        aria-label="วิธีใช้งาน"
      >
        <strong className="font-medium text-sky-100">ใช้งานง่าย ๆ:</strong>{" "}
        อ่านประวัติและจดสิ่งที่อยากจำที่นี่ แต่คุยกับลูกค้าใน LINE OA ที่เดิม
      </section>

      <form
        method="get"
        className="mt-6 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-end"
        aria-label="กรองตามสถานะ"
      >
        <label className="w-full text-xs text-white/55 sm:max-w-sm">
          ดูตามสถานะ
          <select
            name="stage"
            defaultValue={stageParam}
            className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white"
          >
            <option value="">ลูกค้าทั้งหมด</option>
            {LINE_ADVISOR_INBOX_STAGES.map((stage) => (
              <option key={stage} value={stage}>{lineStageLabel(stage)}</option>
            ))}
          </select>
        </label>
        <button className="min-h-11 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white/75">
          แสดงรายการ
        </button>
      </form>

      {filterUnavailable ? (
        <p role="alert" className="mt-3 text-sm text-amber-200/80">
          ตอนนี้กรองรายการไม่ได้ จึงแสดงลูกค้าทั้งหมดแทน
        </p>
      ) : null}

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="สรุปลูกค้า">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm text-white/60">ลูกค้าใหม่</p>
          <p className="mt-2 text-2xl font-semibold">{model.unavailableReason ? "—" : newCount}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm text-white/60">กำลังดูแล</p>
          <p className="mt-2 text-2xl font-semibold">{model.unavailableReason ? "—" : activeCount}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm text-white/60">ดูแลเรียบร้อยแล้ว</p>
          <p className="mt-2 text-2xl font-semibold">{model.unavailableReason ? "—" : doneCount}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm text-white/60">ไม่ได้ไปต่อ</p>
          <p className="mt-2 text-2xl font-semibold">{model.unavailableReason ? "—" : closedCount}</p>
        </article>
      </section>

      {model.unavailableReason ? (
        <section
          role="alert"
          className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm leading-6 text-amber-50"
        >
          <h2 className="font-semibold">ตอนนี้ยังเปิดรายชื่อลูกค้าไม่ได้</h2>
          <p className="mt-2 text-amber-50/80">
            ข้อมูลยังอยู่ครบ ระบบหยุดไว้ก่อนเพื่อไม่ให้ดึงข้อมูลผิดชุด ลองเปิดใหม่อีกครั้งในอีกสักครู่
          </p>
        </section>
      ) : null}

      {!model.unavailableReason && displayRows.length === 0 ? (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-7 text-center">
          <h2 className="text-lg font-semibold">ยังไม่มีลูกค้าในรายการนี้</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/65">
            เมื่อลูกค้าทัก LINE เข้ามา รายการจะขึ้นที่นี่อัตโนมัติ
          </p>
        </section>
      ) : null}

      {!model.unavailableReason && displayRows.length > 0 ? (
        <section className="mt-6 space-y-4" aria-label="รายชื่อลูกค้า">
          {filters.stage ? <p className="text-xs text-white/45">พบ {displayRows.length.toLocaleString("th-TH")} รายการ</p> : null}

          {displayRows.map((item) => {
            const displayName = privateProfiles.get(item.leadId)?.displayName;
            return (
              <article key={item.leadId} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-[#e0c985]/20 bg-[#e0c985]/10 px-2.5 py-1 text-[#f4df9b]">
                        {lineStageLabel(item.stage)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white/70">
                        {lineJourneyLabel(item.journey)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white/70">
                        {lineConversationStatusLabel(item.conversationStatus)}
                      </span>
                    </div>

                    <h2 className="mt-3 text-lg font-semibold text-white/90">
                      <Link
                        href={`/dashboard/inbox/${item.leadId}/`}
                        className="hover:text-white hover:underline hover:underline-offset-4"
                      >
                        {customerLabel(item, displayName)}
                      </Link>
                    </h2>

                    <p className="mt-1 text-sm text-white/55">
                      คุยล่าสุด {formatBangkokDate(item.lastActivityAt)}
                    </p>
                  </div>

                  <div className="text-sm leading-6 text-white/60 md:text-right">
                    {item.unreadCount > 0 ? <p>ยังไม่ได้อ่าน {item.unreadCount.toLocaleString("th-TH")} ข้อความ</p> : <p>อ่านข้อความล่าสุดแล้ว</p>}
                    <p>{item.materialReceived ? "ได้รับเอกสารแล้ว" : "ยังไม่ได้รับเอกสาร"}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-black/20 p-4">
                    <p className="text-xs font-medium text-white/45">ข้อความล่าสุด</p>
                    <p className="mt-2 text-sm text-white/75">
                      {lineMessageTypeLabel(item.latestMessageType)} · {lineMessageStatusLabel(item.latestMessageStatus)}
                    </p>
                    {item.latestMessageNeedsHuman ? (
                      <p className="mt-1 text-xs text-[#f4df9b]">รอปันดูต่อ</p>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-[#e0c985]/15 bg-[#e0c985]/[0.05] p-4">
                    <p className="text-xs font-medium text-[#e0c985]">เปิดเคสนี้</p>
                    <p className="mt-2 text-sm text-white/75">
                      ดูประวัติการคุย เอกสาร โน้ต วันติดตาม และหลักฐานการสนทนา
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
