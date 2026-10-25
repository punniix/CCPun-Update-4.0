import type { Metadata } from "next";

/**
 * Coming Soon registry (owner-approved concept, 2026-10-25, UAT).
 *
 * Only pages deliberately registered here render the Coming Soon page; every other unknown URL
 * keeps the real 404. URL ownership stays in lib/content (AGENTS.md): a registered path is a
 * planned physical URL, served noindex,follow, never listed in a sitemap and never canonical.
 * One Search Intent = One Owner: every entry names the closest existing page that satisfies the
 * intent today, and the Coming Soon page always links it.
 *
 * Production data is empty: no current link points at an unbuilt route (checked 2026-10-25:
 * nav config, header, footer, tool lists, tool guides). The single entry below is a UAT-only
 * example so the owner can review the page on test.ccpun.com.
 */

export type ComingSoonLane = "all" | "uat-only";

export type ComingSoonPage = {
  /** Planned physical path: `/tools/<slug>/` only (the route that serves it lives there). */
  path: `/tools/${string}/`;
  /** Short Thai page name, e.g. "คำนวณลดหย่อนภาษี". */
  title: string;
  /** One sentence: what a visitor will be able to do there. */
  intent: string;
  /** The existing page that serves the intent today (must be a live public owner). */
  closestExisting: { path: string; label: string; note: string; kind: "tool" | "article" };
  /** Expected opening, in Thai (e.g. "ไตรมาส 1 2570"), or null when there is no honest estimate. */
  expected: string | null;
  /** LINE chat topic id for this page (analytics `chat_topic_id`, never the chat text). */
  chatTopicId: string;
  /** Reference number shown to ปั้น as "(รหัส CSnn)"; unique within this registry, 1-99. */
  chatRef: number;
  /** Which layout the blueprint drawing sketches. */
  blueprint: "calculator" | "guide";
  lanes: ComingSoonLane;
};

const COMING_SOON_PAGES: readonly ComingSoonPage[] = [
  {
    path: "/tools/tax-deduction/",
    title: "คำนวณลดหย่อนภาษี",
    intent: "รวมรายการลดหย่อนที่ใช้ได้ แล้วดูว่าภาษีที่ต้องจ่ายลดลงเท่าไร",
    closestExisting: {
      path: "/blog/personal-finance/tax-deduction/",
      label: "บทความลดหย่อนภาษี",
      note: "อ่านรายการลดหย่อนและเงื่อนไขไปก่อน แล้วค่อยคำนวณเองได้",
      kind: "article",
    },
    expected: null,
    chatTopicId: "soon-tax-deduction",
    chatRef: 91,
    blueprint: "calculator",
    lanes: "uat-only",
  },
];

/** Lanes that may show UAT-only examples (same explicit lanes as Investment Allocation's default). */
const UAT_LANES = new Set(["web-uat", "local-uat"]);

/** Registered pages visible in a lane (pass `resolveContentEnvironment()` from server code). */
export function listComingSoonPages(environment: string): ComingSoonPage[] {
  return COMING_SOON_PAGES.filter((page) => page.lanes === "all" || UAT_LANES.has(environment));
}

/** The registered page for an exact path in this lane, or undefined (the caller then 404s). */
export function findComingSoonPage(path: string, environment: string): ComingSoonPage | undefined {
  return listComingSoonPages(environment).find((page) => page.path === path);
}

/** Every registry entry regardless of lane (tests and sitemap guards only). */
export function allComingSoonPages(): readonly ComingSoonPage[] {
  return COMING_SOON_PAGES;
}

/** Slug of a `/tools/<slug>/` path. */
export function comingSoonSlug(page: Pick<ComingSoonPage, "path">): string {
  return page.path.slice("/tools/".length, -1);
}

/** The LINE prefill a visitor sends from a Coming Soon page (no numbers, no personal data). */
export function comingSoonChatPrefill(page: Pick<ComingSoonPage, "title">): string {
  return `อยากใช้หน้า${page.title} เมื่อพร้อมแล้วแจ้งด้วยครับ`;
}

export const COMING_SOON_CHAT_LABEL = "แจ้งเมื่อหน้านี้พร้อม";

/**
 * SEO safety (owner-approved concept, 2026-10-25): a planned page is never an owner. It is
 * noindex,follow in every lane, emits no canonical, stays out of every sitemap and links the
 * closest existing page that satisfies the same intent today.
 */
export function comingSoonMetadata(page: ComingSoonPage): Metadata {
  const title = `${page.title} (กำลังสร้าง) | CCPun`;
  return {
    title,
    description: page.intent,
    alternates: { canonical: null },
    robots: { index: false, follow: true },
    openGraph: { title, description: page.intent, siteName: "CCPun Financial Advisor", locale: "th_TH", type: "website" },
    twitter: { card: "summary", title, description: page.intent },
  };
}
