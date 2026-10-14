import AdminDataRefresh from "./AdminDataRefresh";
import AdminNavigation from "./AdminNavigation";
import { roleLabel } from "@/lib/admin/presentation";
import type { AdminRole } from "@/lib/admin/rbac";
import type { AdminNavigationItem } from "./admin-navigation-model";
import styles from "./AdminOwnerChrome.module.css";

type AdminChromeProps = { title: string; currentEnvironmentLabel: string; identityLabel: string; role: AdminRole; navItems: AdminNavigationItem[]; showLogout: boolean; logout: () => Promise<void>; safety: React.ReactNode; children: React.ReactNode };

export function AdminProtectedChrome({ title, currentEnvironmentLabel, identityLabel, role, navItems, showLogout, logout, safety, children }: AdminChromeProps) {
  return (
    <div className={`${styles.chrome} min-h-screen overflow-x-hidden bg-navy-900 text-white`}>
      <AdminDataRefresh />
      <header className="border-b border-white/10 bg-navy-800/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <p className="text-base leading-6 font-semibold text-[#e0c985]">{title}</p>
            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-sm leading-[22px] font-medium text-white/75">{currentEnvironmentLabel}</span>
          </div>
          <div role="group" aria-label="บัญชีที่เข้าสู่ระบบ" className="flex min-w-0 items-center gap-3 lg:max-w-[50%]">
            <div className="min-w-0 flex-1 text-sm leading-[22px] lg:text-right">
              <div className="text-white/80 [overflow-wrap:anywhere]">{identityLabel}</div>
              <div className="text-white/65">สิทธิ์: {roleLabel(role)}</div>
            </div>
            {showLogout ? (
              <form action={logout} className="shrink-0">
                <button type="submit" className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-base leading-6 font-medium text-white/75 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">ออกจากระบบ</button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full min-w-0 max-w-[1500px] grid-cols-[minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-white/10 px-4 py-4 lg:min-h-[calc(100vh-81px)] lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <AdminNavigation items={navItems} />
          <details className="mt-6 border-t border-white/10 pt-3 text-sm leading-[22px] text-white/70">
            <summary className="flex min-h-11 cursor-pointer items-center text-base leading-6 font-medium text-white/75 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]">ขอบเขตการใช้งาน</summary>
            <p className="pb-3 pt-2">{safety}</p>
          </details>
        </aside>

        <main id="main-content" className="min-w-0 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
