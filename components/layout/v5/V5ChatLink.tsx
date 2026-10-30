"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { V5_OPEN_CHAT_EVENT, type V5ChatPanelTrigger, type V5OpenChatDetail } from "./chat-events";
import { exemptFromInert, restoreInert, type InertRecord } from "./chat-layer";

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
 * `trigger` names another control that opens the panel the same way (Coming Soon); `onActivate`
 * runs once per primary click before the panel opens (the control's own semantic event).
 */
export default function V5ChatLink({ href, className, children, trigger = "article_cta", resultTool, onActivate }: { href: string; className?: string; children: ReactNode; trigger?: V5ChatPanelTrigger; resultTool?: V5OpenChatDetail["resultTool"]; onActivate?: () => void }) {
  const enhanced = useHydrated();
  const linkRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const link = linkRef.current;
    if (!resultTool || !link) return;
    const exempted: InertRecord[] = [];
    const sync = () => {
      if (document.querySelector('[role="dialog"][aria-labelledby^="cookie"]')) exemptFromInert(link, exempted);
      else restoreInert(exempted);
    };
    // ponytail: MutationObserver already batches DOM changes; no animation-frame scheduler is needed.
    const observer = new window.MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["inert"] });
    window.addEventListener("ccpun:consent", sync);
    sync();
    return () => {
      observer.disconnect();
      window.removeEventListener("ccpun:consent", sync);
      restoreInert(exempted);
    };
  }, [resultTool]);
  return (
    <a
      href={href}
      ref={linkRef}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      data-v5-chat-link=""
      aria-haspopup={enhanced ? "dialog" : undefined}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        try { onActivate?.(); } catch { /* the control's own event never blocks the chat */ }
        const detail: V5OpenChatDetail = { trigger, returnTo: event.currentTarget };
        if (resultTool === "ci" || resultTool === "fhc") detail.resultTool = resultTool;
        // The dock cancels the event when it opened the panel; otherwise the LINE link opens.
        if (!window.dispatchEvent(new CustomEvent<V5OpenChatDetail>(V5_OPEN_CHAT_EVENT, { cancelable: true, detail }))) event.preventDefault();
      }}
    >
      {children}
    </a>
  );
}
