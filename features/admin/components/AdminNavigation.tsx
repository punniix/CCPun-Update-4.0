"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState } from "react";

type NavigationChild = { href: string; label: string };
type NavigationItem = { href: string; label: string; children?: NavigationChild[] };

function isPathWithin(pathname: string, href: string) {
  if (pathname === href) return true;
  const normalized = href.endsWith("/") ? href : `${href}/`;
  return pathname.startsWith(normalized);
}

function contextualItems(item: NavigationItem): NavigationChild[] {
  const children = item.children ?? [];
  return [{ href: item.href, label: "ภาพรวม" }, ...children.filter((child) => child.href !== item.href)];
}

function PrimaryModules({ items, pathname }: { items: NavigationItem[]; pathname: string }) {
  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isPathWithin(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            aria-expanded={active && Boolean(item.children?.length) ? true : undefined}
            aria-controls={active && item.children?.length ? `admin-context-${item.label.toLowerCase()}` : undefined}
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
  const links = contextualItems(item);
  return (
    <div
      id={`admin-context-${item.label.toLowerCase()}`}
      className="mt-5 border-t border-white/10 pt-4"
      aria-label={`เมนูย่อย ${item.label}`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">{item.label}</p>
        <span className="text-[10px] text-[#e0c985]/70">หมวด</span>
      </div>
      <div role="list" className="flex flex-col gap-1">
        {links.map((child) => {
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
        })}
      </div>
    </div>
  );
}

export default function AdminNavigation({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mobileGroupHref, setMobileGroupHref] = useState<string | null>(null);

  const activeItem = useMemo(
    () => items.find((item) => isPathWithin(pathname, item.href)) ?? null,
    [items, pathname],
  );
  const mobileGroup = items.find((item) => item.href === mobileGroupHref) ?? null;

  function closeDialog() {
    dialogRef.current?.close();
    setMobileGroupHref(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-controls="admin-mobile-navigation"
        className="inline-flex min-h-11 w-full touch-manipulation items-center justify-between rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white transition motion-reduce:transition-none hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-[#e0c985] lg:hidden"
        onClick={() => dialogRef.current?.showModal()}
      >
        เมนูศูนย์จัดการ
        <span aria-hidden="true">☰</span>
      </button>

      <dialog
        id="admin-mobile-navigation"
        ref={dialogRef}
        aria-label="เมนูศูนย์จัดการ CCPun"
        className="m-0 h-dvh max-h-none w-[min(92vw,22rem)] max-w-none bg-navy-800 p-0 text-white shadow-2xl backdrop:bg-black/70 lg:hidden"
        onClose={() => setMobileGroupHref(null)}
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
              <strong className="block truncate text-sm text-[#f4df9b]">{mobileGroup?.label ?? "ศูนย์จัดการ CCPun"}</strong>
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

        <nav aria-label="เมนูหน้าควบคุมบนมือถือ" className="h-[calc(100dvh-64px)] overflow-y-auto px-4 py-4">
          {mobileGroup ? (
            <ContextNavigation item={mobileGroup} pathname={pathname} onNavigate={closeDialog} />
          ) : (
            <div className="flex flex-col gap-1">
              {items.map((item) => {
                const active = isPathWithin(pathname, item.href);
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
      </dialog>

      <nav aria-label="เมนูหน้าควบคุม" className="hidden lg:block">
        <PrimaryModules items={items} pathname={pathname} />
        {activeItem?.children?.length ? <ContextNavigation item={activeItem} pathname={pathname} /> : null}
      </nav>
    </>
  );
}
