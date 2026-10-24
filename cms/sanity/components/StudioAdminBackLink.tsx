"use client";

import type { NavbarProps } from "sanity";

// A plain same-origin link back to the CCPun Admin home. It does not change any
// Studio auth, lane, project or dataset guard; "/" resolves to the landing page
// of whichever Admin lane (Production or UAT) is serving this Studio.
export function StudioAdminBackLink() {
  // Studio config is also loaded by the Sanity CLI (no Next router), and leaving
  // Studio with a full navigation resets its router cleanly.
  // eslint-disable-next-line @next/next/no-html-link-for-pages
  return <a
    href="/"
    data-ccpun-admin-back-link=""
    style={{ display: "flex", alignItems: "center", minHeight: 44, padding: "0 16px", fontSize: 14, fontWeight: 500, color: "inherit", textDecoration: "none", whiteSpace: "nowrap", borderBottom: "1px solid var(--card-border-color)" }}
  >← กลับศูนย์จัดการ</a>;
}

export function StudioNavbarWithAdminBackLink(props: NavbarProps) {
  return <>
    <StudioAdminBackLink />
    {props.renderDefault(props)}
  </>;
}
