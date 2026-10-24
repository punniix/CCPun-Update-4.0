'use client';

import { useEffect } from "react";

/**
 * Progressive enhancement for the server-rendered header: dropdown and mobile
 * menu disclosure state, Escape/outside-click closing, and the theme toggle.
 * Without JavaScript every link is still in the HTML and hover/focus opens menus.
 */
export default function V5HeaderEnhancer({ storageKey }: { storageKey: string }) {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-v5-header]");
    if (!header) return;
    const dropdowns = Array.from(header.querySelectorAll<HTMLElement>("[data-v5-dropdown]"));
    const menuButton = header.querySelector<HTMLButtonElement>("[data-v5-menu-toggle]");
    const menu = header.querySelector<HTMLElement>("#mobile-navigation");
    const themeButton = header.querySelector<HTMLButtonElement>("[data-v5-theme-toggle]");

    const setDropdown = (item: HTMLElement, open: boolean) => {
      item.dataset.open = String(open);
      item.querySelector("button")?.setAttribute("aria-expanded", String(open));
    };
    const closeDropdowns = (except?: HTMLElement) => dropdowns.forEach((item) => { if (item !== except) setDropdown(item, false); });
    const setMenu = (open: boolean) => {
      if (!menu || !menuButton) return;
      menu.hidden = !open;
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", (open ? menuButton.dataset.labelClose : menuButton.dataset.labelOpen) ?? "");
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const toggle = target?.closest<HTMLButtonElement>("[data-v5-dropdown] > button");
      if (toggle) {
        const item = toggle.parentElement as HTMLElement;
        const open = item.dataset.open !== "true";
        closeDropdowns(item);
        setDropdown(item, open);
        return;
      }
      if (target?.closest("[data-v5-menu-toggle]")) { setMenu(menu?.hidden ?? false); return; }
      if (target?.closest("#mobile-navigation a")) setMenu(false);
      if (!target?.closest("[data-v5-dropdown]")) closeDropdowns();
    };
    const onDocumentClick = (event: MouseEvent) => { if (!header.contains(event.target as Node)) { closeDropdowns(); } };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const openItem = dropdowns.find((item) => item.dataset.open === "true" || item.contains(document.activeElement));
      if (openItem) { setDropdown(openItem, false); openItem.querySelector("button")?.focus(); return; }
      if (menu && !menu.hidden) { setMenu(false); menuButton?.focus(); }
    };
    const onThemeClick = () => {
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem(storageKey, next); } catch { /* Storage is optional. */ }
    };
    // An explicit close wins over hover/focus only until the pointer or focus leaves the item.
    const resetIntent = (event: Event) => {
      const item = event.currentTarget as HTMLElement;
      if (event.type === "focusout" && item.contains((event as FocusEvent).relatedTarget as Node | null)) return;
      if (item.dataset.open === "false") delete item.dataset.open;
    };
    dropdowns.forEach((item) => { item.addEventListener("mouseleave", resetIntent); item.addEventListener("focusout", resetIntent); });
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onBreakpoint = () => { if (desktop.matches) setMenu(false); };

    header.addEventListener("click", onClick);
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    themeButton?.addEventListener("click", onThemeClick);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      header.removeEventListener("click", onClick);
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
      themeButton?.removeEventListener("click", onThemeClick);
      desktop.removeEventListener("change", onBreakpoint);
      dropdowns.forEach((item) => { item.removeEventListener("mouseleave", resetIntent); item.removeEventListener("focusout", resetIntent); });
    };
  }, [storageKey]);
  return null;
}
