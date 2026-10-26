/**
 * One LINE element per page (owner decision 2026-10-25): the floating chat dock owns the chat
 * panel. Other controls that should open the same panel (article-body LINE CTAs) dispatch this
 * cancellable window event; the dock cancels it when it opened the panel, so the control's real
 * LINE OA href stays the no-JS (and not-yet-hydrated) fallback.
 */
export const V5_OPEN_CHAT_EVENT = "ccpun:open-chat";

/**
 * `panel_trigger` on line_chat_panel_open: which control opened the panel. "coming_soon" is the
 * Coming Soon "อยากให้เสร็จเร็ว" button (owner addendum 2026-10-26); it is not in the analytics
 * allowlist yet, so lib/analytics.ts drops that value and the event carries page_group only.
 */
export type V5ChatPanelTrigger = "dock" | "article_cta" | "coming_soon";

export type V5OpenChatDetail = { trigger: V5ChatPanelTrigger; returnTo?: HTMLElement | null; resultTool?: "ci" | "fhc" };

/**
 * A link that contacts the @ccpun LINE OA (lin.ee short link, line.me / page.line.me chat or add
 * friend links, or anything naming @ccpun). LINE share links (social-plugins.line.me) are not.
 */
export function isLineOaContactHref(href: string | undefined | null): boolean {
  if (!href) return false;
  const value = href.trim();
  return /^https?:\/\/(?:www\.|page\.)?(?:lin\.ee|line\.me)\//i.test(value) || /(?:@|%40)ccpun\b/i.test(value);
}
