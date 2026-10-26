"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { activeMobileTab, activeNavigationGroup, ADMIN_MOBILE_ALL_MENU_LABEL, contextualNavigationItems, mobileNavigationTabs, splitTechnicalNavigationItems, type AdminNavigationChild, type AdminNavigationGroup } from "./admin-navigation-model";
import styles from "./AdminNavigation.module.css";

type NavigationChild = AdminNavigationChild;
type NavigationItem = AdminNavigationGroup;

function isPathWithin(pathname: string, href: string) {
  if (pathname === href) return true;
  const normalized = href.endsWith("/") ? href : `${href}/`;
  return pathname.startsWith(normalized);
}

// Ids come from the group path: labels such as "ลูกค้า & LINE" contain spaces, which an
// aria-controls id list cannot carry.
function contextNavigationId(item: NavigationItem) {
  return `admin-context-${item.href.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home"}`;
}

function contextualItems(item: NavigationItem): NavigationChild[] {
  return contextualNavigationItems(item);
}

function PrimaryModules({ items, pathname, activeItem }: { items: NavigationItem[]; pathname: string; activeItem: NavigationItem | null }) {
  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item === activeItem;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            aria-expanded={active && Boolean(item.children?.length) ? true : undefined}
            aria-controls={active && item.children?.length ? contextNavigationId(item) : undefined}
            className={`flex min-h-11 items-center rounded-xl border px-3.5 py-2.5 text-sm font-medium transition motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${
              active
                ? "border-[#e0c985]/35 bg-[#e0c985]/[0.09] text-[#f4df9b]"
                : "border-transparent text-white/65 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function ContextNavigation({ item, pathname, onNavigate }: {
  item: NavigationItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { everyday, technical } = splitTechnicalNavigationItems(contextualItems(item));
  const renderLink = (child: NavigationChild) => {
    const exactOverview = child.href === item.href;
    const active = exactOverview ? pathname === child.href : isPathWithin(pathname, child.href);
    return (
      <Link
        key={child.href}
        href={child.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 items-center rounded-lg border-l-2 px-3 py-2 text-xs transition motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${
          active
            ? "border-[#e0c985] bg-[#e0c985]/[0.08] font-medium text-[#f4df9b]"
            : "border-transparent text-white/58 hover:bg-white/[0.04] hover:text-white"
        }`}
      >
        {child.label}
      </Link>
    );
  };
  const technicalActive = technical.some((child) => isPathWithin(pathname, child.href));
  return (
    <div
      id={contextNavigationId(item)}
      className="mt-5 border-t border-white/10 pt-4"
      aria-label={`เมนูย่อย ${item.label}`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">{item.label}</p>
        <span className="text-[10px] text-[#e0c985]/70">หมวด</span>
      </div>
      <div role="list" className="flex flex-col gap-1">
        {everyday.map(renderLink)}
      </div>
      {technical.length ? (
        <details className="mt-3 rounded-lg border border-white/10" open={technicalActive || undefined} data-admin-technical-nav="">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 text-xs text-white/55 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]">สำหรับทีมเทคนิค</summary>
          <div role="list" className="flex flex-col gap-1 px-1 pb-1">
            {technical.map(renderLink)}
          </div>
        </details>
      ) : null}
    </div>
  );
}

// Owner decision 5.4 (2026-10-26): on phones the menu is a bottom tab bar with four buttons
// (วันนี้, ลูกค้า LINE, เนื้อหา, เมนูทั้งหมด). Each button is at least 56px tall and the bar sits above
// the iOS home indicator (env(safe-area-inset-bottom)); เมนูทั้งหมด opens every group full screen.
function MobileTabBar({ items, pathname, menuOpen, onMenu, onNavigate }: { items: NavigationItem[]; pathname: string; menuOpen: boolean; onMenu: () => void; onNavigate?: () => void }) {
  const tabs = mobileNavigationTabs(items);
  const current = menuOpen ? "all" : activeMobileTab(items, pathname);
  return (
    <nav aria-label="เมนูหลักบนมือถือ" className={styles.tabBar} data-admin-tab-bar="">
      <div className={styles.tabRow} style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const active = current === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={onNavigate}
              aria-current={active ? (pathname === tab.href ? "page" : "true") : undefined}
              className={`${styles.tab} ${active ? styles.tabActive : ""}`}
              data-admin-tab={tab.key}
            >
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-controls="admin-mobile-navigation"
          aria-expanded={menuOpen}
          onClick={onMenu}
          className={`${styles.tab} ${current === "all" ? styles.tabActive : ""}`}
          data-admin-tab="all"
        >
          {ADMIN_MOBILE_ALL_MENU_LABEL}
        </button>
      </div>
    </nav>
  );
}

