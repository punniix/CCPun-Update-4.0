import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LineCaseActions } from "@/features/admin/line/LineCaseActions";
import { LineOAHistoryImport } from "@/features/admin/line/LineOAHistoryImport";
import { ChatScreenshotImport } from "@/features/admin/line/ChatScreenshotImport";
import { LeadOutcomeActions } from "@/features/admin/line/LeadOutcomeActions";
import { AdvisorCaseOperations } from "@/features/admin/line/AdvisorCaseOperations";
import { readLineCaseDetail } from "@/lib/admin/line/control-plane";
import { getLinePrivateProfile } from "@/lib/admin/line/conversation-archive";
import {
  formatFileSize,
  lineBotDecisionLabel,
  lineConversationStatusLabel,
  lineDocumentCategoryLabel,
  lineDocumentStatusLabel,
  lineJourneyLabel,
  lineMessageStatusLabel,
  lineMessageTypeLabel,
  lineNeedLabel,
  lineOperationEventLabel,
  lineStageLabel,
  lineTechnicalStateLabel,
} from "@/lib/admin/line/presentation";
import {
  advisorPrivateNotesEnabled,
  readAdvisorCaseTimeline,
  readAdvisorPrivateNotes,
} from "@/lib/admin/line/advisor-workflow";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export const metadata: Metadata = { title: "รายละเอียดลูกค้า LINE" };

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

