import type { Metadata } from "next";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getAdminSanityStatus } from "@/lib/admin/sanity-control";
import { getAdminOperationsRuntimeStatus } from "@/lib/admin/operations/foundation";
import { resolveArticleSchedulerLane } from "@/lib/admin/operations/article-schedule-contract";
import { readArticleSchedulerModel } from "@/lib/admin/operations/article-scheduler-read-model";
import { getSocialFoundationRuntimeStatus } from "@/lib/admin/social/foundation";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { readLineKeyRotationStatus } from "@/lib/admin/line/key-rotation";
import {
  readLineDeliveryHealth,
  readLineOperationsHealth,
  readPrivacySafetyHealth,
} from "@/lib/admin/line/business-intelligence";
import {
  getLineProviderActivationReadiness,
  readLineDocumentMediaHealth,
} from "@/lib/admin/line/document-media";
import { getLineMediaProviderReadiness } from "@/lib/admin/line/media-provider";
import { readLineArchiveHealth } from "@/lib/admin/line/conversation-archive";

export const metadata: Metadata = { title: "System Health" };

type HealthState = "ok" | "warning" | "off";

function badge(state: HealthState) {
  const style = state === "ok"
    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
    : state === "warning"
      ? "border-amber-200/20 bg-amber-200/10 text-amber-50"
      : "border-white/10 bg-white/[0.04] text-white/60";
  const label = state === "ok" ? "พร้อม" : state === "warning" ? "ต้องตรวจ" : "ยังไม่เปิด";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${style}`}>{label}</span>;
}

function Card({ title, state, children }: { title: string; state: HealthState; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-white/90">{title}</h2>
        {badge(state)}
      </div>
      <div className="mt-4 space-y-2 text-sm leading-6 text-white/65">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[150px_minmax(0,1fr)]">
      <span className="text-white/45">{label}</span>
      <span className="break-all text-white/75">{value}</span>
    </div>
  );
}

export default async function AdminHealthPage() {
  await requireAdminPermission("settings:read");

  const sanity = getAdminSanityStatus();
  const operations = getAdminOperationsRuntimeStatus();
  const schedulerLane = resolveArticleSchedulerLane(process.env);
  const scheduler = await readArticleSchedulerModel({ scheduleLimit: 10, auditLimit: 10 });
  const socialFoundation = getSocialFoundationRuntimeStatus();
  const socialOperations = getSocialOperationsRuntimeStatus();
  const [lineKeyRotation, lineOperations, lineDocumentMedia, lineDelivery, privacySafety, lineArchive] = await Promise.all([
    readLineKeyRotationStatus(),
    readLineOperationsHealth(),
    readLineDocumentMediaHealth(),
    readLineDeliveryHealth(),
    readPrivacySafetyHealth(),
    readLineArchiveHealth(),
  ]);
  const lineProviderActivation = getLineProviderActivationReadiness();
  const lineMediaProvider = getLineMediaProviderReadiness();

  const vercelEnvironment = process.env.VERCEL_ENV ?? "—";
  const gitBranch = process.env.VERCEL_GIT_COMMIT_REF ?? "—";
  const gitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "—";
  const region = process.env.VERCEL_REGION ?? "—";
  const productionRuntime = process.env.CCPUN_APP_ENV === "production-admin";
  const vercelState: HealthState = productionRuntime
    ? vercelEnvironment === "production" && gitBranch === "v4-production" ? "ok" : "warning"
    : vercelEnvironment === "preview" ? "ok" : "warning";
  const operationsState: HealthState = operations.identityValid ? "ok" : operations.configured ? "warning" : "off";
  const sanityState: HealthState = sanity.readReady ? (sanity.writeReady ? "ok" : "warning") : "warning";
  const schedulerState: HealthState = !schedulerLane
    ? "off"
    : scheduler.status === "ready" && scheduler.effectiveEnabled
      ? "ok"
      : "warning";
  const socialState: HealthState = socialOperations.enabled || socialFoundation.enabled ? "ok" : "off";
  const lineKeyRotationState: HealthState = lineKeyRotation.state !== "ready"
    ? "off"
    : lineKeyRotation.unsupportedVersionCount > 0 || lineKeyRotation.encryptedUnsentCount > 0
      ? "warning"
      : lineKeyRotation.activeVersion === "2" && lineKeyRotation.v2Configured
        ? "ok"
        : "warning";
  const lineOperationsState: HealthState = lineOperations.state !== "ready"
    ? "off"
    : lineOperations.outboundReconciliation > 0 || lineOperations.campaignReconciliation > 0 || lineOperations.automaticDeleteEnabled
      ? "warning"
      : "ok";
  const lineDocumentMediaState: HealthState = lineDocumentMedia.state !== "ready"
    ? "off"
    : lineDocumentMedia.driveFolderUnsafe > 0
      || lineDocumentMedia.reconciliationRequired > 0
      || !lineDocumentMedia.webRuntimeActiveV2
      || !lineDocumentMedia.webRuntimeLazyRotationEnabled
      ? "warning"
      : "ok";
  const lineDeliveryState: HealthState = lineDelivery.state !== "ready"
    ? "off"
    : lineDelivery.outboundDeadLetter > 0
      || lineDelivery.outboundReconciliation > 0
      || lineDelivery.campaignDeadLetter > 0
      || lineDelivery.campaignReconciliation > 0
      ? "warning"
      : "ok";
  const privacySafetyState: HealthState = privacySafety.state !== "ready"
    ? "off"
    : privacySafety.automaticDeleteEnabled
      || privacySafety.destructiveExecutionAvailable
      ? "warning"
      : "ok";
  const lineArchiveState: HealthState = lineArchive.state !== "ready"
    ? "off"
    : lineArchive.directAdminReplyEnabled
      ? "warning"
      : "ok";

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">OWNER DIAGNOSTICS</p>
      <h1 className="mt-2 text-3xl font-semibold">System Health</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
        ดูว่า Admin กำลังรันบน deployment ไหน เชื่อม Sanity และ private operational database ถูก lane หรือไม่ รวมถึงสถานะระบบ Schedule และ Social โดยไม่แสดง credential หรือ secret ใด ๆ
      </p>

      <div className="mt-7 grid gap-4 xl:grid-cols-2">
        <Card title="Vercel Runtime" state={vercelState}>
          <Row label="Environment" value={vercelEnvironment} />
          <Row label="Git branch" value={gitBranch} />
          <Row label="Commit" value={gitSha} />
          <Row label="Region" value={region} />
          <p className="pt-2 text-white/50">หน้านี้ตอบจาก deployment ปัจจุบันโดยตรง จึงใช้ตรวจ branch / commit / runtime lane ได้โดยไม่ต้องให้ Admin ถือ Vercel API token</p>
        </Card>

        <Card title="Sanity Editorial Data" state={sanityState}>
          <Row label="Project" value={sanity.projectId ?? "—"} />
          <Row label="Dataset" value={sanity.dataset ?? "—"} />
          <Row label="Read" value={sanity.readReady ? "พร้อม" : "ไม่พร้อม"} />
          <Row label="Draft write" value={sanity.writeReady ? "พร้อม" : "ไม่พร้อม"} />
        </Card>

        <Card title="Control Plane Operations" state={operationsState}>
          <Row label="Lane" value={operations.lane ?? "—"} />
          <Row label="Neon project" value={operations.projectId ?? "—"} />
          <Row label="Branch" value={operations.branchId ?? "—"} />
          <Row label="Database" value={operations.database ?? "—"} />
          <Row label="Identity guard" value={operations.identityValid ? "ผ่าน" : operations.configured ? "ไม่ผ่าน" : "ยังไม่มี runtime credential"} />
          <Row label="Migration" value={operations.migrationVersion ?? "—"} />
          <p className="pt-2 text-white/50">ส่วนนี้เป็นแหล่งข้อมูลของประวัติการทำงาน, Research snapshots และข้อเสนอ SEO ที่รอตรวจ ไม่ใช่ Sanity editorial documents</p>
        </Card>

        <Card title="Article Scheduler" state={schedulerState}>
          <Row label="Lane" value={schedulerLane ?? "—"} />
          <Row label="Mode" value={scheduler.mode ?? "—"} />
          <Row label="Runtime switch" value={scheduler.runtimeEnabled ? "เปิด" : "ปิด"} />
          <Row label="Durable Neon switch" value={scheduler.status === "ready" ? scheduler.durableEnabled ? "เปิด" : "ปิด" : "อ่านไม่ได้"} />
          <Row label="Effective scheduling" value={scheduler.effectiveEnabled ? "พร้อมรับคิวใหม่" : "ยังไม่รับคิวใหม่"} />
          <Row label="Schedule records" value={scheduler.status === "ready" ? scheduler.schedules.length.toLocaleString("th-TH") : "—"} />
          <Row label="Audit records" value={scheduler.status === "ready" ? scheduler.audit.length.toLocaleString("th-TH") : "—"} />
          {scheduler.error ? <p className="pt-2 text-amber-100/80">Read error: {scheduler.error}</p> : null}
          <p className="pt-2 text-white/50">สถานะ “พร้อม” ต้องผ่านทั้ง runtime identity, runtime switch และ durable database switch พร้อมกัน การเปิด durable switch ต้องใช้ database-owner channel แยกจาก runtime credential</p>
        </Card>

        <Card title="LINE Encryption Rotation" state={lineKeyRotationState}>
          <Row label="Active version" value={`V${lineKeyRotation.activeVersion}`} />
          <Row label="V2 configured" value={lineKeyRotation.v2Configured ? "พร้อม" : "ยังไม่พร้อม"} />
          <Row label="Lazy rotation" value={lineKeyRotation.lazyRotationEnabled ? "เปิด" : "ปิด"} />
          {lineKeyRotation.state === "ready" ? <>
            <Row label="V1 remaining" value={lineKeyRotation.totalV1Count.toLocaleString("th-TH")} />
            <Row label="Rotatable V1" value={lineKeyRotation.rotatableV1Count.toLocaleString("th-TH")} />
            <Row label="Admin-only V1" value={lineKeyRotation.adminOnlyV1Count.toLocaleString("th-TH")} />
            <Row label="Unsupported" value={lineKeyRotation.unsupportedVersionCount.toLocaleString("th-TH")} />
            <Row label="Encrypted unsent" value={lineKeyRotation.encryptedUnsentCount.toLocaleString("th-TH")} />
            <Row label="V1 retirement" value={lineKeyRotation.allV1Zero ? "พร้อมตรวจขั้นสุดท้าย" : "ยังห้ามลบ V1"} />
          </> : <p className="text-white/50">aggregate rotation status ยังอ่านไม่ได้ โดยไม่ fallback ไปอ่าน private tables ตรง ๆ</p>}
          <p className="pt-2 text-white/50">แสดงเฉพาะจำนวนตาม key version ไม่มี customer ID, ciphertext หรือ plaintext และ V1 ห้ามลบจนกว่า V1 remaining = 0 พร้อมผ่าน verification ขั้นสุดท้าย</p>
        </Card>

        <Card title="LINE Runtime / Customer Media" state={lineDocumentMediaState}>
          {lineDocumentMedia.state === "ready" ? <>
            <Row label="Web active V2" value={lineDocumentMedia.webRuntimeActiveV2 ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"} />
            <Row label="Web V1 key" value={lineDocumentMedia.webRuntimeV1KeyPresent ? "พบ" : "ไม่พบ"} />
            <Row label="Web V2 key" value={lineDocumentMedia.webRuntimeV2KeyPresent ? "พบ" : "ไม่พบ"} />
            <Row label="Web lazy rotation" value={lineDocumentMedia.webRuntimeLazyRotationEnabled ? "เปิดจริง" : "ยังไม่ยืนยัน"} />
            <Row label="Web status report" value={lineDocumentMedia.webRuntimeLastReportedAt ?? "ยังไม่มี accepted ingress หลัง migration"} />
            <Row label="Drive folders ready" value={lineDocumentMedia.driveFolderReady.toLocaleString("th-TH")} />
            <Row label="Unsafe Drive folders" value={lineDocumentMedia.driveFolderUnsafe.toLocaleString("th-TH")} />
            <Row label="Media pending fetch" value={lineDocumentMedia.pendingFetch.toLocaleString("th-TH")} />
            <Row label="Media pending upload" value={lineDocumentMedia.pendingUpload.toLocaleString("th-TH")} />
            <Row label="Media stored" value={lineDocumentMedia.stored.toLocaleString("th-TH")} />
            <Row label="Media failed" value={lineDocumentMedia.failed.toLocaleString("th-TH")} />
            <Row label="Media revoke" value={lineDocumentMedia.revokeRequired.toLocaleString("th-TH")} />
            <Row label="Media reconcile" value={lineDocumentMedia.reconciliationRequired.toLocaleString("th-TH")} />
          </> : <p className="text-white/50">aggregate Web runtime / media status ยังอ่านไม่ได้ และระบบไม่ fallback ไปอ่าน customer tables ตรง ๆ</p>}
          <Row label="LINE token" value={lineProviderActivation.channelTokenPresent ? "มี credential" : "ยังไม่มี credential"} />
          <Row label="Media fetch gate" value={lineMediaProvider.fetchEnabled ? "เปิด" : "ปิด"} />
          <Row label="Outbound gate" value={lineProviderActivation.outboundWriteGateEnabled ? "เปิด" : "ปิด"} />
          <Row label="Rich Menu gate" value={lineProviderActivation.richMenuWriteGateEnabled ? "เปิด" : "ปิด"} />
          <Row label="Drive auth" value={lineProviderActivation.driveAuthorizationMode} />
          <Row label="Drive scope" value={lineProviderActivation.driveScope} />
          <Row label="Drive credential" value={lineProviderActivation.drivePersistentCredentialConfigured ? "persistent" : "memory-only / ยังไม่ authorize"} />
          <p className="pt-2 text-white/50">สถานะทั้งหมดเป็น boolean / aggregate เท่านั้น ไม่แสดง token, LINE identity, Drive file/folder ID, customer content หรือ raw provider error</p>
        </Card>

        <Card title="LINE Conversation Archive" state={lineArchiveState}>
          {lineArchive.state === "ready" ? <>
            <Row label="Archived messages" value={lineArchive.archivedMessageCount.toLocaleString("th-TH")} />
            <Row label="Retained Unsend" value={lineArchive.retainedUnsentCount.toLocaleString("th-TH")} />
            <Row label="OA imported replies" value={lineArchive.importedOutboundCount.toLocaleString("th-TH")} />
            <Row label="Cached LINE profiles" value={lineArchive.cachedProfileCount.toLocaleString("th-TH")} />
            <Row label="Evidence access" value={lineArchive.evidenceAccessCount.toLocaleString("th-TH")} />
            <Row label="Admin direct reply" value={lineArchive.directAdminReplyEnabled ? "เปิด — ต้องแก้" : "ปิด · ใช้ LINE OA Manager"} />
          </> : <p className="text-white/50">Conversation Archive aggregate ยังอ่านไม่ได้ และระบบไม่ fallback ไปอ่าน private archive tables ตรง ๆ</p>}
          <p className="pt-2 text-white/50">แสดงเฉพาะ aggregate counts; ชื่อ LINE, transcript, ciphertext และ evidence content ไม่ถูกนำมาแสดงบน System Health</p>
        </Card>

        <Card title="LINE Delivery / Dead Letter" state={lineDeliveryState}>
          {lineDelivery.state === "ready" ? <>
            <Row label="Outbound queued" value={lineDelivery.outboundQueued.toLocaleString("th-TH")} />
            <Row label="Outbound leased" value={lineDelivery.outboundLeased.toLocaleString("th-TH")} />
            <Row label="Outbound sent" value={lineDelivery.outboundSent.toLocaleString("th-TH")} />
            <Row label="Outbound retryable" value={lineDelivery.outboundRetryableFailed.toLocaleString("th-TH")} />
            <Row label="Outbound dead-letter" value={lineDelivery.outboundDeadLetter.toLocaleString("th-TH")} />
            <Row label="Outbound reconcile" value={lineDelivery.outboundReconciliation.toLocaleString("th-TH")} />
            <Row label="Campaign retryable" value={lineDelivery.campaignRetryableFailed.toLocaleString("th-TH")} />
            <Row label="Campaign dead-letter" value={lineDelivery.campaignDeadLetter.toLocaleString("th-TH")} />
            <Row label="Campaign reconcile" value={lineDelivery.campaignReconciliation.toLocaleString("th-TH")} />
          </> : <p className="text-white/50">delivery health ยังอ่านไม่ได้ และระบบไม่ fallback ไปอ่าน outbound/customer tables ตรง ๆ</p>}
          <p className="pt-2 text-white/50">retry อัตโนมัติเฉพาะ rate limit / provider unavailable; permanent 4xx, decrypt/key failure เป็น dead-letter และผล provider ที่คลุมเครือเข้า reconciliation โดยไม่ retry อัตโนมัติ</p>
        </Card>

        <Card title="LINE Business / Privacy Operations" state={lineOperationsState}>
          {lineOperations.state === "ready" ? <>
            <Row label="Outbound queued" value={lineOperations.outboundQueued.toLocaleString("th-TH")} />
            <Row label="Outbound failed" value={lineOperations.outboundFailed.toLocaleString("th-TH")} />
            <Row label="Outbound reconcile" value={lineOperations.outboundReconciliation.toLocaleString("th-TH")} />
            <Row label="Campaign queued" value={lineOperations.campaignQueued.toLocaleString("th-TH")} />
            <Row label="Campaign reconcile" value={lineOperations.campaignReconciliation.toLocaleString("th-TH")} />
            <Row label="Privacy pending" value={lineOperations.privacyPending.toLocaleString("th-TH")} />
            <Row label="Business events" value={lineOperations.businessEventCount.toLocaleString("th-TH")} />
            <Row label="Retention" value={lineOperations.retentionMode} />
            <Row label="Auto delete" value={lineOperations.automaticDeleteEnabled ? "เปิด" : "ปิด"} />
          </> : <p className="text-white/50">aggregate LINE operations status ยังอ่านไม่ได้</p>}
          <p className="pt-2 text-white/50">ส่วนนี้แสดงเฉพาะ counts/status ไม่มี request body, customer identity, ciphertext หรือ raw error และ retention default ไม่มี auto-delete</p>
        </Card>

        <Card title="Privacy / Retention Safety" state={privacySafetyState}>
          {privacySafety.state === "ready" ? <>
            <Row label="Retention mode" value={privacySafety.retentionMode} />
            <Row label="Auto delete" value={privacySafety.automaticDeleteEnabled ? "เปิด" : "ปิด"} />
            <Row label="Destructive execute" value={privacySafety.destructiveExecutionAvailable ? "เปิด" : "Human Gate เท่านั้น"} />
            <Row label="Attachment unsend" value={privacySafety.attachmentUnsendAction} />
            <Row label="Export manifests" value={privacySafety.preparedExportManifestCount.toLocaleString("th-TH")} />
            <Row label="Delete tombstones" value={privacySafety.preparedDeleteTombstoneCount.toLocaleString("th-TH")} />
            <Row label="Attachment cleanup" value={privacySafety.attachmentCleanupRequiredCount.toLocaleString("th-TH")} />
            <Row label="Backup / restore" value={privacySafety.backupRestoreEvidenceState} />
            <Row label="Key rotation evidence" value={privacySafety.keyRotationEvidenceState} />
          </> : <p className="text-white/50">privacy safety aggregate ยังอ่านไม่ได้</p>}
          <p className="pt-2 text-white/50">Backup/restore ไม่ถูก claim ว่าผ่านจาก runtime เอง ต้อง verify จาก provider/owner evidence แยก และไม่มี raw export/delete content บน health surface นี้</p>
        </Card>

        <Card title="Social / Distribution" state={socialState}>
          <Row label="Foundation" value={socialFoundation.enabled ? "เปิด" : "ปิด"} />
          <Row label="Operations" value={socialOperations.enabled ? "เปิด" : "ปิด"} />
        </Card>
      </div>
    </div>
  );
}
