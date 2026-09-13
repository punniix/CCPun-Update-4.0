import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import AdminDataRefresh from "@/features/admin/components/AdminDataRefresh";
import AdminNavigation from "@/features/admin/components/AdminNavigation";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { environmentLabel, roleLabel } from "@/lib/admin/presentation";
import { hasAdminPermission, type AdminPermission, type AdminRole } from "@/lib/admin/rbac";
import { getSocialFoundationRuntimeStatus } from "@/lib/admin/social/foundation";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";

export const metadata: Metadata = {
  title: { default: "CCPun Control Plane", template: "%s | CCPun Control Plane" },
  robots: { index: false, follow: false, nocache: true },
};

const NAV_ITEMS: Array<{ href: string; label: string; permission: AdminPermission; children?: Array<{ href: string; label: string }> }> = [
  { href: "/snt-admin/dashboard/", label: "เริ่มที่นี่", permission: "dashboard:read" },
  { href: "/snt-admin/content/", label: "บทความ", permission: "content:read" },
  { href: "/snt-admin/seo/", label: "ตรวจ SEO", permission: "seo:read" },
  { href: "/snt-admin/research/", label: "Research Intelligence", permission: "research:read" },
  { href: "/snt-admin/growth/", label: "ภาพรวมการเติบโต", permission: "dashboard:read" },
  { href: "/snt-admin/distribution/", label: "Social", permission: "social:read", children: [
      { href: "/snt-admin/distribution/overview/", label: "Overview" },
      { href: "/snt-admin/distribution/operations/", label: "Posts" },
      { href: "/snt-admin/distribution/calendar/", label: "Calendar" },
      { href: "/snt-admin/distribution/analytics/", label: "Marketing" },
      { href: "/snt-admin/distribution/connections/", label: "Connections" },
  ] },
  { href: "/snt-admin/reviews/", label: "ข้อเสนอที่รอตรวจ", permission: "reviews:read" },
  { href: "/snt-admin/audit/", label: "ประวัติการทำงาน", permission: "audit:read" },
  { href: "/snt-admin/health/", label: "System Health", permission: "settings:read" },
];

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role: AdminRole | null = session?.user?.role ?? null;

  if (!role) redirect("/snt-admin/login/");

  const environment = getAdminEnvironment();
  const currentEnvironmentLabel = environmentLabel(environment);
  const socialEnabled = getSocialFoundationRuntimeStatus().enabled || getSocialOperationsRuntimeStatus().enabled;
  const navItems = NAV_ITEMS.filter((item) => (
    hasAdminPermission(role, item.permission)
    && (item.href !== "/snt-admin/distribution/" || socialEnabled)
  ));
  const identityLabel = session?.user?.email ?? session?.user?.name ?? "Admin";

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/snt-admin/login/" });
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#11151a] text-white">
      <AdminDataRefresh />
      <header className="border-b border-white/10 bg-[#151a20]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">CCPun Control Plane</p>
              <p className="mt-1 text-sm text-white/60">พื้นที่ตรวจและเตรียมงานก่อนเผยแพร่</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/70">{currentEnvironmentLabel}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
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
              <><strong className="font-medium text-[#f4df9b]">Production Draft — ข้อมูลจริง:</strong> {environment === "local-production" ? "เปิดจาก Mac เครื่องนี้เท่านั้น ระบบอ่านข้อมูลจริงได้ และจะเขียนได้เมื่อเปิดโหมด Draft โดยชัดเจน" : "ระบบแก้ได้เฉพาะฉบับร่างหลังคุณอนุมัติ"} ระบบจะไม่เผยแพร่หรือลบเนื้อหาให้เอง</>
            ) : (
              <><strong className="font-medium text-[#f4df9b]">พื้นที่ทดสอบ UAT:</strong> ระบบช่วยตรวจและเสนอได้ แต่ไม่เผยแพร่ ไม่ลบ และไม่เปลี่ยน Production ให้เอง</>
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