export default async function AdvisorCasePage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  await requireAdminPermission("advisor:read");
  const { leadId } = await params;
  const detail = await readLineCaseDetail(leadId);

  if (detail.unavailableReason === "lead_not_found") notFound();

  if (detail.unavailableReason || !detail.item) {
    return (
      <div>
        <Link href="/dashboard/inbox/" className="text-sm text-white/60 hover:text-white">
          ← ลูกค้า LINE
        </Link>
        <section
          role="alert"
          className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm leading-6 text-amber-50"
        >
          <h1 className="text-lg font-semibold">ตอนนี้ยังเปิดรายละเอียดลูกค้าไม่ได้</h1>
          <p className="mt-2 text-amber-50/75">
            ข้อมูลยังอยู่ครบ ระบบหยุดไว้ก่อนเพื่อไม่ให้เปิดข้อมูลผิดชุด ลองใหม่อีกครั้งในอีกสักครู่
          </p>
        </section>
      </div>
    );
  }

  const item = detail.item;
  const [operations, privateNotes, profile] = await Promise.all([
    readAdvisorCaseTimeline(item.leadId).catch(() => ({ events: [], documents: [] })),
    readAdvisorPrivateNotes(item.leadId).catch(() => ({ state: "unavailable" as const, notes: [] })),
    getLinePrivateProfile(item.leadId).catch(() => null),
  ]);
  const notesEnabled = advisorPrivateNotesEnabled();
  const customerName = profile?.displayName || `ลูกค้า ${item.customerCode.slice(-8)}`;

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/dashboard/inbox/" className="text-sm text-white/55 hover:text-white">
            ← ลูกค้า LINE
          </Link>
          <p className="mt-5 text-xs font-semibold tracking-[0.12em] text-[#e0c985]">
            {lineJourneyLabel(item.journey)}
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{customerName}</h1>
          <p className="mt-2 text-sm text-white/55">
            คุยล่าสุด {formatBangkokDate(item.lastActivityAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            href={`/dashboard/inbox/${item.leadId}/evidence/`}
            className="inline-flex min-h-9 items-center rounded-xl border border-white/10 px-3 py-1.5 text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            หลักฐานการคุย
          </Link>
          <span className="rounded-full border border-[#e0c985]/20 bg-[#e0c985]/10 px-3 py-1.5 text-[#f4df9b]">
            {lineStageLabel(item.stage)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/70">
            {lineConversationStatusLabel(item.conversationStatus)}
          </span>
          {detail.botDecision === "human_handoff" ? (
            <span className="rounded-full border border-sky-200/15 bg-sky-200/[0.06] px-3 py-1.5 text-sky-100">
              {lineBotDecisionLabel(detail.botDecision)}
            </span>
          ) : null}
        </div>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="สรุปลูกค้า">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs text-white/45">เรื่องที่คุย</p>
          <p className="mt-2 text-sm text-white/80">{lineJourneyLabel(item.journey)}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs text-white/45">ตอนนี้ต้องการอะไร</p>
          <p className="mt-2 text-sm text-white/80">{lineNeedLabel(item.need)}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs text-white/45">เอกสาร</p>
          <p className="mt-2 text-sm text-white/80">
            {item.materialReceived ? "ได้รับเอกสารแล้ว" : "ยังไม่ได้รับเอกสาร"}
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs text-white/45">ข้อความล่าสุด</p>
          <p className="mt-2 text-sm text-white/80">
            {lineMessageTypeLabel(item.latestMessageType)}
          </p>
        </article>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.8fr)]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">ประวัติการคุย</h2>
              <p className="mt-1 text-xs leading-5 text-white/50">
                ข้อความที่ลูกค้าส่งเข้ามาจะเพิ่มให้อัตโนมัติ ส่วนข้อความที่ CCPun เคยตอบจาก LINE OA
                สามารถเติมจากไฟล์ประวัติได้
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs ${
              detail.transcript.state === "available"
                ? "bg-emerald-300/10 text-emerald-200"
                : "bg-amber-300/10 text-amber-200"
            }`}>
              {lineTechnicalStateLabel(detail.transcript.state)}
            </span>
          </div>

          {detail.transcript.state !== "available" ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-sm leading-6 text-white/60">
              ตอนนี้ยังเปิดประวัติข้อความไม่ได้ ลองใหม่อีกครั้งภายหลัง
            </div>
          ) : detail.transcript.items.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/55">
              ยังไม่มีข้อความในประวัติ
            </div>
          ) : (
            <ol className="mt-5 space-y-3">
              {detail.transcript.items.map((message) => (
                <li
                  key={`${message.sourceKind}:${message.itemId}`}
                  className={`rounded-2xl border p-4 ${
                    message.direction === "outbound"
                      ? "ml-6 border-[#e0c985]/15 bg-[#e0c985]/[0.04]"
                      : "mr-6 border-white/10 bg-black/15"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/45">
                    <span>
                      {message.direction === "outbound" ? "CCPun" : "ลูกค้า"} ·{" "}
                      {lineMessageTypeLabel(message.messageType)} ·{" "}
                      {lineMessageStatusLabel(message.status)}
                    </span>
                    <time>{formatBangkokDate(message.occurredAt)}</time>
                  </div>

                  <div className="mt-2 text-sm leading-6 text-white/80">
                    {message.contentState === "purged" ? (
                      <em className="text-white/45">
                        ข้อความนี้ถูกยกเลิกก่อนระบบเก็บหลักฐานรุ่นปัจจุบัน จึงไม่มีข้อความเดิมเหลือ
                      </em>
                    ) : message.contentState === "legacy_key_unavailable" ? (
                      <span className="text-amber-200/70">
                        ข้อความเก่านี้ยังเปิดไม่ได้ในตอนนี้
                      </span>
                    ) : message.contentState === "decrypt_failed" ? (
                      <span className="text-amber-200/70">
                        เปิดข้อความนี้ยังไม่สำเร็จ ลองใหม่อีกครั้งภายหลัง
                      </span>
                    ) : (
                      <>
                        {message.contentState === "retained_after_unsend" ? (
                          <span className="mb-2 inline-flex rounded-full border border-rose-300/20 bg-rose-300/10 px-2 py-0.5 text-[11px] text-rose-100">
                            ลูกค้ายกเลิกข้อความนี้ · สำเนายังอยู่ในหลักฐานการคุย
                          </span>
                        ) : null}
                        <p className="whitespace-pre-wrap">
                          {message.text ?? "รายการนี้ไม่มีข้อความให้อ่าน"}
                        </p>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-5">
          <LineCaseActions
            leadId={item.leadId}
            nextStages={item.nextStages}
            stageMutationEnabled={detail.status.stageMutationEnabled}
          />

          <AdvisorCaseOperations leadId={item.leadId} notesEnabled={notesEnabled} />

          <details className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-white/85">
              ข้อมูลเพิ่มเติมเมื่อเริ่มดำเนินการ
            </summary>
            <div className="mt-4">
              <LeadOutcomeActions leadId={item.leadId} />
            </div>
          </details>

          <details className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-white/85">
              เพิ่มประวัติจากภาพแคปแชท
            </summary>
            <div className="mt-4">
              <ChatScreenshotImport leadId={item.leadId} />
            </div>
          </details>

          <details className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-white/85">
              นำเข้าประวัติจาก LINE OA
            </summary>
            <div className="mt-4">
              <LineOAHistoryImport leadId={item.leadId} />
            </div>
          </details>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <h2 className="text-sm font-semibold">ประวัติการดูแล</h2>
            {detail.stageHistory.length ? (
              <ol className="mt-3 space-y-3">
                {detail.stageHistory.map((history) => (
                  <li key={history.id} className="text-xs leading-5 text-white/60">
                    <span className="text-white/80">
                      {lineStageLabel(history.from)} → {lineStageLabel(history.to)}
                    </span>
                    <br />
                    {formatBangkokDate(history.createdAt)}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-xs text-white/45">ยังไม่มีการเปลี่ยนสถานะ</p>
            )}

            {operations.events.length ? (
              <ol className="mt-4 space-y-2 border-t border-white/10 pt-4">
                {operations.events.slice(0, 20).map((event) => (
                  <li key={event.id} className="text-xs leading-5 text-white/55">
                    <span className="text-white/75">{lineOperationEventLabel(event.type)}</span>
                    {" · "}
                    {formatBangkokDate(event.createdAt)}
                  </li>
                ))}
              </ol>
            ) : null}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <h2 className="text-sm font-semibold">เอกสารของลูกค้า</h2>
            {operations.documents.length ? (
              <ul className="mt-3 space-y-3">
                {operations.documents.slice(0, 20).map((doc) => (
                  <li key={doc.id} className="rounded-xl bg-black/15 p-3 text-xs leading-5 text-white/55">
                    <p className="text-white/75">{lineDocumentCategoryLabel(doc.category)}</p>
                    <p>{lineDocumentStatusLabel(doc.status)}</p>
                    <p className="text-white/35">
                      {formatFileSize(doc.byteSize)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-white/45">ยังไม่มีเอกสาร</p>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <h2 className="text-sm font-semibold">โน้ตที่เคยบันทึก</h2>
            {privateNotes.state === "available" ? (
              privateNotes.notes.length ? (
                <ul className="mt-3 space-y-3">
                  {privateNotes.notes.map((note) => (
                    <li key={note.id} className="rounded-xl bg-black/20 p-3 text-xs leading-5 text-white/65">
                      <p className="whitespace-pre-wrap">
                        {note.contentState === "available"
                          ? note.text
                          : note.contentState === "legacy_key_unavailable"
                            ? "โน้ตเก่านี้ยังเปิดไม่ได้ในตอนนี้"
                            : "เปิดโน้ตนี้ยังไม่สำเร็จ"}
                      </p>
                      <time className="mt-2 block text-white/35">{formatBangkokDate(note.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-white/45">ยังไม่มีโน้ต</p>
              )
            ) : (
              <p className="mt-2 text-xs text-amber-200/70">
                โน้ตส่วนตัวยังไม่พร้อมใช้งาน
              </p>
            )}
          </section>

          <details className="rounded-2xl border border-white/10 bg-black/10 p-4 text-xs text-white/45">
            <summary className="cursor-pointer font-medium text-white/60">รายละเอียดระบบ</summary>
            <dl className="mt-3 space-y-2">
              <div>
                <dt className="inline">รหัสเคส: </dt>
                <dd className="inline">{item.leadId.slice(0, 8)}</dd>
              </div>
              <div>
                <dt className="inline">รหัสลูกค้าภายใน: </dt>
                <dd className="inline">{item.customerCode.slice(-8)}</dd>
              </div>
              <div>
                <dt className="inline">ค่าระบบของเรื่องที่คุย: </dt>
                <dd className="inline">{item.journey}</dd>
              </div>
              <div>
                <dt className="inline">ค่าระบบของสถานะ: </dt>
                <dd className="inline">{item.stage}</dd>
              </div>
              <div>
                <dt className="inline">การตอบสนองของระบบ: </dt>
                <dd className="inline">{detail.botDecision}</dd>
              </div>
              {item.origin ? (
                <div>
                  <dt className="inline">แหล่งที่มา: </dt>
                  <dd className="inline">{item.origin}</dd>
                </div>
              ) : null}
            </dl>
          </details>
        </aside>
      </div>
    </div>
  );
}
