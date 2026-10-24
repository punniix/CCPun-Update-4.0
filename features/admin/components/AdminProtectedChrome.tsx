"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { PUBLIC_COPY_SCOPES, type PublicCopyScope } from "@/lib/content/public-copy-registry";
import { getPageSeoPage } from "@/lib/content/page-seo-registry";
import AdminDataRefresh from "./AdminDataRefresh";
import AdminNavigation from "./AdminNavigation";
import { roleLabel } from "@/lib/admin/presentation";
import type { AdminPermission, AdminRole } from "@/lib/admin/rbac";

type NavigationItem = { href: string; label: string; permission: AdminPermission; children?: Array<{ href: string; label: string }> };
type AdminChromeProps = { title: string; currentEnvironmentLabel: string; identityLabel: string; role: AdminRole; navItems: NavigationItem[]; showInbox: boolean; inboxLabel: string; studioLabel: string; showLogout: boolean; logout: () => Promise<void>; safety: React.ReactNode; children: React.ReactNode };

const subscribeToNothing = () => () => {};

// Presentation shows website-preview pages chrome-less inside its iframe. When the
// same page is opened directly, give the owner a way back instead of a dead end.
function PreviewBackLink() {
  const standalone = useSyncExternalStore(subscribeToNothing, () => {
    try { return window.self === window.top; } catch { return false; }
  }, () => false);
  if (!standalone) return null;
  return <Link href="/" style={{ top: 12, zIndex: 2147483000 }} className="fixed left-3 inline-flex min-h-11 items-center whitespace-nowrap rounded-xl border border-[#e0c985]/40 bg-navy-800 px-3.5 py-2 text-sm font-medium text-[#f4df9b] shadow-2xl focus:outline-none focus:ring-2 focus:ring-[#e0c985]">← กลับศูนย์จัดการ</Link>;
}

// Plain scoped CSS (no new Tailwind utilities) so the Studio fills the space
// below the header: one column with the menu above Studio on small screens, the
// usual 220px sidebar on desktop, and Studio's own scroll areas only.
const STUDIO_SHELL_CSS = `[data-admin-shell=studio]>[data-admin-shell-body]{min-height:0;grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
[data-admin-shell=studio]>[data-admin-shell-body]>main{min-height:0}
[data-admin-shell=studio] #sanity{height:100%!important;max-height:100%!important}
@media (min-width:1024px){[data-admin-shell=studio]>[data-admin-shell-body]{grid-template-columns:220px minmax(0,1fr);grid-template-rows:minmax(0,1fr)}[data-admin-shell=studio]>[data-admin-shell-body]>aside{overflow-y:auto}}`;

function isAdminStudioPath(pathname: string | null | undefined) {
  return pathname === "/studio" || Boolean(pathname?.startsWith("/studio/"));
}

export function AdminProtectedChrome({ title, currentEnvironmentLabel, identityLabel, role, navItems, showInbox, inboxLabel, studioLabel, showLogout, logout, safety, children }: AdminChromeProps) {
  const pathname = usePathname();
  const previewPaths = Object.keys(PUBLIC_COPY_SCOPES).flatMap(scope => [
    `/content/website-preview/${scope}`,
    ...(getPageSeoPage(PUBLIC_COPY_SCOPES[scope as PublicCopyScope].pathname) ? [`/content/website-preview/seo-${scope}`] : []),
  ]);
  if (pathname === "/content/website-preview/" || pathname === "/content/website-preview" || pathname?.replace(/\/$/, "") === "/content/website-preview/author-home" || previewPaths.includes(pathname?.replace(/\/$/, "") ?? "")) return <><PreviewBackLink />{children}</>;
  const studioMode = isAdminStudioPath(pathname);
  const header = (
    <header className={studioMode ? "shrink-0 border-b border-white/10 bg-navy-800/95 backdrop-blur" : "border-b border-white/10 bg-navy-800/95 backdrop-blur"}>
      <div className={studioMode ? "flex flex-col gap-2 px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between lg:px-8" : "mx-auto flex max-w-[1500px] flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8"}>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">{title}</p>
            <p className={studioMode ? "mt-1 hidden text-sm text-white/60 lg:block" : "mt-1 text-sm text-white/60"}>พื้นที่ตรวจและเตรียมงานก่อนเผยแพร่</p>
          </div>
          <span className="inline-flex whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/70">{currentEnvironmentLabel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {showInbox ? <Link href="/dashboard/inbox/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-white/70 transition hover:bg-white/5 hover:text-white">{inboxLabel}</Link> : null}
          <Link href="/studio/" aria-current={studioMode ? "page" : undefined} className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-medium text-[#f4df9b] transition hover:bg-[#e0c985]/10 ${studioMode ? "border-[#e0c985]/60 bg-[#e0c985]/10" : "border-[#e0c985]/30"}`}>{studioLabel}</Link>
          <div className={studioMode ? "hidden text-right lg:block" : "text-right"}>
            <div className="text-white/80">{identityLabel}</div>
            <div className="text-xs text-white/55">สิทธิ์: {roleLabel(role)}</div>
          </div>
          {showLogout ? (
            <form action={logout}>
              <button type="submit" className="min-h-11 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-white/70 transition hover:bg-white/5 hover:text-white">ออกจากระบบ</button>
            </form>
          ) : null}
        </div>
      </div>
    </header>
  );

  if (studioMode) {
    // Embedded Studio fills the main area inside the same shell at full height.
    // It keeps its own Sanity auth and lane guards; the shell only adds Admin
    // navigation around it. No data-refresh on focus: Studio manages its state.
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-navy-900 text-white" data-admin-shell="studio">
        <style>{STUDIO_SHELL_CSS}</style>
        {header}
        <div className="grid w-full min-w-0 flex-1" data-admin-shell-body="">
          <aside className="min-w-0 border-b border-white/10 px-4 py-2 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
            <AdminNavigation items={navItems} />
            <div className="mt-6 hidden rounded-2xl border border-[#e0c985]/20 bg-[#e0c985]/[0.07] p-4 text-sm leading-6 text-white/70 lg:block">
              {safety}
            </div>
          </aside>
          <main id="main-content" className="min-w-0 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-navy-900 text-white">
      <AdminDataRefresh />
      {header}

      <div className="mx-auto grid w-full min-w-0 max-w-[1500px] grid-cols-[minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-white/10 px-4 py-4 lg:min-h-[calc(100vh-81px)] lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <AdminNavigation items={navItems} />
          <div className="mt-4 rounded-2xl border border-[#e0c985]/20 bg-[#e0c985]/[0.07] p-4 text-sm leading-6 text-white/70 lg:mt-6">
            {safety}
          </div>
        </aside>

        <main id="main-content" className="min-w-0 px-5 py-7 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
