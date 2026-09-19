import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { ADMIN_PERMISSIONS, hasAdminPermission, type AdminRole } from "@/lib/admin/rbac";
import { getAdminSanityStatus } from "@/lib/admin/sanity-control";
import { getAdminOperationsRuntimeStatus } from "@/lib/admin/operations/foundation";
import { readArticleSchedulerModel } from "@/lib/admin/operations/article-scheduler-read-model";
import { getSeoGoogleProviderReadiness } from "@/lib/admin/seo-intelligence/provider-readiness";
import { getSocialProviderReadiness } from "@/lib/admin/social/provider-readonly";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { readLineDiscoveryAdminModel } from "@/lib/admin/line/discovery-config";
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

  return <div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">SETTINGS · READINESS</p><h1 className="mt-2 text-3xl font-semibold">Integrations</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">แสดง readiness จาก server configuration โดยไม่เปิดเผย token, client secret หรือ connection string</p>
    <div className="mt-7 grid gap-5 xl:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"><h2 className="text-lg font-semibold">Core data plane</h2><div className="mt-3"><Row label="Sanity Production" value={`${sanity.projectId ?? "—"} / ${sanity.dataset ?? "—"}`} state={sanity.readReady} /><Row label="Control Plane database" value={`${operations.lane ?? "unknown"} · identity ${operations.identityValid ? "verified" : "not verified"}`} state={operations.identityValid} /><Row label="Article Scheduler" value={`runtime ${scheduler.runtimeEnabled ? "ON" : "OFF"} · durable ${scheduler.durableEnabled ? "ON" : "OFF"}`} state={scheduler.effectiveEnabled} /><Row label="Social operations" value={social.environment ?? "not configured"} state={social.enabled} /></div></section>
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"><h2 className="text-lg font-semibold">Search & Analytics</h2><div className="mt-3"><Row label="Google Search Console" value="Manual read-only sync" state={gsc.status === "manual-sync-ready"} /><Row label="Google Analytics 4" value="Manual read-only sync" state={ga4.status === "manual-sync-ready"} /></div><div className="mt-4 flex flex-wrap gap-2"><Link href="/analytics/search/" className="glass-button-sm inline-flex min-h-11 items-center text-sm text-white">Search performance</Link><Link href="/seo/opportunities/" className="glass-button-sm inline-flex min-h-11 items-center text-sm text-white">SEO opportunities</Link></div></section>
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 xl:col-span-2"><h2 className="text-lg font-semibold">Social providers</h2><div className="mt-3 grid gap-x-6 md:grid-cols-3"><Row label="Meta" value="Pages + Instagram read-only readiness" state={meta.status === "manual-sync-ready"} /><Row label="YouTube" value="Read-only readiness" state={youtube.status === "manual-sync-ready"} /><Row label="TikTok" value="Read-only readiness" state={tiktok.status === "manual-sync-ready"} /></div><div className="mt-4 flex flex-wrap gap-2"><Link href="/social/accounts/" className="glass-button-sm inline-flex min-h-11 items-center text-sm text-white">Provider accounts</Link><Link href="/operations/health/" className="glass-button-sm inline-flex min-h-11 items-center text-sm text-white">System Health</Link></div></section>
    </div>
    <LineDiscoveryManager initialModel={lineDiscovery} />
  </div>;
}

async function AccessPage() {
  const session = await auth();
  const role = (session?.user?.role ?? null) as AdminRole | null;
  const permissions = ADMIN_PERMISSIONS.filter((permission) => hasAdminPermission(role, permission));
  return <div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">SETTINGS · ACCESS</p><h1 className="mt-2 text-3xl font-semibold">Access</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">อ่านจาก Google-authenticated session และ server-side RBAC จริง หน้านี้ไม่มีฟังก์ชันเพิ่มผู้ใช้หรือแก้ allowlist</p>
    <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6"><dl className="grid gap-5 sm:grid-cols-3"><div><dt className="text-xs text-white/45">บัญชี</dt><dd className="mt-1 break-all text-sm text-white/85">{session?.user?.email ?? "—"}</dd></div><div><dt className="text-xs text-white/45">Role</dt><dd className="mt-1 text-sm text-white/85">{role ?? "—"}</dd></div><div><dt className="text-xs text-white/45">Environment</dt><dd className="mt-1 text-sm text-white/85">{getAdminEnvironment()}</dd></div></dl></section>
    <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6"><h2 className="text-lg font-semibold">Effective permissions</h2><div className="mt-4 flex flex-wrap gap-2">{permissions.map((permission) => <span key={permission} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-white/65">{permission}</span>)}</div></section>
  </div>;
}

async function SystemPage() {
  const sanity = getAdminSanityStatus();
  const operations = getAdminOperationsRuntimeStatus();
  const scheduler = await readArticleSchedulerModel({ scheduleLimit: 1, auditLimit: 1 });
  return <div><p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">SETTINGS · SYSTEM</p><h1 className="mt-2 text-3xl font-semibold">System</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">Runtime identity แบบอ่านอย่างเดียวจาก deployment ปัจจุบัน ไม่แสดง secret และไม่อนุญาตแก้ Production configuration จากหน้าเว็บ</p>
    <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div><p className="text-xs text-white/45">App environment</p><p className="mt-1 text-sm text-white/85">{getAdminEnvironment()}</p></div><div><p className="text-xs text-white/45">Vercel</p><p className="mt-1 text-sm text-white/85">{process.env.VERCEL_ENV ?? "—"}</p></div><div><p className="text-xs text-white/45">Git branch</p><p className="mt-1 text-sm text-white/85">{process.env.VERCEL_GIT_COMMIT_REF ?? "—"}</p></div><div><p className="text-xs text-white/45">Commit</p><p className="mt-1 break-all font-mono text-xs text-white/85">{process.env.VERCEL_GIT_COMMIT_SHA ?? "—"}</p></div></div><div className="mt-5"><Row label="Sanity data lane" value={`${sanity.projectId ?? "—"}/${sanity.dataset ?? "—"}`} state={sanity.readReady} /><Row label="Operational database identity" value={`${operations.projectId ?? "—"} / ${operations.branchId ?? "—"}`} state={operations.identityValid} /><Row label="Scheduler effective state" value={`runtime ${scheduler.runtimeEnabled ? "ON" : "OFF"} · durable ${scheduler.durableEnabled ? "ON" : "OFF"}`} state={scheduler.effectiveEnabled} /></div><Link href="/operations/health/" className="gold-button mt-5 inline-flex min-h-11 items-center px-5 py-2.5 text-sm">เปิด System Health</Link></section>
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
