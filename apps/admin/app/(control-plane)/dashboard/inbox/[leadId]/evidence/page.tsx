import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidencePrintButton } from "@/features/admin/line/EvidencePrintButton";
import {
  getLinePrivateProfile,
  readLineConversationEvidence,
  recordLineEvidenceAccess,
} from "@/lib/admin/line/conversation-archive";
import { readLineCaseDetail } from "@/lib/admin/line/control-plane";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export const metadata: Metadata = { title: "LINE Evidence Archive" };
export const dynamic = "force-dynamic";

function formatBangkok(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

export default async function LineEvidencePage({ params }: { params: Promise<{ leadId: string }> }) {
  const identity = await requireAdminPermission("advisor:read");
  const { leadId } = await params;
  const [detail, items, profile] = await Promise.all([
    readLineCaseDetail(leadId),
    readLineConversationEvidence(leadId),
    getLinePrivateProfile(leadId),
  ]);
  if (detail.unavailableReason === "lead_not_found") notFound();
  if (!detail.item) notFound();

  await recordLineEvidenceAccess({
    leadId,
    actor: identity.actor,
    action: "view",
    itemCount: items.length,
  }).catch(() => undefined);

  const displayName = profile?.displayName || `Customer ${detail.item.customerCode.slice(-8)}`;

  return (
    <div className="print:bg-white print:text-black">
      <div className="flex flex-wrap items-end justify-between gap-4 print:block">
        <div>
          <Link href={`/dashboard/inbox/${leadId}/`} className="text-sm text-white/55 hover:text-white print:hidden">
            ← กลับไป Conversation Archive
          </Link>
          <p className="mt-5 text-xs font-semibold tracking-[0.12em] text-[#e0c985] print:text-black">OWNER-ONLY EVIDENCE VIEW</p>
          <h1 className="mt-2 text-3xl font-semibold">{displayName}</h1>
          <p className="mt-2 text-sm text-white/55 print:text-black/70">
            Lead {leadId.slice(0, 8)} · Internal customer ref {detail.item.customerCode.slice(-8)}
          </p>
        </div>
        <EvidencePrintButton leadId={leadId} itemCount={items.length} />
      </div>

      <section className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] p-4 text-xs leading-5 text-amber-50/80 print:border-black/20 print:bg-transparent print:text-black">
        <strong>Evidence archive</strong>
        <p className="mt-1">
          ข้อความที่ LINE แจ้ง Unsend จะติดสถานะ Unsent แต่สำเนาที่ระบบได้รับก่อนหน้าจะยังอยู่ใน owner-only encrypted archive
          สำหรับตรวจสอบย้อนหลัง ส่วน attachment bytes ยังคงอยู่ภายใต้นโยบาย revoke/delete แยกต่างหาก
        </p>
        <p className="mt-1">
          Fingerprint ด้านล่างเป็น internal SHA-256 integrity fingerprint สำหรับเทียบ snapshot ภายในระบบ ไม่ใช่การรับรองทางกฎหมายจากบุคคลภายนอก
        </p>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Conversation evidence</h2>
          <span className="text-xs text-white/45 print:text-black/60">{items.length} records</span>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/55 print:border-black/20 print:text-black/60">
            ยังไม่มี archive record
          </div>
        ) : (
          <ol className="mt-4 space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className={`rounded-2xl border p-4 break-inside-avoid ${item.direction === "outbound"
                  ? "ml-6 border-[#e0c985]/20 bg-[#e0c985]/[0.04]"
                  : "mr-6 border-white/10 bg-black/15"} print:m-0 print:mb-3 print:border-black/20 print:bg-transparent`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/45 print:text-black/60">
                  <span>
                    {item.direction === "inbound" ? "ลูกค้า" : "CCPun"} · {item.messageType} · {item.sourceKind}
                    {item.status === "unsent" ? " · UNSENT" : ""}
                  </span>
                  <time>{formatBangkok(item.occurredAt)}</time>
                </div>

                {item.status === "unsent" ? (
                  <p className="mt-2 inline-flex rounded-full border border-rose-300/20 bg-rose-300/10 px-2.5 py-1 text-xs text-rose-100 print:border-black/30 print:bg-transparent print:text-black">
                    ลูกค้า Unsend {item.unsentAt ? `เมื่อ ${formatBangkok(item.unsentAt)}` : ""}
                  </p>
                ) : null}

                <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/85 print:text-black">
                  {item.contentState === "available"
                    ? item.text
                    : item.contentState === "decrypt_failed"
                      ? "ไม่สามารถถอดรหัส archive record นี้ได้"
                      : "ไม่มี plaintext ที่เก็บไว้สำหรับ record นี้"}
                </div>

                <dl className="mt-3 grid gap-1 border-t border-white/10 pt-3 text-[11px] leading-4 text-white/35 print:border-black/20 print:text-black/55">
                  <div>
                    <dt className="inline font-medium">Archive ID: </dt>
                    <dd className="inline">{item.id}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">SHA-256: </dt>
                    <dd className="inline break-all font-mono">{item.fingerprint}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
