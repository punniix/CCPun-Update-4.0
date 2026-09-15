"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  Search,
  Settings2,
  X,
  type LucideIcon,
} from "lucide-react";

export type AdminNavigationChild = {
  href: string;
  label: string;
  external?: boolean;
};

export type AdminNavigationItem = {
  key: "overview" | "content" | "distribution" | "growth" | "operations" | "settings";
  label: string;
  children: AdminNavigationChild[];
};

type Props = {
  items: AdminNavigationItem[];
  environmentLabel: string;
  identityLabel: string;
  roleLabel: string;
  logoutAction: () => Promise<void>;
};

const ICONS: Record<AdminNavigationItem["key"], LucideIcon> = {
  overview: LayoutDashboard,
  content: FileText,
  distribution: Megaphone,
  growth: BarChart3,
  operations: Activity,
  settings: Settings2,
};

function childMatches(pathname: string, href: string) {
  if (href === "/dashboard/") return pathname === href;
  if (href === "/studio/") return pathname.startsWith("/studio/");
  return pathname === href || pathname.startsWith(href);
}

function groupForPath(items: AdminNavigationItem[], pathname: string) {
  return items.find((item) => item.children.some((child) => childMatches(pathname, child.href)))?.key ?? null;
}

function ChildLinks({
  item,
  pathname,
  onNavigate,
}: {
  item: AdminNavigationItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div role="group" aria-label={`เมนูย่อย ${item.label}`} className="mt-1 grid gap-1 border-l border-white/10 pl-2 lg:ml-8">
      {item.children.map((child) => {
        const active = childMatches(pathname, child.href);
        return (
          <Link
            key={child.href}
            href={child.href}
            onClick={onNavigate}
            target={child.external ? "_blank" : undefined}
            rel={child.external ? "noopener noreferrer" : undefined}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-10 items-center rounded-lg px-3 py-2 text-xs transition focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${
              active ? "bg-[#e0c985]/10 font-medium text-[#f4df9b]" : "text-white/55 hover:bg-white/[0.05] hover:text-white/85"
            }`}
          >
            {child.label}
            {child.external ? <span className="ml-auto text-[10px] text-white/30" aria-hidden="true">↗</span> : null}
          </Link>
        );
      })}
    </div>
  );
}

function ParentButton({
  item,
  open,
  active,
  compact = false,
  onClick,
}: {
  item: AdminNavigationItem;
  open: boolean;
  active: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const Icon = ICONS[item.key];
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={`flex w-full items-center rounded-xl text-left transition focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${
        compact ? "h-12 justify-center px-0" : "min-h-11 gap-3 px-3 py-2.5"
      } ${open || active ? "bg-[#e0c985]/[0.08] text-[#f4df9b]" : "text-white/62 hover:bg-white/[0.04] hover:text-white"}`}
      aria-label={compact ? item.label : undefined}
      title={compact ? item.label : undefined}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
      {!compact ? <><span className="text-sm font-medium">{item.label}</span><ChevronDown className={`ml-auto h-4 w-4 text-white/35 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" /></> : null}
    </button>
  );
}

function AccountBlock({ identityLabel, roleLabel, logoutAction, compact = false }: Pick<Props, "identityLabel" | "roleLabel" | "logoutAction"> & { compact?: boolean }) {
  if (compact) {
    return <div className="mt-auto flex justify-center border-t border-white/[0.07] pt-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#493434] text-xs font-semibold text-[#f4df9b]">{identityLabel.slice(0, 1).toUpperCase()}</div></div>;
  }
  return (
    <div className="mt-auto border-t border-white/[0.07] pt-3">
      <div className="flex items-center gap-2.5 px-2 py-2">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#493434] text-xs font-semibold text-[#f4df9b]">{identityLabel.slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-white/80">{identityLabel}</div>
          <div className="mt-0.5 text-[10px] text-white/40">{roleLabel}</div>
        </div>
        <form action={logoutAction}>
          <button type="submit" aria-label="ออกจากระบบ" title="ออกจากระบบ" className="grid h-9 w-9 place-items-center rounded-lg text-white/40 hover:bg-white/[0.05] hover:text-white/75 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminNavigation({ items, environmentLabel, identityLabel, roleLabel, logoutAction }: Props) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const currentGroup = useMemo(() => groupForPath(items, pathname), [items, pathname]);
  const [openState, setOpenState] = useState<{ pathname: string; key: AdminNavigationItem["key"] | null }>(() => ({ pathname, key: currentGroup }));
  const [tabletState, setTabletState] = useState<{ pathname: string; key: AdminNavigationItem["key"] | null }>(() => ({ pathname, key: null }));
  const openGroup = openState.pathname === pathname ? openState.key : currentGroup;
  const tabletGroup = tabletState.pathname === pathname ? tabletState.key : null;

  function toggleGroup(key: AdminNavigationItem["key"]) {
    setOpenState({ pathname, key: openGroup === key ? null : key });
  }

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-white/[0.07] bg-[#1d1313]/95 px-4 backdrop-blur md:hidden">
        <strong className="text-sm font-semibold tracking-[0.02em]">CCPun Admin</strong>
        <span className="rounded-full border border-[#e0c985]/25 px-2 py-0.5 text-[9px] font-medium text-[#f4df9b]">{environmentLabel.includes("Production") ? "PROD" : "UAT"}</span>
        <span className="flex-1" />
        <Link href="/content/articles/?q=" aria-label="ค้นหาบทความ" className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-white/65 focus:outline-none focus:ring-2 focus:ring-[#e0c985]"><Search className="h-4 w-4" aria-hidden="true" /></Link>
        <button type="button" aria-haspopup="dialog" aria-label="เปิดเมนู" onClick={() => dialogRef.current?.showModal()} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-white/70 focus:outline-none focus:ring-2 focus:ring-[#e0c985]"><Menu className="h-4 w-4" aria-hidden="true" /></button>
      </div>

      <aside className="relative hidden min-h-screen border-r border-white/[0.07] bg-[#1d1313] md:flex md:w-[72px] md:flex-col md:px-2 md:py-3 lg:w-[232px] lg:px-3 lg:py-4">
        <div className="mb-4 hidden items-center justify-between gap-2 px-2 lg:flex">
          <strong className="text-sm font-semibold tracking-[0.02em]">CCPun Admin</strong>
          <span className="rounded-full border border-[#e0c985]/25 px-2 py-1 text-[9px] font-medium text-[#f4df9b]">{environmentLabel.includes("Production") ? "Production" : "UAT"}</span>
        </div>
        <div className="mb-3 grid h-10 place-items-center text-xs font-bold text-[#e0c985] lg:hidden">CP</div>

        <nav aria-label="เมนูหน้าควบคุม" className="grid gap-1.5">
          {items.map((item) => {
            const active = currentGroup === item.key;
            const open = openGroup === item.key;
            const tabletOpen = tabletGroup === item.key;
            return (
              <div key={item.key} className="relative">
                <div className="hidden lg:block">
                  <ParentButton item={item} open={open} active={active} onClick={() => toggleGroup(item.key)} />
                  {open ? <ChildLinks item={item} pathname={pathname} /> : null}
                </div>
                <div className="md:block lg:hidden">
                  <ParentButton item={item} open={tabletOpen} active={active} compact onClick={() => setTabletState({ pathname, key: tabletOpen ? null : item.key })} />
                  {tabletOpen ? (
                    <div className="absolute left-[62px] top-0 z-40 w-56 rounded-2xl border border-white/10 bg-[#241818] p-3 shadow-2xl">
                      <div className="px-2 pb-2 text-xs font-semibold text-[#f4df9b]">{item.label}</div>
                      <ChildLinks item={item} pathname={pathname} onNavigate={() => setTabletState({ pathname, key: null })} />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="hidden lg:block"><AccountBlock identityLabel={identityLabel} roleLabel={roleLabel} logoutAction={logoutAction} /></div>
        <div className="flex min-h-0 flex-1 md:flex lg:hidden"><AccountBlock identityLabel={identityLabel} roleLabel={roleLabel} logoutAction={logoutAction} compact /></div>
      </aside>

      <dialog ref={dialogRef} aria-label="เมนู Control Plane" className="m-0 h-dvh max-h-none w-full max-w-none bg-[#1b1212] p-0 text-white shadow-2xl backdrop:bg-black/70 md:hidden" onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}>
        <div className="flex h-14 items-center border-b border-white/[0.07] px-4">
          <strong className="text-sm">เมนู</strong>
          <span className="ml-auto rounded-full border border-[#e0c985]/25 px-2 py-0.5 text-[9px] text-[#f4df9b]">{environmentLabel.includes("Production") ? "PROD" : "UAT"}</span>
          <button type="button" autoFocus aria-label="ปิดเมนู" onClick={() => dialogRef.current?.close()} className="ml-2 grid h-9 w-9 place-items-center rounded-lg text-white/60 focus:outline-none focus:ring-2 focus:ring-[#e0c985]"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <nav aria-label="เมนูหน้าควบคุมบนมือถือ" className="h-[calc(100dvh-132px)] overflow-y-auto px-3 py-2">
          {items.map((item) => {
            const active = currentGroup === item.key;
            const open = openGroup === item.key;
            return (
              <div key={item.key} className="border-b border-white/[0.055] py-1">
                <ParentButton item={item} open={open} active={active} onClick={() => toggleGroup(item.key)} />
                {open ? <div className="pb-2 pl-8"><ChildLinks item={item} pathname={pathname} onNavigate={() => dialogRef.current?.close()} /></div> : null}
              </div>
            );
          })}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-white/[0.07] bg-[#211616] px-3 py-2"><AccountBlock identityLabel={identityLabel} roleLabel={roleLabel} logoutAction={logoutAction} /></div>
      </dialog>
    </>
  );
}
