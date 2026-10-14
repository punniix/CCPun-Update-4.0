import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { AdminProtectedChrome } from "@/features/admin/components/AdminProtectedChrome";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { environmentLabel } from "@/lib/admin/presentation";
import { hasAdminPermission, type AdminRole } from "@/lib/admin/rbac";
import { getAdminCapabilityProfile, isAdminCapabilityPathAllowed } from "@/lib/admin/capability-profile";
import { isPageSeoUatAllowed } from "@/lib/admin/page-seo";
import { buildAdminNavigation } from "@/features/admin/components/admin-navigation-model";

export const metadata: Metadata = {
  title: { default: "ศูนย์จัดการ CCPun", template: "%s | ศูนย์จัดการ CCPun" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role: AdminRole | null = session?.user?.role ?? null;

  if (!role) redirect("/login/");

  const environment = getAdminEnvironment();
  const currentEnvironmentLabel = environmentLabel(environment);
  const capabilityProfile = getAdminCapabilityProfile();
  const navItems = buildAdminNavigation({
    profile: capabilityProfile,
    hasPermission: (permission) => hasAdminPermission(role, permission),
    isPathAllowed: (path) => isAdminCapabilityPathAllowed(path, capabilityProfile),
    extraDestinations: role === "owner" && isPageSeoUatAllowed()
      ? [{ href: "/seo/pages/", label: "SEO หน้าเว็บ · UAT", permissions: ["seo:read"] }]
      : [],
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
