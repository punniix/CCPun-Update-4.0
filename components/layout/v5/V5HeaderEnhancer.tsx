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
    // D2: system -> light -> dark -> system. "system" follows prefers-color-scheme live.
    const root = document.documentElement;
    const scheme = window.matchMedia("(prefers-color-scheme: light)");
    const labels = (() => { try { return JSON.parse(themeButton?.dataset.labels ?? "{}") as Record<string, string>; } catch { return {}; } })();
    const status = themeButton?.querySelector<HTMLElement>("[data-v5-theme-status]");
    const applyTheme = (choice: string) => {
      const resolved = choice === "light" || choice === "dark" ? choice : scheme.matches ? "light" : "dark";
      root.setAttribute("data-theme", resolved);
      root.setAttribute("data-theme-choice", choice === "light" || choice === "dark" ? choice : "system");
      if (status) status.textContent = labels[root.getAttribute("data-theme-choice") ?? "system"] ?? "";
    };
    applyTheme(root.getAttribute("data-theme-choice") ?? "system");
    // Motion smoothing (2026-10-26): a theme change swaps every surface in one frame. Hover-state colour
    // transitions are switched off (V5.module.css) until the new theme has painted, then come back.
    let switching = 0;
    const switchTheme = (choice: string) => {
      root.setAttribute("data-v5-theme-switching", "");
      applyTheme(choice);
      window.cancelAnimationFrame(switching);
      switching = window.requestAnimationFrame(() => { switching = window.requestAnimationFrame(() => root.removeAttribute("data-v5-theme-switching")); });
    };
    // Client navigations jump to the top of the next page instead of smooth-scrolling there under the page
    // transition (the global html { scroll-behavior: smooth } stays for in-page anchors). Next 16 reads this
    // attribute on every navigation, so setting it after hydration is enough.
    root.dataset.scrollBehavior = "smooth";
    const onThemeClick = () => {
      const current = root.getAttribute("data-theme-choice") ?? "system";
      const next = current === "system" ? "light" : current === "light" ? "dark" : "system";
      switchTheme(next);
      try {
        if (next === "system") localStorage.removeItem(storageKey); else localStorage.setItem(storageKey, next);
      } catch { /* Storage is optional. */ }
    };
    const onSchemeChange = () => { if ((root.getAttribute("data-theme-choice") ?? "system") === "system") switchTheme("system"); };
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
    scheme.addEventListener("change", onSchemeChange);
    return () => {
      window.cancelAnimationFrame(switching);
      root.removeAttribute("data-v5-theme-switching");
      scheme.removeEventListener("change", onSchemeChange);
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
