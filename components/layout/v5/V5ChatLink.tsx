"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { V5_OPEN_CHAT_EVENT, type V5OpenChatDetail } from "./chat-events";

const noSubscribe = () => () => undefined;

/** False in the server HTML and during hydration, true afterwards: button semantics only once JS runs. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

/**
 * Inline, link-styled control for an article-body LINE CTA (owner decision 2026-10-25, addendum 5).
 * It opens the same chat panel as the dock (the page's one LINE element). Without JavaScript, or
 * before the dock has hydrated, the real LINE OA link with this page's prefill opens instead.
 * Tracking stays with the dock/panel: line_chat_panel_open with panel_trigger "article_cta".
 */
export default function V5ChatLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const enhanced = useHydrated();
  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      data-v5-chat-link=""
      aria-haspopup={enhanced ? "dialog" : undefined}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const detail: V5OpenChatDetail = { trigger: "article_cta", returnTo: event.currentTarget };
        // The dock cancels the event when it opened the panel; otherwise the LINE link opens.
        if (!window.dispatchEvent(new CustomEvent<V5OpenChatDetail>(V5_OPEN_CHAT_EVENT, { cancelable: true, detail }))) event.preventDefault();
      }}
    >
      {children}
    </a>
  );
}
