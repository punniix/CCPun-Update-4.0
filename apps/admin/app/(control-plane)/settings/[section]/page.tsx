import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getAdminDeploymentIdentity, getAdminEnvironment } from "@/lib/admin/environment";
import { ADMIN_PERMISSIONS, hasAdminPermission, type AdminRole } from "@/lib/admin/rbac";
import { getAdminSanityStatus } from "@/lib/admin/sanity-control";
import { getAdminOperationsRuntimeStatus } from "@/lib/admin/operations/foundation";
import { readArticleSchedulerModel } from "@/lib/admin/operations/article-scheduler-read-model";
import { getSeoGoogleProviderReadiness } from "@/lib/admin/seo-intelligence/provider-readiness";
import { getSocialProviderReadiness } from "@/lib/admin/social/provider-readonly";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { environmentLabel, roleLabel } from "@/lib/admin/presentation";
import { readLineDiscoveryAdminModel } from "@/lib/admin/line/discovery-config";
import { N8N_ADMIN_INTEGRATIONS, N8N_ADMIN_STATUS_LABEL, n8nAdminIntegrationSummary } from "@/lib/admin/n8n-integration-registry";
import LineDiscoveryManager from "@/features/admin/line/LineDiscoveryManager";

function State({ ok, yes = "พร้อม", no = "ต้องตั้งค่า" }: { ok: boolean; yes?: string; no?: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${ok ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-amber-200/20 bg-amber-200/10 text-amber-50"}`}>{ok ? yes : no}</span>;
}

function Row({ label, value, state }: { label: string; value: string; state?: boolean }) {
  return <div className="flex min-h-12 items-center justify-between gap-4 border-t border-white/10 py-3 first:border-t-0"><div><p className="text-sm font-medium text-white/85">{label}</p><p className="mt-1 text-xs text-white/45">{value}</p></div>{state === undefined ? null : <State ok={state} />}</div>;
}

async function IntegrationsPage() {
  const sanity = getAdminSanityStatus();
  const operations = getAdminOperationsRuntimeStatus();
  const scheduler = await readArticleSchedulerModel({ scheduleLimit: 1, auditLimit: 1 });
  const social = getSocialOperationsRuntimeStatus();
  const gsc = getSeoGoogleProviderReadiness("gsc");
  const ga4 = getSeoGoogleProviderReadiness("ga4");
  const meta = getSocialProviderReadiness("meta");
  const youtube = getSocialProviderReadiness("youtube");
  const tiktok = getSocialProviderReadiness("tiktok");
  const lineDiscovery = await readLineDiscoveryAdminModel();
  const n8nSummary = n8nAdminIntegrationSummary();

  return <div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ตั้งค่า</p><h1 className="mt-2 text-3xl font-semibold">การเชื่อมต่อ</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">ตรวจว่าระบบเชื่อมต่อบริการที่จำเป็นพร้อมหรือไม่ โดยไม่แสดงรหัสลับหรือข้อมูลเข้าสู่ระบบ</p>
    <div className="mt-7 grid gap-5 xl:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"><h2 className="text-lg font-semibold">ข้อมูลหลักของระบบ</h2><div className="mt-3"><Row label="เนื้อหาใน Sanity" value={sanity.readReady ? "อ่านข้อมูลได้" : "ยังอ่านข้อมูลไม่ได้"} state={sanity.readReady} /><Row label="ข้อมูลส่วนตัวและประวัติ" value={operations.identityValid ? "เชื่อมต่อฐานข้อมูลชุดที่ถูกต้อง" : "ยังยืนยันการเชื่อมต่อไม่ได้"} state={operations.identityValid} /><Row label="การตั้งเวลาเผยแพร่บทความ" value={scheduler.effectiveEnabled ? "พร้อมรับคิวใหม่" : "ยังไม่รับคิวใหม่"} state={scheduler.effectiveEnabled} /><Row label="งานโซเชียล" value={social.enabled ? "พร้อมใช้งาน" : "ยังไม่เปิดใช้งาน"} state={social.enabled} /></div></section>
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"><h2 className="text-lg font-semibold">การค้นหาและผลลัพธ์</h2><div className="mt-3"><Row label="Google Search Console" value="ดึงข้อมูลเมื่อผู้ใช้สั่ง และไม่แก้ข้อมูลต้นทาง" state={gsc.status === "manual-sync-ready"} /><Row label="Google Analytics 4" value="ดึงข้อมูลเมื่อผู้ใช้สั่ง และไม่แก้ข้อมูลต้นทาง" state={ga4.status === "manual-sync-ready"} /></div><div className="mt-4 flex flex-wrap gap-2"><Link href="/analytics/search/" className="glass-button-sm inline-flex min-h-11 items-center text-sm text-white">ดูผลการค้นหา</Link><Link href="/seo/opportunities/" className="glass-button-sm inline-flex min-h-11 items-center text-sm text-white">ดูโอกาสพัฒนา SEO</Link></div></section>
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 xl:col-span-2"><h2 className="text-lg font-semibold">บัญชีโซเชียล</h2><div className="mt-3 grid gap-x-6 md:grid-cols-3"><Row label="Meta" value="พร้อมอ่านข้อมูล Facebook Page และ Instagram" state={meta.status === "manual-sync-ready"} /><Row label="YouTube" value="พร้อมอ่านข้อมูลเมื่อผู้ใช้สั่ง" state={youtube.status === "manual-sync-ready"} /><Row label="TikTok" value="พร้อมอ่านข้อมูลเมื่อผู้ใช้สั่ง" state={tiktok.status === "manual-sync-ready"} /></div><div className="mt-4 flex flex-wrap gap-2"><Link href="/social/accounts/" className="glass-button-sm inline-flex min-h-11 items-center text-sm text-white">ดูบัญชีที่เชื่อมต่อ</Link><Link href="/operations/health/" className="glass-button-sm inline-flex min-h-11 items-center text-sm text-white">ดูภาพรวมระบบ</Link></div></section>
    </div>
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">n8n Integration Registry</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-white/55">ดูว่า workflow ไหนมี owner-facing entry point ใน Admin แล้ว และ workflow ไหนควรเป็น background หรือยังต้องเชื่อมต่อ หน้านี้อ้างอิง code contract ไม่ใช่สถานะ Active/Inactive สดจาก n8n</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-white/55">
          <span className="rounded-full border border-white/10 px-2.5 py-1">มีปุ่ม {n8nSummary["admin-trigger"]}</span>
          <span className="rounded-full border border-amber-200/20 bg-amber-200/5 px-2.5 py-1 text-amber-50">ยังไม่มีปุ่ม {n8nSummary.unconnected}</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">Background {n8nSummary.background}</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">Test {n8nSummary["test-only"]}</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">Legacy {n8nSummary.legacy}</span>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-[1050px] w-full text-left">
          <thead className="bg-black/15 text-xs text-white/45"><tr><th className="px-4 py-3">Workflow</th><th className="px-4 py-3">สถานะใน Admin</th><th className="px-4 py-3">ทางเข้า</th><th className="px-4 py-3">หน้าที่</th><th className="px-4 py-3">ควรทำต่อ</th></tr></thead>
          <tbody>{N8N_ADMIN_INTEGRATIONS.map((item) => <tr key={item.workflowId} className="border-t border-white/10 align-top">
            <td className="px-4 py-4"><div className="text-sm font-medium text-white/85">{item.workflowName}</div><div className="mt-1 font-mono text-[11px] text-white/35">{item.workflowId}</div>{item.sourceControlled ? <div className="mt-1 text-[11px] text-emerald-200/70">มี source artifact ใน repo</div> : null}</td>
            <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs ${item.status === "admin-trigger" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : item.status === "unconnected" ? "border-amber-200/20 bg-amber-200/10 text-amber-50" : "border-white/10 bg-white/[0.04] text-white/60"}`}>{N8N_ADMIN_STATUS_LABEL[item.status]}</span></td>
            <td className="px-4 py-4 text-sm text-white/60">{item.adminPath ? <Link href={item.adminPath} className="text-[#e0c985] hover:underline">{item.adminEntry ?? "ดูใน Admin"}</Link> : item.adminEntry ?? "—"}</td>
            <td className="px-4 py-4 text-sm leading-6 text-white/60">{item.purpose}</td>
            <td className="px-4 py-4 text-sm leading-6 text-white/60">{item.recommendation}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-5 text-white/40">“ยังไม่มีปุ่มใน Admin” หมายถึงยังไม่มี owner-facing entry point ที่ชัดเจน ไม่ได้หมายความว่า workflow เสีย</p>
    </section>
    <LineDiscoveryManager initialModel={lineDiscovery} />
  </div>;
}

async function AccessPage() {
  const session = await auth();
  const role = (session?.user?.role ?? null) as AdminRole | null;
  const permissions = ADMIN_PERMISSIONS.filter((permission) => hasAdminPermission(role, permission));
  return <div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ตั้งค่า</p><h1 className="mt-2 text-3xl font-semibold">สิทธิ์ผู้ใช้</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">ดูบัญชีและขอบเขตงานที่เปิดให้ใช้ หน้านี้ดูข้อมูลได้อย่างเดียว หากต้องเปลี่ยนสิทธิ์ให้เจ้าของระบบเป็นผู้ดำเนินการ</p>
    <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6"><dl className="grid gap-5 sm:grid-cols-3"><div><dt className="text-xs text-white/45">บัญชี</dt><dd className="mt-1 break-all text-sm text-white/85">{session?.user?.email ?? "—"}</dd></div><div><dt className="text-xs text-white/45">บทบาท</dt><dd className="mt-1 text-sm text-white/85">{role ? roleLabel(role) : "—"}</dd></div><div><dt className="text-xs text-white/45">ระบบที่กำลังใช้</dt><dd className="mt-1 text-sm text-white/85">{environmentLabel(getAdminEnvironment())}</dd></div></dl></section>
    <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6"><h2 className="text-lg font-semibold">สิทธิ์ที่ใช้งานได้</h2><p className="mt-2 text-sm text-white/60">เปิดใช้ {permissions.length.toLocaleString("th-TH")} สิทธิ์ตามบทบาทปัจจุบัน</p><details className="mt-4 rounded-2xl border border-white/10 p-4"><summary className="cursor-pointer text-sm text-white/75">ดูรหัสสิทธิ์สำหรับตรวจสอบ</summary><div className="mt-4 flex flex-wrap gap-2">{permissions.map((permission) => <span key={permission} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-white/65">{permission}</span>)}</div></details></section>
  </div>;
}

async function SystemPage() {
  const deployment = getAdminDeploymentIdentity();
  const sanity = getAdminSanityStatus();
  const operations = getAdminOperationsRuntimeStatus();
  const scheduler = await readArticleSchedulerModel({ scheduleLimit: 1, auditLimit: 1 });
  return <div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ตั้งค่า</p><h1 className="mt-2 text-3xl font-semibold">ข้อมูลระบบ</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">ดูว่าระบบกำลังใช้ข้อมูลชุดใดและพร้อมทำงานหรือไม่ หน้านี้ดูข้อมูลได้อย่างเดียวและไม่แสดงรหัสลับ</p>
    <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6"><div><Row label="เนื้อหาใน Sanity" value={sanity.readReady ? "พร้อมอ่านข้อมูล" : "ยังอ่านข้อมูลไม่ได้"} state={sanity.readReady} /><Row label="ฐานข้อมูลส่วนตัว" value={operations.identityValid ? "เชื่อมต่อชุดที่ถูกต้อง" : "ยังยืนยันการเชื่อมต่อไม่ได้"} state={operations.identityValid} /><Row label="การตั้งเวลาเผยแพร่" value={scheduler.effectiveEnabled ? "พร้อมรับคิวใหม่" : "ยังไม่รับคิวใหม่"} state={scheduler.effectiveEnabled} /></div><details className="mt-5 rounded-2xl border border-white/10 p-4"><summary className="cursor-pointer text-sm text-white/75">ดูรายละเอียดสำหรับทีมเทคนิค</summary><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div><p className="text-xs text-white/45">สภาพแวดล้อม</p><p className="mt-1 text-sm text-white/85">{getAdminEnvironment()}</p></div><div><p className="text-xs text-white/45">ผู้ให้บริการ</p><p className="mt-1 text-sm text-white/85">{deployment.provider}</p></div><div><p className="text-xs text-white/45">Git branch</p><p className="mt-1 text-sm text-white/85">{deployment.gitRef ?? "—"}</p></div><div><p className="text-xs text-white/45">Commit</p><p className="mt-1 break-all font-mono text-xs text-white/85">{deployment.gitSha ?? "—"}</p></div></div><div className="mt-5 text-xs text-white/55">Sanity: {sanity.projectId ?? "—"}/{sanity.dataset ?? "—"} · Database: {operations.projectId ?? "—"}/{operations.branchId ?? "—"} · Scheduler runtime {scheduler.runtimeEnabled ? "ON" : "OFF"}, durable {scheduler.durableEnabled ? "ON" : "OFF"}</div></details><Link href="/operations/health/" className="gold-button mt-5 inline-flex min-h-11 items-center px-5 py-2.5 text-sm">เปิดภาพรวมระบบ</Link></section>
  </div>;
}

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  await requireAdminPermission("settings:read");
  const { section } = await params;
  if (section === "integrations") return <IntegrationsPage />;
  if (section === "access") return <AccessPage />;
  if (section === "system") return <SystemPage />;
  notFound();
}
