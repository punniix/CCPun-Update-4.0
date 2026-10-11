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
  resolveInboxListRows,
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
  const requestedStage = typeof params.stage === "string" ? params.stage : "";
  const stageParam = LINE_ADVISOR_INBOX_STAGES.includes(requestedStage as (typeof LINE_ADVISOR_INBOX_STAGES)[number]) ? requestedStage : "";
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

  const list = resolveInboxListRows<LineAdvisorInboxSafeItem | Awaited<ReturnType<typeof listAdvisorInboxOperational>>[number]>({
    baseRows: model.rows,
    unavailable: Boolean(model.unavailableReason),
    filterRequested: Boolean(filters.stage),
    filteredRows,
    filterFailed: filterUnavailable,
  });
  const displayRows = list.rows;
  let profileUnavailable = false;
  const privateProfiles = list.state !== "ready"
    ? new Map<string, LinePrivateProfile | null>()
    : await getLinePrivateProfiles(displayRows.map((row) => row.leadId)).catch(() => {
        profileUnavailable = true;
        return new Map<string, LinePrivateProfile | null>();
      });

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

      <p className="mt-4 text-sm leading-6 text-white/60">เลือกเคสเพื่ออ่านประวัติ จดโน้ต และตั้งวันติดตาม คุยกับลูกค้าใน LINE OA ตามเดิม</p>

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
            <option value="">รายการล่าสุดทุกสถานะ</option>
            {LINE_ADVISOR_INBOX_STAGES.map((stage) => (
              <option key={stage} value={stage}>{lineStageLabel(stage)}</option>
            ))}
          </select>
        </label>
        <button className="min-h-11 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white/75">
          แสดงรายการ
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="เลือกสถานะที่ใช้บ่อย">
        {[["", "รายการล่าสุด"], ["New", "ลูกค้าใหม่"], ["Expert Review", "รอตรวจข้อมูล"], ["Quote", "ดูใบเสนอราคา"]].map(([stage, label]) => (
          <Link key={stage} href={stage ? `/dashboard/inbox/?stage=${encodeURIComponent(stage)}` : "/dashboard/inbox/"}
            aria-current={stageParam === stage ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-xl border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985] ${stageParam === stage ? "border-[#e0c985]/30 bg-[#e0c985]/10 text-[#f4df9b]" : "border-white/10 text-white/65 hover:bg-white/5"}`}>
            {label}
          </Link>
        ))}
      </div>

      <p className="mt-6 text-xs leading-5 text-white/55">สรุปจากรายการล่าสุดที่อ่านได้สูงสุด 50 รายการ ไม่ใช่ยอดลูกค้าหรืองานค้างทั้งหมด</p>
      <section className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="สรุปลูกค้าจากรายการล่าสุด">
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

      {list.state === "unavailable" ? (
        <section
          role="alert"
          className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm leading-6 text-amber-50"
        >
          <h2 className="font-semibold">{filterUnavailable ? "ยังอ่านรายการตามสถานะที่เลือกไม่ได้" : "ตอนนี้ยังเปิดรายชื่อลูกค้าไม่ได้"}</h2>
          <p className="mt-2 text-amber-50/80">
            {filterUnavailable ? "ไม่แสดงรายการสถานะอื่นแทน ลองโหลดใหม่หรือกลับไปดูรายการล่าสุด" : "ระบบยังยืนยันข้อมูลที่อ่านไม่ได้ จึงไม่แสดงเป็นศูนย์ ลองโหลดใหม่หรือตรวจสถานะระบบ"}
          </p>
        </section>
      ) : null}

      {list.state === "empty" ? (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-7 text-center">
          <h2 className="text-lg font-semibold">{filters.stage ? "ไม่พบรายการตามสถานะที่เลือก" : "ยังไม่มีรายการจากข้อมูลล่าสุดที่อ่านได้"}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/65">
            {filters.stage ? "ลองเลือกสถานะอื่นหรือกลับไปดูรายการล่าสุด" : "หากเพิ่งมีลูกค้าทัก LINE ให้ตรวจการรับข้อความและการบันทึกก่อน ไม่ใช่หลักฐานว่าไม่มีลูกค้า"}
          </p>
        </section>
      ) : null}

      {profileUnavailable ? <p role="status" className="mt-4 text-sm text-amber-100">ยังอ่านชื่อโปรไฟล์ไม่ได้ จะแสดงรหัสลูกค้าเพื่อให้เปิดเคสต่อได้</p> : null}
      {list.state === "ready" ? (
        <section className="mt-6 space-y-4" aria-label="รายชื่อลูกค้า">
          <p className="text-xs text-white/55">แสดง {displayRows.length.toLocaleString("th-TH")} รายการ{filters.stage ? `ตามสถานะที่เลือก · สูงสุด 100 รายการ` : "ล่าสุด · สูงสุด 50 รายการ"}</p>

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
                        className="inline-flex min-h-11 items-center hover:text-white hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]"
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

                  <Link href={`/dashboard/inbox/${item.leadId}/`} className="rounded-2xl border border-[#e0c985]/15 bg-[#e0c985]/[0.05] p-4 transition hover:border-[#e0c985]/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
                    <p className="text-xs font-medium text-[#e0c985]">เปิดเคสนี้</p>
                    <p className="mt-2 text-sm text-white/75">
                      ดูประวัติการคุย เอกสาร โน้ต วันติดตาม และหลักฐานการสนทนา
                    </p>
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
