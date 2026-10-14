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
import { buildActionCenterSignals, selectActionCenterSignals, type ActionCenterLead } from "@/lib/admin/agent-os/action-center";

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

function isAttentionLead(value: unknown): value is ActionCenterLead {
  if (!value || typeof value !== "object") return false;
  const lead = value as ActionCenterLead & Pick<LineAdvisorInboxSafeItem, "customerCode" | "journey" | "conversationStatus" | "latestMessageType" | "latestMessageStatus">;
  const date = (value: unknown) => value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
  const nullableText = (value: unknown) => value === null || typeof value === "string";
  return typeof lead.leadId === "string" && Boolean(lead.leadId) && typeof lead.stage === "string"
    && typeof lead.customerCode === "string" && Boolean(lead.customerCode)
    && typeof lead.journey === "string" && typeof lead.conversationStatus === "string"
    && nullableText(lead.latestMessageType) && nullableText(lead.latestMessageStatus)
    && typeof lead.materialReceived === "boolean" && Number.isInteger(lead.unreadCount) && lead.unreadCount >= 0
    && date(lead.followUpAt) && date(lead.lastActivityAt)
    && (lead.latestMessageNeedsHuman === null || typeof lead.latestMessageNeedsHuman === "boolean")
    && ["active", "waiting", "completed"].includes(lead.caseState);
}

