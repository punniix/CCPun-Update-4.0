import type { Metadata } from "next";
import { LineProviderActivationActions } from "@/features/admin/line/LineProviderActivationActions";
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
import { getLineSystemDeliveryProviderReadiness } from "@/lib/admin/line/provider";
import { lineRetentionModeLabel, lineTechnicalStateLabel } from "@/lib/admin/line/presentation";
import { readLineArchiveHealth } from "@/lib/admin/line/conversation-archive";
import { readDefaultLineRichMenuStatus } from "@/lib/admin/line/rich-menu-provider";
import { readLineSystemDeliveryDatabaseReadiness } from "@/lib/admin/line/control-plane";
import { readLineRichMenuControlState } from "@/lib/admin/control-plane/provider-state";

export const metadata: Metadata = { title: "สถานะระบบ" };

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
  const [
    lineKeyRotation,
    lineOperations,
    lineDocumentMedia,
    lineDelivery,
    privacySafety,
    lineArchive,
    lineRichMenu,
    lineSystemDeliveryDatabase,
    lineRichMenuControl,
  ] = await Promise.all([
    readLineKeyRotationStatus(),
    readLineOperationsHealth(),
    readLineDocumentMediaHealth(),
    readLineDeliveryHealth(),
    readPrivacySafetyHealth(),
    readLineArchiveHealth(),
    readDefaultLineRichMenuStatus(),
    readLineSystemDeliveryDatabaseReadiness(),
    readLineRichMenuControlState().catch(() => null),
  ]);
  const lineProviderActivation = getLineProviderActivationReadiness();
  const lineMediaProvider = getLineMediaProviderReadiness();
  const lineSystemDeliveryProvider = getLineSystemDeliveryProviderReadiness();

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
      <h1 className="mt-2 text-3xl font-semibold">สถานะระบบ</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
        ดูว่า Admin กำลังรันบน deployment ไหน เชื่อม Sanity และ private operational database ถูก lane หรือไม่ รวมถึงสถานะระบบ Schedule และ Social โดยไม่แสดง credential หรือ secret ใด ๆ
      </p>

      <div className="mt-7">
        <LineProviderActivationActions
          richMenuState={lineRichMenu.state}
          richMenuReady={
            lineProviderActivation.channelTokenPresent
            && lineProviderActivation.richMenuWriteGateEnabled
            && lineSystemDeliveryProvider.enabled
            && lineSystemDeliveryProvider.tokenPresent
            && lineSystemDeliveryProvider.cryptoReady
            && lineSystemDeliveryDatabase.ready
          }
          systemDeliveryReady={
            lineSystemDeliveryProvider.enabled
            && lineSystemDeliveryProvider.tokenPresent
            && lineSystemDeliveryProvider.cryptoReady
            && lineSystemDeliveryDatabase.ready
          }
          driveInteractiveReady={lineProviderActivation.driveInteractiveConfigReady}
          pendingFileCount={lineDocumentMedia.state === "ready" ? lineDocumentMedia.pendingFetch + lineDocumentMedia.pendingUpload : 0}
          controlState={lineRichMenuControl ? {
            desiredMode: lineRichMenuControl.desiredMode,
            state: lineRichMenuControl.state,
            rowVersion: lineRichMenuControl.rowVersion,
            rollbackAvailable: Boolean(lineRichMenuControl.approvedPreviousHash),
          } : null}
        />
      </div>

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

        <Card title="ความพร้อมของการเข้ารหัส LINE" state={lineKeyRotationState}>
          <Row label="เวอร์ชันที่ใช้อยู่" value={`V${lineKeyRotation.activeVersion}`} />
          <Row label="กุญแจรุ่นล่าสุด" value={lineKeyRotation.v2Configured ? "พร้อม" : "ยังไม่พร้อม"} />
          <Row label="อัปเดตกุญแจอัตโนมัติ" value={lineKeyRotation.lazyRotationEnabled ? "เปิด" : "ปิด"} />
          {lineKeyRotation.state === "ready" ? <>
            <Row label="ข้อมูลรุ่นเก่าที่ยังเหลือ" value={lineKeyRotation.totalV1Count.toLocaleString("th-TH")} />
            <Row label="รายการที่ยังอัปเดตได้" value={lineKeyRotation.rotatableV1Count.toLocaleString("th-TH")} />
            <Row label="รายการหลังบ้านที่ยังเป็นรุ่นเก่า" value={lineKeyRotation.adminOnlyV1Count.toLocaleString("th-TH")} />
            <Row label="รายการที่ระบบไม่รองรับ" value={lineKeyRotation.unsupportedVersionCount.toLocaleString("th-TH")} />
            <Row label="ข้อความที่ยกเลิกแต่ยังเข้ารหัสอยู่" value={lineKeyRotation.encryptedUnsentCount.toLocaleString("th-TH")} />
            <Row label="ถอดกุญแจรุ่นเก่าได้หรือยัง" value={lineKeyRotation.allV1Zero ? "พร้อมตรวจขั้นสุดท้าย" : "ยังไม่ควรถอด"} />
          </> : <p className="text-white/50">ตอนนี้ยังตรวจสถานะการเข้ารหัสไม่ได้</p>}
          <p className="pt-2 text-white/50">หน้านี้แสดงเฉพาะจำนวนรวม ไม่แสดงข้อความ ชื่อลูกค้า หรือค่ากุญแจเข้ารหัส</p>
        </Card>

        <Card title="LINE และไฟล์ลูกค้า" state={lineDocumentMediaState}>
          {lineDocumentMedia.state === "ready" ? <>
            <Row label="การเข้ารหัสล่าสุด" value={lineDocumentMedia.webRuntimeActiveV2 ? "ใช้งานอยู่" : "ยังไม่ยืนยัน"} />
            <Row label="กุญแจรุ่นเดิม" value={lineDocumentMedia.webRuntimeV1KeyPresent ? "ยังเก็บไว้สำหรับความเข้ากันได้" : "ไม่พบ"} />
            <Row label="กุญแจรุ่นล่าสุด" value={lineDocumentMedia.webRuntimeV2KeyPresent ? "พร้อม" : "ไม่พบ"} />
            <Row label="อัปเดตข้อมูลเก่าอัตโนมัติ" value={lineDocumentMedia.webRuntimeLazyRotationEnabled ? "เปิด" : "ปิด"} />
            <Row label="ตรวจล่าสุด" value={lineDocumentMedia.webRuntimeLastReportedAt ?? "ยังไม่มีข้อมูลล่าสุด"} />
            <Row label="โฟลเดอร์ลูกค้าที่พร้อมใช้" value={lineDocumentMedia.driveFolderReady.toLocaleString("th-TH")} />
            <Row label="โฟลเดอร์ที่ต้องตรวจสิทธิ์" value={lineDocumentMedia.driveFolderUnsafe.toLocaleString("th-TH")} />
            <Row label="กำลังรับไฟล์จาก LINE" value={lineDocumentMedia.pendingFetch.toLocaleString("th-TH")} />
            <Row label="กำลังเก็บไฟล์" value={lineDocumentMedia.pendingUpload.toLocaleString("th-TH")} />
            <Row label="เก็บไฟล์แล้ว" value={lineDocumentMedia.stored.toLocaleString("th-TH")} />
            <Row label="ไฟล์ที่ยังเก็บไม่สำเร็จ" value={lineDocumentMedia.failed.toLocaleString("th-TH")} />
            <Row label="ไฟล์ที่รอลบหลังลูกค้ายกเลิก" value={lineDocumentMedia.revokeRequired.toLocaleString("th-TH")} />
            <Row label="รายการที่ต้องเช็กเพิ่ม" value={lineDocumentMedia.reconciliationRequired.toLocaleString("th-TH")} />
          </> : <p className="text-white/50">ตอนนี้ยังตรวจสถานะไฟล์ลูกค้าไม่ได้</p>}
          <Row label="เชื่อม LINE" value={lineProviderActivation.channelTokenPresent ? "พร้อม" : "ยังไม่ได้เชื่อม"} />
          <Row label="รับไฟล์อัตโนมัติ" value={lineMediaProvider.fetchEnabled ? "เปิด" : "ปิด"} />
          <Row
            label="Article Cards อัตโนมัติ"
            value={
              lineSystemDeliveryProvider.enabled
              && lineSystemDeliveryProvider.tokenPresent
              && lineSystemDeliveryProvider.cryptoReady
              && lineSystemDeliveryDatabase.ready
                ? "พร้อม"
                : lineSystemDeliveryDatabase.ready
                  ? "ยังไม่เปิด provider"
                  : "ยังไม่พร้อมที่ฐานข้อมูล"
            }
          />
          <Row label="ตอบลูกค้าจาก Admin" value={lineProviderActivation.outboundWriteGateEnabled ? "เปิด — ควรตรวจ" : "ปิด · ใช้ LINE OA"} />
          <Row
            label="Rich Menu"
            value={
              lineRichMenu.state === "active_v3"
                ? "เปิดใช้งานแล้ว"
                : lineRichMenu.state === "active_other"
                  ? "มีเมนูอื่นใช้อยู่"
                  : lineRichMenu.state === "provider_unavailable"
                    ? "ตรวจสถานะจาก LINE ไม่ได้"
                    : lineProviderActivation.richMenuWriteGateEnabled
                      ? "พร้อมให้เจ้าของเปิด"
                      : "ยังปิดอยู่"
            }
          />
          <Row
            label="Google Drive"
            value={lineProviderActivation.driveInteractiveConfigReady ? "พร้อมขออนุญาตเมื่อมีไฟล์" : "ยังต้องตั้งค่า"}
          />
          <p className="pt-2 text-white/50">ข้อมูลลูกค้าและไฟล์จริงจะไม่แสดงบนหน้านี้</p>
        </Card>

        <Card title="ประวัติการคุย LINE" state={lineArchiveState}>
          {lineArchive.state === "ready" ? <>
            <Row label="ข้อความที่เก็บไว้" value={lineArchive.archivedMessageCount.toLocaleString("th-TH")} />
            <Row label="ข้อความที่ลูกค้ายกเลิกแต่ยังมีหลักฐาน" value={lineArchive.retainedUnsentCount.toLocaleString("th-TH")} />
            <Row label="ข้อความที่นำเข้าจาก LINE OA" value={lineArchive.importedOutboundCount.toLocaleString("th-TH")} />
            <Row label="รายชื่อลูกค้าที่ดึงชื่อจาก LINE แล้ว" value={lineArchive.cachedProfileCount.toLocaleString("th-TH")} />
            <Row label="จำนวนครั้งที่เปิดหลักฐาน" value={lineArchive.evidenceAccessCount.toLocaleString("th-TH")} />
            <Row label="ตอบลูกค้าจาก Admin" value={lineArchive.directAdminReplyEnabled ? "เปิด — ต้องตรวจ" : "ปิด · ใช้ LINE OA ตามเดิม"} />
          </> : <p className="text-white/50">ตอนนี้ยังตรวจสถานะประวัติการคุยไม่ได้</p>}
          <p className="pt-2 text-white/50">หน้านี้แสดงเฉพาะจำนวนรวม ไม่แสดงชื่อหรือข้อความของลูกค้า</p>
        </Card>

        <Card title="งานส่งข้อความจากระบบ" state={lineDeliveryState}>
          {lineDelivery.state === "ready" ? <>
            <Row label="รอส่ง" value={lineDelivery.outboundQueued.toLocaleString("th-TH")} />
            <Row label="กำลังดำเนินการ" value={lineDelivery.outboundLeased.toLocaleString("th-TH")} />
            <Row label="ส่งแล้ว" value={lineDelivery.outboundSent.toLocaleString("th-TH")} />
            <Row label="รอลองใหม่" value={lineDelivery.outboundRetryableFailed.toLocaleString("th-TH")} />
            <Row label="ต้องตรวจเอง" value={lineDelivery.outboundDeadLetter.toLocaleString("th-TH")} />
            <Row label="สถานะยังไม่ชัด" value={lineDelivery.outboundReconciliation.toLocaleString("th-TH")} />
            <Row label="ข้อความกลุ่มที่รอลองใหม่" value={lineDelivery.campaignRetryableFailed.toLocaleString("th-TH")} />
            <Row label="ข้อความกลุ่มที่ต้องตรวจเอง" value={lineDelivery.campaignDeadLetter.toLocaleString("th-TH")} />
            <Row label="ข้อความกลุ่มที่สถานะยังไม่ชัด" value={lineDelivery.campaignReconciliation.toLocaleString("th-TH")} />
          </> : <p className="text-white/50">ตอนนี้ยังตรวจสถานะงานส่งข้อความไม่ได้</p>}
          <p className="pt-2 text-white/50">ระบบจะลองใหม่เฉพาะกรณีที่ปลอดภัย ถ้าสถานะไม่ชัดจะหยุดไว้ให้ตรวจ ไม่ส่งซ้ำเอง</p>
        </Card>

        <Card title="งานหลังบ้านของ LINE" state={lineOperationsState}>
          {lineOperations.state === "ready" ? <>
            <Row label="ข้อความที่รอส่ง" value={lineOperations.outboundQueued.toLocaleString("th-TH")} />
            <Row label="ข้อความที่ส่งยังไม่สำเร็จ" value={lineOperations.outboundFailed.toLocaleString("th-TH")} />
            <Row label="ข้อความที่ต้องเช็กสถานะ" value={lineOperations.outboundReconciliation.toLocaleString("th-TH")} />
            <Row label="ข้อความกลุ่มที่รอส่ง" value={lineOperations.campaignQueued.toLocaleString("th-TH")} />
            <Row label="ข้อความกลุ่มที่ต้องเช็กสถานะ" value={lineOperations.campaignReconciliation.toLocaleString("th-TH")} />
            <Row label="คำขอเรื่องข้อมูลที่รอตรวจ" value={lineOperations.privacyPending.toLocaleString("th-TH")} />
            <Row label="กิจกรรมธุรกิจที่บันทึกไว้" value={lineOperations.businessEventCount.toLocaleString("th-TH")} />
            <Row label="การเก็บข้อมูล" value={lineRetentionModeLabel(lineOperations.retentionMode)} />
            <Row label="ลบข้อมูลอัตโนมัติ" value={lineOperations.automaticDeleteEnabled ? "เปิด" : "ปิด"} />
          </> : <p className="text-white/50">ตอนนี้ยังตรวจสถานะงานหลังบ้านของ LINE ไม่ได้</p>}
          <p className="pt-2 text-white/50">หน้านี้แสดงเฉพาะจำนวนรวม ไม่แสดงข้อมูลส่วนตัวของลูกค้า</p>
        </Card>

        <Card title="ความปลอดภัยของข้อมูลลูกค้า" state={privacySafetyState}>
          {privacySafety.state === "ready" ? <>
            <Row label="วิธีเก็บข้อมูล" value={lineRetentionModeLabel(privacySafety.retentionMode)} />
            <Row label="ลบข้อมูลอัตโนมัติ" value={privacySafety.automaticDeleteEnabled ? "เปิด" : "ปิด"} />
            <Row label="ลบข้อมูลจริงจากหน้านี้" value={privacySafety.destructiveExecutionAvailable ? "เปิด — ต้องตรวจ" : "ทำไม่ได้ · ต้องยืนยันแยก"} />
            <Row label="ไฟล์ที่ลูกค้ายกเลิก" value="ยกเลิกการเข้าถึง แล้วลบไฟล์" />
            <Row label="คำขอสำเนาข้อมูลที่เตรียมไว้" value={privacySafety.preparedExportManifestCount.toLocaleString("th-TH")} />
            <Row label="คำขอลบข้อมูลที่เตรียมไว้" value={privacySafety.preparedDeleteTombstoneCount.toLocaleString("th-TH")} />
            <Row label="ไฟล์ที่ยังต้องจัดการ" value={privacySafety.attachmentCleanupRequiredCount.toLocaleString("th-TH")} />
            <Row label="การสำรองและกู้คืนข้อมูล" value={lineTechnicalStateLabel(privacySafety.backupRestoreEvidenceState)} />
            <Row label="หลักฐานการเปลี่ยนกุญแจเข้ารหัส" value={lineTechnicalStateLabel(privacySafety.keyRotationEvidenceState)} />
          </> : <p className="text-white/50">ตอนนี้ยังตรวจสถานะความปลอดภัยของข้อมูลไม่ได้</p>}
          <p className="pt-2 text-white/50">การลบข้อมูลจริงและการกู้คืนข้อมูลยังต้องมีการตรวจยืนยันจากเจ้าของระบบแยกต่างหาก</p>
        </Card>

        <Card title="Social / Distribution" state={socialState}>
          <Row label="Foundation" value={socialFoundation.enabled ? "เปิด" : "ปิด"} />
          <Row label="Operations" value={socialOperations.enabled ? "เปิด" : "ปิด"} />
        </Card>
      </div>
    </div>
  );
}
