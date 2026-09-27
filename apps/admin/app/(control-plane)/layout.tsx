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
  title: { default: "ศูนย์จัดการ CCPun", template: "%s | ศูนย์จัดการ CCPun" },
  robots: { index: false, follow: false, nocache: true },
};

const NAV_ITEMS: Array<{ href: string; label: string; permission: AdminPermission; children?: Array<{ href: string; label: string; permission?: AdminPermission }> }> = [
  { href: "/dashboard/", label: "ภาพรวม", permission: "dashboard:read", children: [
      { href: "/dashboard/inbox/", label: "ลูกค้า LINE", permission: "advisor:read" },
      { href: "/dashboard/campaigns/", label: "ข้อความแจ้งลูกค้า", permission: "campaign:read" },
      { href: "/dashboard/reviews/", label: "งานรอตรวจ", permission: "reviews:read" },
  ] },
  { href: "/content/", label: "เนื้อหา", permission: "content:read", children: [
      { href: "/content/articles/", label: "บทความ" },
      { href: "/content/calendar/", label: "ปฏิทินเผยแพร่" },
      { href: "/content/research/", label: "ข้อมูลประกอบ" },
  ] },
  { href: "/seo/", label: "SEO", permission: "seo:read", children: [
      { href: "/seo/opportunities/", label: "โอกาสพัฒนา" },
      { href: "/seo/audits/", label: "ผลตรวจ" },
  ] },
  { href: "/social/", label: "โซเชียล", permission: "social:read", children: [
      { href: "/social/posts/", label: "โพสต์" },
      { href: "/social/calendar/", label: "ปฏิทินโพสต์" },
      { href: "/social/queue/", label: "คิวส่งโพสต์" },
      { href: "/social/accounts/", label: "บัญชีที่เชื่อมต่อ" },
  ] },
  { href: "/analytics/", label: "ผลลัพธ์", permission: "dashboard:read", children: [
      { href: "/analytics/search/", label: "ผลการค้นหา" },
      { href: "/analytics/social/", label: "ผลลัพธ์โซเชียล" },
      { href: "/analytics/conversions/", label: "เส้นทางลูกค้า" },
      { href: "/analytics/exports/", label: "ส่งออกข้อมูล", permission: "settings:read" },
  ] },
  { href: "/operations/", label: "สถานะระบบ", permission: "settings:read", children: [
      { href: "/operations/health/", label: "ภาพรวมระบบ" },
      { href: "/operations/deployments/", label: "เวอร์ชันที่ใช้งาน" },
      { href: "/operations/jobs/", label: "งานเบื้องหลัง" },
      { href: "/operations/local-ai/", label: "AI ภายใน" },
      { href: "/operations/privacy/", label: "ข้อมูลและความเป็นส่วนตัว" },
      { href: "/operations/audit-log/", label: "ประวัติการทำงาน" },
  ] },
  { href: "/settings/", label: "ตั้งค่า", permission: "settings:read", children: [
      { href: "/settings/integrations/", label: "การเชื่อมต่อ" },
      { href: "/settings/access/", label: "สิทธิ์ผู้ใช้" },
      { href: "/settings/system/", label: "ข้อมูลระบบ" },
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
              <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ศูนย์จัดการ CCPun</p>
              <p className="mt-1 text-sm text-white/60">พื้นที่ตรวจและเตรียมงานก่อนเผยแพร่</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/70">{currentEnvironmentLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {hasAdminPermission(role, "advisor:read") ? <Link href="/dashboard/inbox/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-white/70 transition hover:bg-white/5 hover:text-white">ลูกค้า LINE</Link> : null}
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
              <><strong className="font-medium text-[#f4df9b]">ระบบจริง · ใช้ข้อมูลจริง:</strong> {environment === "local-production" ? "เปิดจาก Mac เครื่องนี้เท่านั้น และใช้ข้อมูลจริงตามสิทธิ์ที่กำหนด" : "การแก้ฉบับร่างและการอนุมัติต้องให้ผู้มีสิทธิ์เป็นคนยืนยัน"} ระบบจะส่งโพสต์ได้เฉพาะรายการที่ตรวจและอนุมัติแล้วเท่านั้น</>
            ) : (
              <><strong className="font-medium text-[#f4df9b]">พื้นที่ทดสอบ UAT:</strong> ใช้ตรวจขั้นตอนก่อนนำขึ้นระบบจริง การส่งข้อมูลไปบริการภายนอกยังปิดไว้จนกว่าผู้มีสิทธิ์จะยืนยัน</>
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
