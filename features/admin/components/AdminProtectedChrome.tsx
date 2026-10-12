import Link from "next/link";
import AdminDataRefresh from "./AdminDataRefresh";
import AdminNavigation from "./AdminNavigation";
import { roleLabel } from "@/lib/admin/presentation";
import type { AdminPermission, AdminRole } from "@/lib/admin/rbac";

type NavigationItem = { href: string; label: string; permission: AdminPermission; children?: Array<{ href: string; label: string }> };
type AdminChromeProps = { title: string; currentEnvironmentLabel: string; identityLabel: string; role: AdminRole; navItems: NavigationItem[]; showInbox: boolean; inboxLabel: string; studioLabel: string; showLogout: boolean; logout: () => Promise<void>; safety: React.ReactNode; children: React.ReactNode };

export function AdminProtectedChrome({ title, currentEnvironmentLabel, identityLabel, role, navItems, showInbox, inboxLabel, studioLabel, showLogout, logout, safety, children }: AdminChromeProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-navy-900 text-white">
      <AdminDataRefresh />
      <header className="border-b border-white/10 bg-navy-800/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-5 py-4 lg:px-8">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">{title}</p>
              <p className="mt-1 text-sm text-white/60">พื้นที่ตรวจและเตรียมงานก่อนเผยแพร่</p>
            </div>
            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/70">{currentEnvironmentLabel}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
            <div role="group" aria-label="เครื่องมือศูนย์จัดการ" className="flex shrink-0 flex-wrap items-center gap-2">
              {showInbox ? <Link href="/dashboard/inbox/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-white/70 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">{inboxLabel}</Link> : null}
              <Link href="/studio/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-[#e0c985]/30 px-3.5 py-2 text-xs font-medium text-[#f4df9b] transition hover:bg-[#e0c985]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">{studioLabel}<span className="sr-only"> (เปิดแท็บใหม่)</span></Link>
            </div>
            <div role="group" aria-label="บัญชีที่เข้าสู่ระบบ" className="flex min-w-0 items-center gap-3 xl:flex-1">
              <div className="min-w-0 flex-1 text-sm xl:text-right">
                <div className="text-white/80 [overflow-wrap:anywhere]">{identityLabel}</div>
                <div className="text-xs text-white/55">สิทธิ์: {roleLabel(role)}</div>
              </div>
              {showLogout ? (
                <form action={logout} className="shrink-0">
                  <button type="submit" className="min-h-11 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-white/70 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">ออกจากระบบ</button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </header>

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
