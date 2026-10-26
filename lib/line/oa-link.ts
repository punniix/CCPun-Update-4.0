/**
 * The one LINE Official Account every website chat CTA opens. It is a code constant on
 * purpose: Admin and Sanity can change chat topics and wording, never the destination
 * (LINE chat system decision, owner-approved 2026-10-25).
 */
export const LINE_OA_ID = "@ccpun";

/** Opens the @ccpun chat (or the add-friend page when the person is not a friend yet). */
export const LINE_OA_CHAT_URL = `https://line.me/R/ti/p/${encodeURIComponent(LINE_OA_ID)}`;

const OA_MESSAGE_PREFIX = `https://line.me/R/oaMessage/${encodeURIComponent(LINE_OA_ID)}/?`;

/**
 * LINE "send a message to an official account" link. LINE fills the chat box with `text`;
 * nothing is sent until the person taps send. Callers pass only owner-written copy:
 * never calculator results, numbers a person typed, or personal data.
 */
export function buildLineOaMessageHref(text: string): string {
  return OA_MESSAGE_PREFIX + encodeURIComponent(text.trim());
}

export function isLineOaMessageHref(href: string): boolean {
  return href.startsWith(OA_MESSAGE_PREFIX);
}
