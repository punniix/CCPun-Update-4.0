import type { Metadata } from "next";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getAdminSanityStatus } from "@/lib/admin/sanity-control";
import { getAdminOperationsRuntimeStatus } from "@/lib/admin/operations/foundation";
import { resolveArticleSchedulerLane } from "@/lib/admin/operations/article-schedule-contract";
import { getSocialFoundationRuntimeStatus } from "@/lib/admin/social/foundation";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";

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
  const socialFoundation = getSocialFoundationRuntimeStatus();
  const socialOperations = getSocialOperationsRuntimeStatus();

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
  const schedulerState: HealthState = schedulerLane ? (process.env.CCPUN_ARTICLE_SCHEDULING_ENABLED === "1" ? "ok" : "warning") : "off";
  const socialState: HealthState = socialOperations.enabled || socialFoundation.enabled ? "ok" : "off";

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
          <Row label="Switch" value={process.env.CCPUN_ARTICLE_SCHEDULING_ENABLED === "1" ? "เปิด" : "ปิด"} />
          <p className="pt-2 text-white/50">การขึ้นว่า “พร้อม” หมายถึง runtime identity และ durable switch ตรง lane เท่านั้น ไม่ได้สั่ง Publish บทความใด ๆ</p>
        </Card>

        <Card title="Social / Distribution" state={socialState}>
          <Row label="Foundation" value={socialFoundation.enabled ? "เปิด" : "ปิด"} />
          <Row label="Operations" value={socialOperations.enabled ? "เปิด" : "ปิด"} />
        </Card>
      </div>
    </div>
  );
}