export default async function AdvisorInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("advisor:read");
  const params = await searchParams;
  const nowIso = new Date().toISOString();
  const attention = params.attention === "human" || params.attention === "follow-up" ? params.attention : null;
  const invalidAttention = params.attention !== undefined && !attention;
  const attentionRequested = attention !== null || invalidAttention;
  const requestedStage = typeof params.stage === "string" ? params.stage : "";
  const stageParam = LINE_ADVISOR_INBOX_STAGES.includes(requestedStage as (typeof LINE_ADVISOR_INBOX_STAGES)[number]) ? requestedStage : "";
  const filters: AdvisorInboxFilters = {};

  if (LINE_ADVISOR_INBOX_STAGES.includes(stageParam as (typeof LINE_ADVISOR_INBOX_STAGES)[number])) {
    filters.stage = stageParam as AdvisorInboxFilters["stage"];
  }

  const model = await listAdvisorInboxSafe();
  let filteredRows: Awaited<ReturnType<typeof listAdvisorInboxOperational>> | null = null;
  let filterUnavailable = invalidAttention;

  if ((filters.stage || attention) && !model.unavailableReason && !invalidAttention) {
    try {
      filteredRows = await listAdvisorInboxOperational(filters);
      if (attention) {
        if (!Array.isArray(filteredRows) || !filteredRows.every(isAttentionLead)) throw new Error("attention-unavailable");
        const signals = selectActionCenterSignals(buildActionCenterSignals(filteredRows, nowIso), attention);
        const leadIds = new Set(signals.map(signal => signal.leadId));
        const included = new Set<string>();
        filteredRows = filteredRows.filter(row => {
          if (!leadIds.has(row.leadId) || included.has(row.leadId)) return false;
          included.add(row.leadId);
          return true;
        });
      }
    } catch {
      filterUnavailable = true;
    }
  }

  const list = resolveInboxListRows<LineAdvisorInboxSafeItem | Awaited<ReturnType<typeof listAdvisorInboxOperational>>[number]>({
    baseRows: model.rows,
    unavailable: Boolean(model.unavailableReason),
    filterRequested: Boolean(filters.stage) || attentionRequested,
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
          <p className="text-sm leading-[22px] font-semibold tracking-[0.12em] text-[#e0c985]">LINE OA</p>
          <h1 className="mt-2 text-3xl font-semibold">ลูกค้า LINE</h1>
          <p className="mt-3 max-w-3xl text-base leading-6 text-white/70">
            ดูว่าใครทักมา คุยเรื่องอะไร มีเอกสารหรือยัง และต้องกลับไปติดตามเมื่อไร
            ส่วนการตอบลูกค้า ให้ตอบใน LINE OA ตามเดิม
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/operations/health/"
            className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-base text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            สถานะระบบ
          </Link>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-white/75">เลือกเคสเพื่ออ่านประวัติ จดโน้ต และตั้งวันติดตาม คุยกับลูกค้าใน LINE OA ตามเดิม</p>

      <form
        method="get"
        className="mt-6 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-end"
        aria-label="กรองตามสถานะ"
      >
        {attention ? <input type="hidden" name="attention" value={attention} /> : null}
        <label className="w-full text-sm leading-[22px] text-white/70 sm:max-w-sm">
          ดูตามสถานะ
          <select
            name="stage"
            defaultValue={stageParam}
            className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-base text-white"
          >
            <option value="">รายการล่าสุดทุกสถานะ</option>
            {LINE_ADVISOR_INBOX_STAGES.map((stage) => (
              <option key={stage} value={stage}>{lineStageLabel(stage)}</option>
            ))}
          </select>
        </label>
        <button className="min-h-11 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-base text-white/75">
          แสดงรายการ
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="เลือกสถานะที่ใช้บ่อย">
        {[["", "รายการล่าสุด"], ["New", "ลูกค้าใหม่"], ["Expert Review", "รอตรวจข้อมูล"], ["Quote", "ดูใบเสนอราคา"]].map(([stage, label]) => (
          <Link key={stage} href={attention ? `/dashboard/inbox/?attention=${attention}${stage ? `&stage=${encodeURIComponent(stage)}` : ""}` : stage ? `/dashboard/inbox/?stage=${encodeURIComponent(stage)}` : "/dashboard/inbox/"}
            aria-current={stageParam === stage ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-xl border px-3 text-base leading-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985] ${stageParam === stage ? "border-[#e0c985]/30 bg-[#e0c985]/10 text-[#f4df9b]" : "border-white/10 text-white/65 hover:bg-white/5"}`}>
            {label}
          </Link>
        ))}
      </div>
      {attention ? <p className="mt-4 text-sm leading-[22px] text-white/75">{attention === "human" ? "เฉพาะลูกค้าที่ต้องดูต่อ" : "เฉพาะลูกค้าที่ถึงกำหนดติดตามหรือเลยกำหนด"} · จากรายการล่าสุดที่อ่านได้สูงสุด 100 รายการ ณ {formatBangkokDate(nowIso)} (เวลาไทย) · ลูกค้าคนเดียวแสดงหนึ่งแถว แม้มีหลายเรื่องที่ต้องจัดการ</p> : null}

      <p className="mt-6 text-sm leading-[22px] text-white/70">สรุปจากรายการล่าสุดที่อ่านได้สูงสุด 50 รายการ ไม่ใช่ยอดลูกค้าหรืองานค้างทั้งหมด</p>
      <section className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="สรุปลูกค้าจากรายการล่าสุด">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm leading-[22px] text-white/75">ลูกค้าใหม่</p>
          <p className="mt-2 text-2xl font-semibold">{model.unavailableReason ? "—" : newCount}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm leading-[22px] text-white/75">กำลังดูแล</p>
          <p className="mt-2 text-2xl font-semibold">{model.unavailableReason ? "—" : activeCount}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm leading-[22px] text-white/75">ดูแลเรียบร้อยแล้ว</p>
          <p className="mt-2 text-2xl font-semibold">{model.unavailableReason ? "—" : doneCount}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm leading-[22px] text-white/75">ไม่ได้ไปต่อ</p>
          <p className="mt-2 text-2xl font-semibold">{model.unavailableReason ? "—" : closedCount}</p>
        </article>
      </section>

      {list.state === "unavailable" ? (
        <section
          role="alert"
          className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm leading-6 text-amber-50"
        >
          <h2 className="font-semibold">{invalidAttention ? "ตัวกรองงานที่เลือกไม่ถูกต้อง" : filterUnavailable ? "ยังอ่านรายการตามตัวกรองที่เลือกไม่ได้" : "ตอนนี้ยังเปิดรายชื่อลูกค้าไม่ได้"}</h2>
          <p className="mt-2 text-amber-50/80">
            {filterUnavailable ? "ไม่แสดงรายการสถานะอื่นแทน ลองโหลดใหม่หรือกลับไปดูรายการล่าสุด" : "ระบบยังยืนยันข้อมูลที่อ่านไม่ได้ จึงไม่แสดงเป็นศูนย์ ลองโหลดใหม่หรือตรวจสถานะระบบ"}
          </p>
        </section>
      ) : null}

      {list.state === "empty" ? (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-7 text-center">
          <h2 className="text-lg font-semibold">{filters.stage || attention ? "ไม่พบรายการตามตัวกรองที่เลือก" : "ยังไม่มีรายการจากข้อมูลล่าสุดที่อ่านได้"}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/65">
            {filters.stage || attention ? "ลองเลือกตัวกรองอื่นหรือกลับไปดูรายการล่าสุด" : "หากเพิ่งมีลูกค้าทัก LINE ให้ตรวจการรับข้อความและการบันทึกก่อน ไม่ใช่หลักฐานว่าไม่มีลูกค้า"}
          </p>
        </section>
      ) : null}

      {profileUnavailable ? <p role="status" className="mt-4 text-sm leading-[22px] text-amber-100">ยังอ่านชื่อโปรไฟล์ไม่ได้ จะแสดงรหัสลูกค้าเพื่อให้เปิดเคสต่อได้</p> : null}
      {list.state === "ready" ? (
        <section className="mt-6 divide-y divide-white/15 border-y border-white/15" aria-label="รายชื่อลูกค้า">
          <p className="py-4 text-sm leading-[22px] text-white/70">แสดง {displayRows.length.toLocaleString("th-TH")} ลูกค้า{filters.stage || attention ? `ตามตัวกรองที่เลือก · สูงสุด 100 รายการที่อ่านมา` : "จากรายการล่าสุด · สูงสุด 50 รายการที่อ่านมา"}</p>

          {displayRows.map((item) => {
            const displayName = privateProfiles.get(item.leadId)?.displayName;
            return (
              <article key={item.leadId} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-white/90">{customerLabel(item, displayName)}</h2>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm leading-[22px] text-white/75">
                    <span className="font-medium text-[#f4df9b]">{lineStageLabel(item.stage)}</span>
                    <span>{lineJourneyLabel(item.journey)}</span>
                    <span>{lineConversationStatusLabel(item.conversationStatus)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-[22px] text-white/70">คุยล่าสุด {formatBangkokDate(item.lastActivityAt)}</p>
                </div>
                <div className="min-w-0 text-sm leading-[22px] text-white/75">
                  <p>{item.unreadCount > 0 ? `ยังไม่ได้อ่าน ${item.unreadCount.toLocaleString("th-TH")} ข้อความ` : "อ่านข้อความล่าสุดแล้ว"} · {item.materialReceived ? "ได้รับเอกสารแล้ว" : "ยังไม่ได้รับเอกสาร"}</p>
                  <p className="mt-1">ข้อความล่าสุด: {lineMessageTypeLabel(item.latestMessageType)} · {lineMessageStatusLabel(item.latestMessageStatus)}</p>
                  {item.latestMessageNeedsHuman ? <p className="mt-1 text-[#f4df9b]">รอปันดูต่อ</p> : null}
                </div>
                <Link href={`/dashboard/inbox/${item.leadId}/`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#e0c985]/30 px-4 py-2 text-base leading-6 font-medium text-[#f4df9b] transition hover:bg-[#e0c985]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">
                  เปิดเคส<span className="sr-only"> {customerLabel(item, displayName)}</span>
                </Link>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