export default function AdminNavigation({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [mobileGroupHref, setMobileGroupHref] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const activeItem = useMemo(() => activeNavigationGroup(items, pathname), [items, pathname]);
  const mobileGroup = items.find((item) => item.href === mobileGroupHref) ?? null;

  function openDialog() {
    dialogRef.current?.showModal();
    setMenuOpen(true);
  }

  function closeDialog() {
    dialogRef.current?.close();
    setMobileGroupHref(null);
    setMenuOpen(false);
    requestAnimationFrame(() => triggerRef.current?.querySelector<HTMLElement>('[data-admin-tab="all"]')?.focus());
  }

  return (
    <>
      <div ref={triggerRef} className="lg:hidden">
        <MobileTabBar items={items} pathname={pathname} menuOpen={menuOpen} onMenu={openDialog} />
      </div>

      <dialog
        id="admin-mobile-navigation"
        ref={dialogRef}
        aria-label="เมนูทั้งหมด ศูนย์จัดการ CCPun"
        // The original drawer utilities stay so the frozen compiled-CSS proof (phase2) is unchanged;
        // styles.sheet (unlayered) overrides them into a full-screen sheet above the tab bar.
        className={`m-0 h-dvh max-h-none w-[min(92vw,22rem)] max-w-none bg-navy-800 p-0 text-white shadow-2xl backdrop:bg-black/70 lg:hidden ${styles.sheet}`}
        onClose={() => { setMobileGroupHref(null); setMenuOpen(false); }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <div className="flex min-h-16 items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {mobileGroup ? (
              <button
                type="button"
                onClick={() => setMobileGroupHref(null)}
                className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg text-sm text-white/75 transition motion-reduce:transition-none hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]"
                aria-label="กลับไปเมนูหลัก"
              >
                ←
              </button>
            ) : null}
            <div className="min-w-0">
              <strong className="block truncate text-sm text-[#f4df9b]">{mobileGroup?.label ?? ADMIN_MOBILE_ALL_MENU_LABEL}</strong>
              {mobileGroup ? <span className="text-[11px] text-white/45">เมนูในส่วนนี้</span> : null}
            </div>
          </div>
          <button
            type="button"
            autoFocus
            onClick={closeDialog}
            className="min-h-11 touch-manipulation rounded-lg px-3 text-sm text-white/70 transition motion-reduce:transition-none hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]"
          >
            ปิด
          </button>
        </div>

        <nav aria-label="เมนูหน้าควบคุมบนมือถือ" className={`h-[calc(100dvh-64px)] overflow-y-auto px-4 py-4 ${styles.sheetBody}`}>
          {mobileGroup ? (
            <ContextNavigation item={mobileGroup} pathname={pathname} onNavigate={closeDialog} />
          ) : (
            <div className="flex flex-col gap-1">
              {items.map((item) => {
                const active = item === activeItem;
                const hasChildren = Boolean(item.children?.length);
                if (!hasChildren) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeDialog}
                      aria-current={pathname === item.href ? "page" : undefined}
                      className={`flex min-h-11 touch-manipulation items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${active ? "border-[#e0c985]/35 bg-[#e0c985]/[0.09] text-[#f4df9b]" : "border-transparent text-white/70"}`}
                    >
                      {item.label}
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.href}
                    type="button"
                    aria-expanded={false}
                    onClick={() => setMobileGroupHref(item.href)}
                    className={`flex min-h-11 touch-manipulation items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${active ? "border-[#e0c985]/35 bg-[#e0c985]/[0.09] text-[#f4df9b]" : "border-transparent text-white/70 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"}`}
                  >
                    <span>{item.label}</span>
                    <span aria-hidden="true" className="text-white/35">→</span>
                  </button>
                );
              })}
            </div>
          )}
        </nav>
        <MobileTabBar items={items} pathname={pathname} menuOpen onMenu={closeDialog} onNavigate={closeDialog} />
      </dialog>

      <nav aria-label="เมนูหน้าควบคุม" className="hidden lg:block">
        <PrimaryModules items={items} pathname={pathname} activeItem={activeItem} />
        {activeItem?.children?.length ? <ContextNavigation item={activeItem} pathname={pathname} /> : null}
      </nav>
    </>
  );
}
