import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import AdminDataRefresh from "@/features/admin/components/AdminDataRefresh";
import AdminNavigation from "@/features/admin/components/AdminNavigation";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { environmentLabel, roleLabel } from "@/lib/admin/presentation";
import { hasAdminPermission, type AdminPermission, type AdminRole } from "@/lib/admin/rbac";

export const metadata: Metadata = {
  title: { default: "CCPun Control Plane", template: "%s | CCPun Control Plane" },
  robots: { index: false, follow: false, nocache: true },
};

const NAV_ITEMS: Array<{ href: string; label: string; permission: AdminPermission; children?: Array<{ href: string; label: string; permission?: AdminPermission }> }> = [
  { href: "/dashboard/", label: "Dashboard", permission: "dashboard:read", children: [
      { href: "/dashboard/inbox/", label: "Advisor Inbox", permission: "advisor:read" },
      { href: "/dashboard/campaigns/", label: "LINE Campaigns", permission: "campaign:read" },
      { href: "/dashboard/reviews/", label: "Reviews", permission: "reviews:read" },
  ] },
  { href: "/content/", label: "Content", permission: "content:read", children: [
      { href: "/content/articles/", label: "Articles" },
      { href: "/content/calendar/", label: "Calendar" },
      { href: "/content/research/", label: "Research" },
  ] },
  { href: "/seo/", label: "SEO", permission: "seo:read", children: [
      { href: "/seo/opportunities/", label: "Opportunities" },
      { href: "/seo/audits/", label: "Audits" },
  ] },
  { href: "/social/", label: "Social", permission: "social:read", children: [
      { href: "/social/posts/", label: "Posts" },
      { href: "/social/calendar/", label: "Calendar" },
      { href: "/social/queue/", label: "Queue" },
      { href: "/social/accounts/", label: "Connections" },
  ] },
  { href: "/analytics/", label: "Analytics", permission: "dashboard:read", children: [
      { href: "/analytics/search/", label: "Search" },
      { href: "/analytics/social/", label: "Social" },
      { href: "/analytics/conversions/", label: "Conversions" },
  ] },
  { href: "/operations/", label: "Operations", permission: "settings:read", children: [
      { href: "/operations/health/", label: "Health" },
      { href: "/operations/deployments/", label: "Deployments" },
      { href: "/operations/jobs/", label: "Jobs" },
      { href: "/operations/privacy/", label: "Privacy / Data Rights" },
      { href: "/operations/audit-log/", label: "Audit log" },
  ] },
  { href: "/settings/", label: "Settings", permission: "settings:read", children: [
      { href: "/settings/integrations/", label: "Integrations" },
      { href: "/settings/access/", label: "Access" },
      { href: "/settings/system/", label: "System" },
  ] },
];

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role: AdminRole | null = session?.user?.role ?? null;

  if (!role) redirect("/login/");

  const environment = getAdminEnvironment();
  const currentEnvironmentLabel = environmentLabel(environment);
  const navItems = NAV_ITEMS
    .filter((item) => hasAdminPermission(role, item.permission))
    .map((item) => ({
      ...item,
      children: item.children
        ?.filter((child) => !child.permission || hasAdminPermission(role, child.permission))
        .map(({ href, label }) => ({ href, label })),
    }));
  const identityLabel = session?.user?.email ?? session?.user?.name ?? "Admin";

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login/" });
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-navy-900 text-white">
      <AdminDataRefresh />
      <header className="border-b border-white/10 bg-navy-800/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">CCPun Control Plane</p>
              <p className="mt-1 text-sm text-white/60">พื้นที่ตรวจและเตรียมงานก่อนเผยแพร่</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/70">{currentEnvironmentLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {hasAdminPermission(role, "advisor:read") ? <Link href="/dashboard/inbox/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-white/70 transition hover:bg-white/5 hover:text-white">Advisor Inbox</Link> : null}
            <Link href="/studio/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-[#e0c985]/30 px-3.5 py-2 text-xs font-medium text-[#f4df9b] transition hover:bg-[#e0c985]/10">Studio<span className="sr-only"> (เปิดแท็บใหม่)</span></Link>
            <div className="text-right">
              <div className="text-white/80">{identityLabel}</div>
              <div className="text-xs text-white/55">สิทธิ์: {roleLabel(role)}</div>
            </div>
            {session?.user ? (
              <form action={logout}>
                <button type="submit" className="min-h-11 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-white/70 transition hover:bg-white/5 hover:text-white">ออกจากระบบ</button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full min-w-0 max-w-[1500px] grid-cols-[minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-white/10 px-4 py-4 lg:min-h-[calc(100vh-81px)] lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <AdminNavigation items={navItems} />
          <div className="mt-4 rounded-2xl border border-[#e0c985]/20 bg-[#e0c985]/[0.07] p-4 text-sm leading-6 text-white/70 lg:mt-6">
            {environment === "production-admin" || environment === "local-production" ? (
              <><strong className="font-medium text-[#f4df9b]">Production · ข้อมูลจริง:</strong> {environment === "local-production" ? "เปิดจาก Mac เครื่องนี้เท่านั้น และใช้ข้อมูลจริงตามสิทธิ์ที่กำหนด" : "การแก้ Draft และการอนุมัติยังต้องเป็น Human action"} Social Worker ทำได้เฉพาะ publication ที่ผ่าน approval และ provider-write gate แล้วเท่านั้น</>
            ) : (
              <><strong className="font-medium text-[#f4df9b]">พื้นที่ทดสอบ UAT:</strong> ใช้สำหรับตรวจ workflow และ contract ก่อน Production โดย provider write ยังคงถูกควบคุมด้วย environment gate และ Human Approval</>
            )}
          </div>
        </aside>

        <main id="main-content" className="min-w-0 px-5 py-7 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
