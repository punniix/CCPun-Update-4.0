"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

type NavigationItem = { href: string; label: string; children?: Array<{ href: string; label: string }> };

function NavigationLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavigationItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return items.map((item) => {
    const exact = pathname === item.href;
    const within = exact || (item.href !== "/dashboard/" && pathname.startsWith(item.href));
    return (
      <div key={item.href} className="min-w-0">
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={exact ? "page" : undefined}
          className={`flex min-h-11 items-center border-l-2 px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${
            within
              ? "border-[#e0c985] font-medium text-[#f4df9b]"
              : "border-transparent text-white/65 hover:border-white/20 hover:text-white"
          }`}
        >
          {item.label}
        </Link>
        {item.children ? (
          <div role="group" className={`${within ? "flex" : "hidden"} ml-3 flex-col gap-1 border-l border-white/10 pl-2 lg:flex`} aria-label={`เมนูย่อย ${item.label}`}>
            {item.children.map((child) => {
              const childActive = pathname === child.href || pathname.startsWith(child.href);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={childActive ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-xs transition focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${childActive ? "bg-[#e0c985]/10 font-medium text-[#f4df9b]" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  });
}

export default function AdminNavigation({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        className="inline-flex min-h-11 w-full items-center justify-between rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white lg:hidden"
        onClick={() => dialogRef.current?.showModal()}
      >
        เมนู Control Plane
        <span aria-hidden="true">☰</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="เมนู Control Plane"
        className="m-0 h-dvh max-h-none w-[min(88vw,22rem)] max-w-none bg-navy-800 p-0 text-white shadow-2xl backdrop:bg-black/70 lg:hidden"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <strong className="text-sm text-[#f4df9b]">CCPun Control Plane</strong>
          <button type="button" autoFocus onClick={() => dialogRef.current?.close()} className="min-h-11 rounded-lg px-3 text-sm text-white/70 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">ปิด</button>
        </div>
        <nav aria-label="เมนูหน้าควบคุมบนมือถือ" className="h-[calc(100dvh-77px)] overflow-y-auto px-4 py-4">
          <NavigationLinks items={items} pathname={pathname} onNavigate={() => dialogRef.current?.close()} />
        </nav>
      </dialog>

      <nav aria-label="เมนูหน้าควบคุม" className="hidden lg:flex lg:flex-col lg:gap-1">
        <NavigationLinks items={items} pathname={pathname} />
      </nav>
    </>
  );
}
