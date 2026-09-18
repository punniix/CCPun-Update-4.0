import type { Metadata } from "next";
import {
  PrivacyRequestActions,
  PrivacyRequestManager,
  RetentionPolicyEditor,
} from "@/features/admin/line/PrivacyRequestManager";
import {
  listPrivacyRequests,
  readPrivacySafetyHealth,
} from "@/lib/admin/line/business-intelligence";
import {
  linePrivacyRequestTypeLabel,
  linePrivacyStatusLabel,
  lineRetentionModeLabel,
  lineTechnicalStateLabel,
} from "@/lib/admin/line/presentation";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export const metadata: Metadata = { title: "ข้อมูลและความเป็นส่วนตัว" };

function date(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(parsed);
}

export default async function PrivacyPage() {
  await requireAdminPermission("settings:read");
  const [model, safety] = await Promise.all([
    listPrivacyRequests(),
    readPrivacySafetyHealth(),
  ]);

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">
        ข้อมูลลูกค้า
      </p>
      <h1 className="mt-2 text-3xl font-semibold">ข้อมูลและความเป็นส่วนตัว</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
        ใช้สำหรับเตรียมสำเนาข้อมูล ตรวจคำขอลบ และตั้งเตือนให้กลับมาตรวจข้อมูลเป็นระยะ
        ระบบจะไม่ลบข้อมูลจริงจากหน้านี้โดยอัตโนมัติ
      </p>

      <div className="mt-7">
        <PrivacyRequestManager />
      </div>

      {safety.state === "ready" ? (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs text-white/45">วิธีเก็บข้อมูล</p>
              <p className="mt-2 text-lg font-semibold">
                {lineRetentionModeLabel(safety.retentionMode)}
              </p>
              <p className="mt-1 text-xs text-white/45">
                ไม่มีการลบอัตโนมัติ
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs text-white/45">คำขอสำเนาที่เตรียมไว้</p>
              <p className="mt-2 text-lg font-semibold">
                {safety.preparedExportManifestCount.toLocaleString("th-TH")}
              </p>
              <p className="mt-1 text-xs text-white/45">
                ยังไม่มีข้อมูลดิบถูกส่งออกจากหน้านี้
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs text-white/45">คำขอลบที่เตรียมไว้</p>
              <p className="mt-2 text-lg font-semibold">
                {safety.preparedDeleteTombstoneCount.toLocaleString("th-TH")}
              </p>
              <p className="mt-1 text-xs text-white/45">
                ไฟล์ที่ยังต้องจัดการ {safety.attachmentCleanupRequiredCount.toLocaleString("th-TH")}
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs text-white/45">การสำรองข้อมูล</p>
              <p className="mt-2 text-sm font-semibold">
                {lineTechnicalStateLabel(safety.backupRestoreEvidenceState)}
              </p>
              <p className="mt-1 text-xs text-white/45">
                การเข้ารหัส: {lineTechnicalStateLabel(safety.keyRotationEvidenceState)}
              </p>
            </article>
          </section>

          <div className="mt-6">
            <RetentionPolicyEditor
              conversationReviewAfterDays={safety.conversationReviewAfterDays}
              documentReviewAfterDays={safety.documentReviewAfterDays}
              auditReviewAfterDays={safety.auditReviewAfterDays}
            />
          </div>
        </>
      ) : null}

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">คำขอที่กำลังดูแล</h2>
            <p className="mt-1 text-xs text-white/45">
              การลบข้อมูลจริงต้องยืนยันแยกต่างหาก
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60">
            {lineTechnicalStateLabel(model.state)}
          </span>
        </div>

        {model.state === "ready" && model.requests.length ? (
          <div className="mt-4 space-y-3">
            {model.requests.map((request) => (
              <article
                key={request.id}
                className="rounded-2xl border border-white/10 bg-black/15 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white/85">
                      {linePrivacyRequestTypeLabel(request.requestType)}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      สร้างเมื่อ {date(request.requestedAt)}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/60">
                    {linePrivacyStatusLabel(request.status)}
                  </span>
                </div>
                <PrivacyRequestActions
                  requestId={request.id}
                  status={request.status}
                />
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-white/45">
            {model.state === "ready"
              ? "ยังไม่มีคำขอ"
              : "ตอนนี้ยังเปิดรายการคำขอไม่ได้"}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-amber-200/15 bg-amber-200/[0.05] p-4 text-xs leading-5 text-amber-50/75">
        <strong className="text-amber-50">การลบข้อมูลจริงต้องยืนยันอีกครั้ง</strong>
        <p className="mt-1">
          หน้านี้ช่วยตรวจและเตรียมรายการเท่านั้น ก่อนลบข้อมูลจริงต้องมีการยืนยันจากเจ้าของระบบแยกต่างหาก
          เพื่อป้องกันการลบโดยไม่ตั้งใจ
        </p>
      </section>
    </div>
  );
}
