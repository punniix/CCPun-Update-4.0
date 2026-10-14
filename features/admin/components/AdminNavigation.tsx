"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { activeAdminNavigationChild, activeAdminNavigationItem, type AdminNavigationItem as NavigationItem } from "./admin-navigation-model";

function PrimaryModules({ items, pathname }: { items: NavigationItem[]; pathname: string }) {
  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => {
        const active = activeAdminNavigationItem(items, pathname)?.id === item.id;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            aria-expanded={active && Boolean(item.children?.length) ? true : undefined}
            aria-controls={active && item.children?.length ? `admin-context-desktop-${item.id}` : undefined}
            className={`flex min-h-11 items-center rounded-xl border px-4 py-2.5 text-base leading-6 font-medium transition motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${
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
  const links = item.children;
  const activeChild = activeAdminNavigationChild(item, pathname);
  return (
    <div
      id={`admin-context-${onNavigate ? "mobile" : "desktop"}-${item.id}`}
      className="mt-5 border-t border-white/10 pt-4"
      aria-label={`เมนูย่อย ${item.label}`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-sm leading-[22px] font-semibold text-white/65">{item.label}</p>
      </div>
      <div className="flex flex-col gap-1">
        {links.map((child) => {
          const active = activeChild?.href === child.href;
          return (
            <Link
              key={child.href}
              href={child.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-lg border-l-2 px-4 py-2 text-base leading-6 transition motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${
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
      {item.id === "content" ? (
        <Link href="/studio/" target="_blank" rel="noopener noreferrer" onClick={onNavigate} className="mt-3 flex min-h-11 items-center border-t border-white/10 px-4 py-3 text-base leading-6 text-white/70 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
          Sanity Studio<span className="sr-only"> (เปิดแท็บใหม่)</span>
        </Link>
      ) : null}
    </div>
  );
}

export default function AdminNavigation({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const groupButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const returnFocusHref = useRef<string | null>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const [mobileGroupHref, setMobileGroupHref] = useState<string | null>(null);

  useEffect(() => {
    if (mobileGroupHref !== null) {
      backButtonRef.current?.focus();
      return;
    }
    if (mobileGroupHref !== null || !returnFocusHref.current) return;
    groupButtonRefs.current.get(returnFocusHref.current)?.focus();
    returnFocusHref.current = null;
  }, [mobileGroupHref]);

  const activeItem = useMemo(
    () => activeAdminNavigationItem(items, pathname),
    [items, pathname],
  );
  const mobileGroup = items.find((item) => item.href === mobileGroupHref) ?? null;

  function closeDialog() {
    returnFocusHref.current = null;
    dialogRef.current?.close();
    setMobileGroupHref(null);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-controls="admin-mobile-navigation"
        className="inline-flex min-h-11 w-full touch-manipulation items-center justify-between rounded-xl border border-white/10 px-4 py-2.5 text-base leading-6 font-medium text-white transition motion-reduce:transition-none hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-[#e0c985] lg:hidden"
        onClick={() => dialogRef.current?.showModal()}
      >
        {activeItem?.label ?? "เมนูศูนย์จัดการ"}
        <span aria-hidden="true">☰</span>
      </button>

      <dialog
        id="admin-mobile-navigation"
        ref={dialogRef}
        aria-label="เมนูศูนย์จัดการ CCPun"
        className="m-0 h-dvh max-h-none w-[min(92vw,22rem)] max-w-none bg-navy-800 p-0 text-white shadow-2xl backdrop:bg-black/70 lg:hidden"
        onClose={() => {
          returnFocusHref.current = null;
          setMobileGroupHref(null);
          requestAnimationFrame(() => triggerRef.current?.focus());
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <div className="flex min-h-16 items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {mobileGroup ? (
              <button
                ref={backButtonRef}
                type="button"
                onClick={() => {
                  returnFocusHref.current = mobileGroupHref;
                  setMobileGroupHref(null);
                }}
                className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg text-base leading-6 text-white/75 transition motion-reduce:transition-none hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]"
                aria-label="กลับไปเมนูหลัก"
              >
                ←
              </button>
            ) : null}
            <div className="min-w-0">
              <strong className="block truncate text-base leading-6 text-[#f4df9b]">{mobileGroup?.label ?? "ศูนย์จัดการ CCPun"}</strong>
              {mobileGroup ? <span className="text-sm leading-[22px] text-white/65">เมนูในส่วนนี้</span> : null}
            </div>
          </div>
          <button
            type="button"
            autoFocus
            onClick={closeDialog}
            className="min-h-11 touch-manipulation rounded-lg px-4 text-base leading-6 text-white/70 transition motion-reduce:transition-none hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]"
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
                const active = activeAdminNavigationItem(items, pathname)?.id === item.id;
                const hasChildren = Boolean(item.children?.length);
                if (!hasChildren) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeDialog}
                      aria-current={pathname === item.href ? "page" : undefined}
                      className={`flex min-h-11 touch-manipulation items-center justify-between rounded-xl border px-4 py-2.5 text-base leading-6 font-medium focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${active ? "border-[#e0c985]/35 bg-[#e0c985]/[0.09] text-[#f4df9b]" : "border-transparent text-white/70"}`}
                    >
                      {item.label}
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.href}
                    ref={(button) => {
                      if (button) groupButtonRefs.current.set(item.href, button);
                      else groupButtonRefs.current.delete(item.href);
                    }}
                    type="button"
                    aria-expanded={false}
                    onClick={() => setMobileGroupHref(item.href)}
                    className={`flex min-h-11 touch-manipulation items-center justify-between rounded-xl border px-4 py-2.5 text-left text-base leading-6 font-medium transition motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${active ? "border-[#e0c985]/35 bg-[#e0c985]/[0.09] text-[#f4df9b]" : "border-transparent text-white/70 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"}`}
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
