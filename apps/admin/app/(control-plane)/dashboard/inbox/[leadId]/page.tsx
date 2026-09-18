import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LineCaseActions } from "@/features/admin/line/LineCaseActions";
import { AdvisorCaseOperations } from "@/features/admin/line/AdvisorCaseOperations";
import { readLineCaseDetail } from "@/lib/admin/line/control-plane";
import { advisorPrivateNotesEnabled, readAdvisorCaseTimeline, readAdvisorPrivateNotes } from "@/lib/admin/line/advisor-workflow";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export const metadata: Metadata = { title: "Advisor Case" };

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

export default async function AdvisorCasePage({ params }: { params: Promise<{ leadId: string }> }) {
  await requireAdminPermission("advisor:read");
  const { leadId } = await params;
  const detail = await readLineCaseDetail(leadId);
  if (detail.unavailableReason === "lead_not_found") notFound();

  if (detail.unavailableReason || !detail.item) {
    return (
      <div>
        <Link href="/dashboard/inbox/" className="text-sm text-white/60 hover:text-white">← Advisor Inbox</Link>
        <section role="alert" className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm leading-6 text-amber-50">
          <h1 className="text-lg font-semibold">ยังเปิดรายละเอียดเคสไม่ได้</h1>
          <p className="mt-2 text-amber-50/75">ระบบ fail-closed และจะไม่ fallback ไปอ่าน raw private tables</p>
          <p className="mt-2 text-xs text-amber-50/60">{detail.unavailableReason ?? "unknown"}</p>
        </section>
      </div>
    );
  }

  const item = detail.item;
  const [operations, privateNotes] = await Promise.all([
    readAdvisorCaseTimeline(item.leadId).catch(() => ({ events: [], documents: [] })),
    readAdvisorPrivateNotes(item.leadId).catch(() => ({ state: "unavailable" as const, notes: [] })),
  ]);
  const notesEnabled = advisorPrivateNotesEnabled();
  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/dashboard/inbox/" className="text-sm text-white/55 hover:text-white">← Advisor Inbox</Link>
          <p className="mt-5 text-xs font-semibold tracking-[0.12em] text-[#e0c985]">PRIVATE LINE CASE</p>
          <h1 className="mt-2 text-3xl font-semibold">Customer {item.customerCode.slice(-8)}</h1>
          <p className="mt-2 text-sm text-white/55">Lead {item.leadId.slice(0, 8)} · {item.journey}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-[#e0c985]/20 bg-[#e0c985]/10 px-3 py-1.5 text-[#f4df9b]">{item.stage}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/70">{item.conversationStatus}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/70">Bot: {detail.botDecision}</span>
        </div>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Safe case context">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs text-white/45">Origin</p><p className="mt-2 text-sm text-white/80">{item.origin ?? "—"}</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs text-white/45">Need</p><p className="mt-2 text-sm text-white/80">{item.need ?? "—"}</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs text-white/45">Material</p><p className="mt-2 text-sm text-white/80">{item.materialReceived ? "Received" : "Not received"}</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs text-white/45">Latest activity</p><p className="mt-2 text-sm text-white/80">{formatBangkokDate(item.lastActivityAt)}</p></article>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.8fr)]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Conversation timeline</h2>
              <p className="mt-1 text-xs leading-5 text-white/50">Plaintext แสดงเฉพาะ server-rendered owner view เมื่อ transcript gate + encryption key พร้อม</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs ${detail.transcript.state === "available" ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}>{detail.transcript.state}</span>
          </div>

          {detail.transcript.state !== "available" ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-sm leading-6 text-white/60">
              Transcript ยังไม่เปิดใช้งาน ระบบไม่ดึง ciphertext มา fallback และไม่ส่งข้อมูลส่วนตัวให้ AI
            </div>
          ) : detail.transcript.items.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/55">ยังไม่มีข้อความใน timeline</div>
          ) : (
            <ol className="mt-5 space-y-3">
              {detail.transcript.items.map((message) => (
                <li key={`${message.sourceKind}:${message.itemId}`} className={`rounded-2xl border p-4 ${message.direction === "outbound" ? "ml-6 border-[#e0c985]/15 bg-[#e0c985]/[0.04]" : "mr-6 border-white/10 bg-black/15"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/45">
                    <span>{message.direction} · {message.messageType} · {message.status}</span>
                    <time>{formatBangkokDate(message.occurredAt)}</time>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/80">
                    {message.status === "unsent" ? <em className="text-white/45">ข้อความถูก Unsend และเนื้อหาถูก purge แล้ว</em> : message.text ?? <span className="text-white/45">ไม่มี plaintext สำหรับ message type นี้</span>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-5">
          <LineCaseActions leadId={item.leadId} nextStages={item.nextStages} replyEnabled={detail.status.replyEnabled} stageMutationEnabled={detail.status.stageMutationEnabled} />
          <AdvisorCaseOperations leadId={item.leadId} notesEnabled={notesEnabled} />

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <h2 className="text-sm font-semibold">Stage history</h2>
            {detail.stageHistory.length ? (
              <ol className="mt-3 space-y-3">
                {detail.stageHistory.map((history) => (
                  <li key={history.id} className="text-xs leading-5 text-white/60">
                    <span className="text-white/80">{history.from} → {history.to}</span><br />
                    {formatBangkokDate(history.createdAt)}
                  </li>
                ))}
              </ol>
            ) : <p className="mt-3 text-xs text-white/45">ยังไม่มี stage transition ที่บันทึกเพิ่ม</p>}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <h2 className="text-sm font-semibold">Operational timeline</h2>
            {operations.events.length ? <ol className="mt-3 space-y-2">{operations.events.slice(0,20).map((event) => <li key={event.id} className="text-xs leading-5 text-white/55"><span className="text-white/75">{event.type}</span> · {formatBangkokDate(event.createdAt)}</li>)}</ol> : <p className="mt-2 text-xs text-white/45">ยังไม่มี operational event</p>}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <h2 className="text-sm font-semibold">Documents</h2>
            {operations.documents.length ? <ul className="mt-3 space-y-2">{operations.documents.slice(0,20).map((doc) => <li key={doc.id} className="text-xs leading-5 text-white/55">{doc.category} · {doc.status} · {doc.mimeType ?? "unknown type"} · {doc.byteSize ?? "—"} bytes</li>)}</ul> : <p className="mt-2 text-xs text-white/45">ยังไม่มี document metadata</p>}
            <p className="mt-2 text-[11px] leading-4 text-white/35">ไม่แสดง Drive URL, external file ID หรือ document bytes ใน surface นี้</p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <h2 className="text-sm font-semibold">Private notes</h2>
            {privateNotes.state === "available" ? (privateNotes.notes.length ? <ul className="mt-3 space-y-3">{privateNotes.notes.map((note) => <li key={note.id} className="rounded-xl bg-black/20 p-3 text-xs leading-5 text-white/65"><p className="whitespace-pre-wrap">{note.text}</p><time className="mt-2 block text-white/35">{formatBangkokDate(note.createdAt)}</time></li>)}</ul> : <p className="mt-2 text-xs text-white/45">ยังไม่มี private note</p>) : <p className="mt-2 text-xs text-amber-200/70">Private notes {privateNotes.state} — ต้องเปิด encryption gate โดย owner</p>}
            <p className="mt-2 text-[11px] leading-4 text-white/35">Internal notes เป็น Customer Confidential Data และไม่มี SafeForAI projection</p>
          </section>

          <section className="rounded-2xl border border-sky-200/15 bg-sky-200/[0.04] p-4 text-xs leading-5 text-sky-100/75">
            <strong className="text-sky-100">Safety boundary</strong>
            <p className="mt-2">ไม่มี LINE user ID, provider ID, document bytes, health/financial inputs หรือ ciphertext ถูก render ลง client props จากหน้านี้</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
