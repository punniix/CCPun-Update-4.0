import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { AdminProtectedChrome } from "@/features/admin/components/AdminProtectedChrome";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { environmentLabel } from "@/lib/admin/presentation";
import { hasAdminPermission, type AdminPermission, type AdminRole } from "@/lib/admin/rbac";

export const metadata: Metadata = {
  title: { default: "CCPun Control Plane", template: "%s | CCPun Control Plane" },
  robots: { index: false, follow: false, nocache: true },
};

const NAV_ITEMS: Array<{ href: string; label: string; permission: AdminPermission; children?: Array<{ href: string; label: string }> }> = [
  { href: "/dashboard/", label: "Dashboard", permission: "dashboard:read", children: [
      { href: "/dashboard/inbox/", label: "Inbox" },
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
      { href: "/social/accounts/", label: "Accounts" },
  ] },
  { href: "/analytics/", label: "Analytics", permission: "dashboard:read", children: [
      { href: "/analytics/search/", label: "Search" },
      { href: "/analytics/social/", label: "Social" },
  ] },
  { href: "/operations/", label: "Operations", permission: "settings:read", children: [
      { href: "/operations/health/", label: "Health" },
      { href: "/operations/deployments/", label: "Deployments" },
      { href: "/operations/jobs/", label: "Jobs" },
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
  const navItems = NAV_ITEMS.filter((item) => hasAdminPermission(role, item.permission));
  const identityLabel = session?.user?.email ?? session?.user?.name ?? "Admin";

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login/" });
  }

  return <AdminProtectedChrome
    title="CCPun Control Plane"
    currentEnvironmentLabel={currentEnvironmentLabel}
    identityLabel={identityLabel}
    role={role}
    navItems={navItems}
    showInbox={true}
    inboxLabel="Inbox"
    studioLabel="Studio"
    showLogout={Boolean(session?.user)}
    logout={logout}
    safety={environment === "production-admin" || environment === "local-production" ? (
              <><strong className="font-medium text-[#f4df9b]">Production Draft — ข้อมูลจริง:</strong> {environment === "local-production" ? "เปิดจาก Mac เครื่องนี้เท่านั้น ระบบอ่านข้อมูลจริงได้ และจะเขียนได้เมื่อเปิดโหมด Draft โดยชัดเจน" : "ระบบแก้ได้เฉพาะฉบับร่างหลังคุณอนุมัติ"} ระบบจะไม่เผยแพร่หรือลบเนื้อหาให้เอง</>
            ) : (
              <><strong className="font-medium text-[#f4df9b]">พื้นที่ทดสอบ UAT:</strong> ระบบช่วยตรวจและเสนอได้ แต่ไม่เผยแพร่ ไม่ลบ และไม่เปลี่ยน Production ให้เอง</>
            )}
  >{children}</AdminProtectedChrome>;
}
