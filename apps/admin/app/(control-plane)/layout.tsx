import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { AdminProtectedChrome } from "@/features/admin/components/AdminProtectedChrome";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { environmentLabel } from "@/lib/admin/presentation";
import { hasAdminPermission, type AdminPermission, type AdminRole } from "@/lib/admin/rbac";
import { getAdminCapabilityProfile, isAdminCapabilityPathAllowed } from "@/lib/admin/capability-profile";

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
  ] },
  { href: "/social/", label: "โซเชียล", permission: "social:read", children: [
      { href: "/social/posts/", label: "โพสต์" },
      { href: "/social/calendar/", label: "ปฏิทินโพสต์" },
      { href: "/social/queue/", label: "คิวส่งโพสต์" },
      { href: "/social/accounts/", label: "บัญชีที่เชื่อมต่อ" },
  ] },
  { href: "/analytics/", label: "ผลลัพธ์", permission: "dashboard:read", children: [
      { href: "/analytics/performance/", label: "บทความที่ได้ผล & สิ่งที่ควรทำ", permission: "settings:read" },
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
  const capabilityProfile = getAdminCapabilityProfile();
  const navItems = NAV_ITEMS
    .filter((item) => hasAdminPermission(role, item.permission))
    .flatMap((item) => {
      const children = item.children
        ?.filter((child) => (!child.permission || hasAdminPermission(role, child.permission)) && isAdminCapabilityPathAllowed(child.href, capabilityProfile))
        .map(({ href, label }) => ({ href, label }));
      if (isAdminCapabilityPathAllowed(item.href, capabilityProfile)) return [{ ...item, children }];
      // Reviews remains available even while its dashboard parent is disabled.
      return (children ?? []).map((child) => ({ ...child, permission: item.permission, children: undefined }));
    });
  const identityLabel = session?.user?.email ?? session?.user?.name ?? "Admin";

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login/" });
  }

  return <AdminProtectedChrome
    title="ศูนย์จัดการ CCPun"
    currentEnvironmentLabel={currentEnvironmentLabel}
    identityLabel={identityLabel}
    role={role}
    navItems={navItems}
    showInbox={hasAdminPermission(role, "advisor:read") && isAdminCapabilityPathAllowed("/dashboard/inbox/", capabilityProfile)}
    inboxLabel="ลูกค้า LINE"
    studioLabel="แก้เนื้อหา"
    showLogout={Boolean(session?.user)}
    logout={logout}
    safety={capabilityProfile === "editorial" && (environment === "production-admin" || environment === "local-production") ? (
              <><strong className="font-medium text-[#f4df9b]">บทความและ SEO · ข้อมูลจริง:</strong> การแก้ฉบับร่างและการเผยแพร่ต้องให้ผู้มีสิทธิ์ตรวจและยืนยัน</>
            ) : environment === "production-admin" || environment === "local-production" ? (
              <><strong className="font-medium text-[#f4df9b]">Production · ข้อมูลจริง:</strong> {environment === "local-production" ? "เปิดจาก Mac เครื่องนี้เท่านั้น และใช้ข้อมูลจริงตามสิทธิ์ที่กำหนด" : "การแก้ฉบับร่างและการอนุมัติต้องให้ผู้มีสิทธิ์เป็นคนยืนยัน"} ระบบจะส่งโพสต์ได้เฉพาะรายการที่ตรวจและอนุมัติแล้วเท่านั้น</>
            ) : (
              <><strong className="font-medium text-[#f4df9b]">UAT:</strong> ใช้ตรวจขั้นตอนก่อนนำขึ้นระบบจริง การส่งข้อมูลไปบริการภายนอกยังปิดไว้จนกว่าผู้มีสิทธิ์จะยืนยัน</>
            )}
  >{children}</AdminProtectedChrome>;
}
