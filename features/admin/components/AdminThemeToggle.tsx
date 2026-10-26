"use client";

import "./admin-theme.css";

// Owner decision 5.5 (2026-10-26): the light theme applies to every Admin page. The choice is a
// per-device convenience (localStorage); with no choice yet the device setting decides, and
// without JavaScript Admin stays in its original dark theme. The tiny script runs while the
// header is parsed, before the page paints, so a light choice never flashes dark first.
export const ADMIN_THEME_STORAGE_KEY = "ccpun-admin-theme";
export const ADMIN_THEME_BOOT_SCRIPT = `(function(){var d=document.documentElement,t="dark";try{var s=localStorage.getItem("${ADMIN_THEME_STORAGE_KEY}");t=s==="light"||s==="dark"?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark")}catch(e){}d.setAttribute("data-admin-theme",t)})();`;

function toggleAdminTheme() {
  const root = document.documentElement;
  const next = root.getAttribute("data-admin-theme") === "light" ? "dark" : "light";
  root.setAttribute("data-admin-theme", next);
  try {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, next);
  } catch {
    // Storage can be blocked (private mode); the theme still switches for this page view.
  }
}

export default function AdminThemeToggle() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: ADMIN_THEME_BOOT_SCRIPT }} />
      <button
        type="button"
        onClick={toggleAdminTheme}
        data-admin-theme-toggle=""
        className="min-h-11 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
      >
        <span data-admin-theme-label="light">ธีมสว่าง</span>
        <span data-admin-theme-label="dark">ธีมมืด</span>
      </button>
    </>
  );
}
