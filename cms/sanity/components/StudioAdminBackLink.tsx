"use client";

import { Card, Text } from "@sanity/ui";
import type { NavbarProps } from "sanity";

// A plain same-origin link back to the CCPun Admin home. It does not change any
// Studio auth, lane, project or dataset guard; "/" resolves to the landing page
// of whichever Admin lane (Production or UAT) is serving this Studio.
export function StudioAdminBackLink() {
  return <Card borderBottom paddingX={4} paddingY={3} data-ccpun-admin-back-link="">
    <Text size={1} weight="medium">
      {/* Studio config is also loaded by the Sanity CLI (no Next router), and leaving
          Studio with a full navigation resets its router cleanly. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" style={{ color: "inherit", textDecoration: "none", whiteSpace: "nowrap" }}>← กลับศูนย์จัดการ</a>
    </Text>
  </Card>;
}

export function StudioNavbarWithAdminBackLink(props: NavbarProps) {
  return <>
    <StudioAdminBackLink />
    {props.renderDefault(props)}
  </>;
}
