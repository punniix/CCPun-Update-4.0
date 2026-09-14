import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import AdminDataRefresh from "@/features/admin/components/AdminDataRefresh";
import AdminNavigation, { type AdminNavigationItem } from "@/features/admin/components/AdminNavigation";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { environmentLabel, roleLabel } from "@/lib/admin/presentation";
import { hasAdminPermission, type AdminPermission, type AdminRole } from "@/lib/admin/rbac";

export const metadata: Metadata = {
  title: { default: "CCPun Control Plane", template: "%s | CCPun Control Plane" },
  robots: { index: false, follow: false, nocache: true },
};

type ChildDefinition = {
  href: string;
  label: string;
  permission: AdminPermission;
  external?: boolean;
};

type GroupDefinition = {
  key: AdminNavigationItem["key"];
  label: string;
  children: ChildDefinition[];
};

const NAV_GROUPS: GroupDefinition[] = [
  {
    key: "overview",
    label: "Overview",
    children: [
      { href: "/dashboard/", label: "Dashboard", permission: "dashboard:read" },
      { href: "/dashboard/inbox/", label: "Inbox", permission: "reviews:read" },
    ],
  },
  {
    key: "content",
    label: "Content",
    children: [
      { href: "/content/articles/", label: "Articles", permission: "content:read" },
      { href: "/content/calendar/", label: "Content Calendar", permission: "content:read" },
      { href: "/content/research/", label: "Research", permission: "research:read" },
      { href: "/studio/", label: "Studio", permission: "content:read", external: true },
    ],
  },
  {
    key: "distribution",
    label: "Distribution",
    children: [
      { href: "/social/", label: "Overview", permission: "social:read" },
      { href: "/social/posts/", label: "Social Posts", permission: "social:read" },
      { href: "/social/calendar/", label: "Social Calendar", permission: "social:read" },
      { href: "/social/queue/", label: "Queue", permission: "social:read" },
      { href: "/social/accounts/", label: "Accounts", permission: "social:read" },
    ],
  },
  {
    key: "growth",
    label: "Growth",
    children: [
      { href: "/seo/", label: "SEO Control Center", permission: "seo:read" },
      { href: "/seo/opportunities/", label: "Opportunities", permission: "seo:read" },
      { href: "/seo/audits/", label: "SEO Audits", permission: "seo:read" },
      { href: "/analytics/search/", label: "Search Analytics", permission: "dashboard:read" },
      { href: "/analytics/social/", label: "Social Analytics", permission: "dashboard:read" },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    children: [
      { href: "/operations/health/", label: "Health", permission: "settings:read" },
      { href: "/operations/jobs/", label: "Jobs", permission: "settings:read" },
      { href: "/operations/deployments/", label: "Deployments", permission: "settings:read" },
      { href: "/operations/audit-log/", label: "Audit Log", permission: "audit:read" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    children: [
      { href: "/settings/integrations/", label: "Integrations", permission: "settings:read" },
      { href: "/settings/access/", label: "Access", permission: "settings:read" },
      { href: "/settings/system/", label: "System", permission: "settings:read" },
    ],
  },
];

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role: AdminRole | null = session?.user?.role ?? null;

  if (!role) redirect("/login/");

  const environment = getAdminEnvironment();
  const currentEnvironmentLabel = environmentLabel(environment);
  const identityLabel = session?.user?.email ?? session?.user?.name ?? "Admin";
  const currentRoleLabel = roleLabel(role);
  const navItems: AdminNavigationItem[] = NAV_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    children: group.children
      .filter((child) => hasAdminPermission(role, child.permission))
      .map(({ href, label, external }) => ({ href, label, external })),
  })).filter((group) => group.children.length > 0);

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login/" });
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#211616] text-white md:grid md:grid-cols-[72px_minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)]">
      <AdminDataRefresh />
      <AdminNavigation
        items={navItems}
        environmentLabel={currentEnvironmentLabel}
        identityLabel={identityLabel}
        roleLabel={`${currentEnvironmentLabel} · ${currentRoleLabel}`}
        logoutAction={logout}
      />
      <main id="main-content" className="min-w-0 px-4 py-5 sm:px-5 md:px-5 md:py-6 lg:px-7 lg:py-7 xl:px-8">
        {children}
      </main>
    </div>
  );
}
