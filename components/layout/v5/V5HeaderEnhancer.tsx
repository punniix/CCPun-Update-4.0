'use client';

import { useEffect } from "react";
import { V5_OPEN_CHAT_EVENT, type V5OpenChatDetail } from "./chat-events";

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
    const themeOptions = Array.from(header.querySelectorAll<HTMLButtonElement>("[data-v5-theme-choice]"));
    const systemSwitch = header.querySelector<HTMLButtonElement>("[data-v5-theme-system]");

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
    const onDocumentClick = (event: MouseEvent) => { if (!header.contains(event.target as Node)) { closeDropdowns(); setMenu(false); } };
    const onFocusIn = (event: FocusEvent) => { if (menu && !menu.hidden && !header.contains(event.target as Node)) setMenu(false); };
    // The menu closes before chat opens. Use the dock's existing stable focus fallback across breakpoints.
    const onOpenChat = (event: Event) => {
      const detail = (event as CustomEvent<V5OpenChatDetail>).detail;
      if (detail?.returnTo && menu?.contains(detail.returnTo)) detail.returnTo = null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" && menu && !menu.hidden) {
        const controls = [menuButton, ...menu.querySelectorAll<HTMLElement>("a[href], button")].filter((item): item is HTMLElement => !!item && item.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); first?.focus(); }
      }
      const option = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-v5-theme-choice]");
      if (option && ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End", " ", "Enter"].includes(event.key)) {
        event.preventDefault();
        const index = themeOptions.indexOf(option);
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? themeOptions.length - 1 : ["ArrowRight", "ArrowDown"].includes(event.key) ? (index + 1) % themeOptions.length : ["ArrowLeft", "ArrowUp"].includes(event.key) ? (index + themeOptions.length - 1) % themeOptions.length : index;
        const next = themeOptions[nextIndex];
        selectTheme(next.dataset.v5ThemeChoice ?? "system");
        next.focus();
        return;
      }
      if (event.key !== "Escape") return;
      const openItem = dropdowns.find((item) => item.dataset.open === "true" || item.contains(document.activeElement));
      if (openItem) { setDropdown(openItem, false); openItem.querySelector("button")?.focus(); return; }
      if (menu && !menu.hidden) { setMenu(false); menuButton?.focus(); }
    };
    // C11: all controls share the same saved choice; system follows prefers-color-scheme live.
    const root = document.documentElement;
    const scheme = window.matchMedia("(prefers-color-scheme: light)");
    const labels = (() => { try { return JSON.parse(themeButton?.dataset.labels ?? "{}") as Record<string, string>; } catch { return {}; } })();
    const status = header.querySelector<HTMLElement>("[data-v5-theme-status]");
    const applyTheme = (choice: string) => {
      const resolved = choice === "light" || choice === "dark" ? choice : scheme.matches ? "light" : "dark";
      root.setAttribute("data-theme", resolved);
      root.setAttribute("data-theme-choice", choice === "light" || choice === "dark" ? choice : "system");
      const selected = root.getAttribute("data-theme-choice") ?? "system";
      if (status) status.textContent = labels[selected] ?? "";
      themeOptions.forEach((option) => {
        const checked = option.dataset.v5ThemeChoice === selected;
        option.setAttribute("aria-checked", String(checked));
        option.tabIndex = checked ? 0 : -1;
      });
      systemSwitch?.setAttribute("aria-checked", String(selected === "system"));
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
    const selectTheme = (next: string) => {
      switchTheme(next);
      try {
        if (next === "system") localStorage.removeItem(storageKey); else localStorage.setItem(storageKey, next);
      } catch { /* Storage is optional. */ }
    };
    const onThemeClick = () => selectTheme(root.getAttribute("data-theme") === "light" ? "dark" : "light");
    const onOptionClick = (event: MouseEvent) => selectTheme((event.currentTarget as HTMLButtonElement).dataset.v5ThemeChoice ?? "system");
    const onSystemClick = () => selectTheme(root.getAttribute("data-theme-choice") === "system" ? root.getAttribute("data-theme") ?? "dark" : "system");
    const onSchemeChange = () => { if ((root.getAttribute("data-theme-choice") ?? "system") === "system") switchTheme("system"); };
    // An explicit close wins over hover/focus only until the pointer or focus leaves the item.
    const resetIntent = (event: Event) => {
      const item = event.currentTarget as HTMLElement;
      if (event.type === "focusout" && item.contains((event as FocusEvent).relatedTarget as Node | null)) return;
      if (item.dataset.open === "false") delete item.dataset.open;
    };
    dropdowns.forEach((item) => { item.addEventListener("mouseleave", resetIntent); item.addEventListener("focusout", resetIntent); });
    const desktop = window.matchMedia("(min-width: 768px)");
    const tablet = window.matchMedia("(min-width: 768px)");
    const desktopNav = header.querySelector("nav:not(#mobile-navigation)");
    const onBreakpoint = () => {
      const active = document.activeElement;
      const selected = themeOptions.find((option) => option.tabIndex === 0);
      if (desktop.matches) {
        const hiddenMenuFocus = active === menuButton || !!(active && menu?.contains(active));
        setMenu(false);
        if (hiddenMenuFocus) selected?.focus();
      } else if (active && desktopNav?.contains(active)) {
        closeDropdowns();
        menuButton?.focus();
      }
      if (tablet.matches && active === themeButton) selected?.focus();
      else if (!tablet.matches && themeOptions.some((option) => option === active)) themeButton?.focus();
    };

    header.addEventListener("click", onClick);
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener(V5_OPEN_CHAT_EVENT, onOpenChat, true);
    document.addEventListener("keydown", onKeyDown);
    themeButton?.addEventListener("click", onThemeClick);
    themeOptions.forEach((option) => option.addEventListener("click", onOptionClick));
    systemSwitch?.addEventListener("click", onSystemClick);
    desktop.addEventListener("change", onBreakpoint);
    tablet.addEventListener("change", onBreakpoint);
    scheme.addEventListener("change", onSchemeChange);
    return () => {
      window.cancelAnimationFrame(switching);
      root.removeAttribute("data-v5-theme-switching");
      scheme.removeEventListener("change", onSchemeChange);
      header.removeEventListener("click", onClick);
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener(V5_OPEN_CHAT_EVENT, onOpenChat, true);
      document.removeEventListener("keydown", onKeyDown);
      themeButton?.removeEventListener("click", onThemeClick);
      themeOptions.forEach((option) => option.removeEventListener("click", onOptionClick));
      systemSwitch?.removeEventListener("click", onSystemClick);
      desktop.removeEventListener("change", onBreakpoint);
      tablet.removeEventListener("change", onBreakpoint);
      dropdowns.forEach((item) => { item.removeEventListener("mouseleave", resetIntent); item.removeEventListener("focusout", resetIntent); });
    };
  }, [storageKey]);
  return null;
}
