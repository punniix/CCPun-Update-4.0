"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import shell from "@/components/layout/v5/V5.module.css";
import V5ChatLink from "@/components/layout/v5/V5ChatLink";
import { exemptFromInert, restoreInert, type InertRecord } from "@/components/layout/v5/chat-layer";

/** The consent notice (rendered outside the v5 root); while it is open it makes the page inert. */
const COOKIE_DIALOG = '[role="dialog"][aria-labelledby^="cookie"]';

/**
 * "อยากให้เสร็จเร็ว" (owner addendum 2026-10-26): one tap opens the page's LINE chat panel with the
 * "แจ้งเมื่อหน้านี้พร้อม" topic first (the dock owns the panel; this control asks it to open, like an
 * article-body LINE CTA). Without JavaScript, or with the panel switched off, the link opens the
 * @ccpun chat with this page's prefill directly. No confirmation text: the panel is the response.
 * It works whatever the cookie choice, like the dock: while the notice is open the button stays
 * usable above it (the same inert-boundary narrowing the dock uses; the notice itself is unchanged).
 * One semantic, consent-gated event per page view carries only the planned path.
 */
export default function ComingSoonInterest({ path, href }: { path: string; href: string }) {
  const sent = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const exempted: InertRecord[] = [];
    let frame = 0;
    const sync = () => {
      frame = 0;
      if (document.querySelector(COOKIE_DIALOG)) exemptFromInert(node, exempted);
      else restoreInert(exempted);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(sync); };
    // The notice mounts after a delay and sets inert in an effect, so both are watched.
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["inert"] });
    window.addEventListener("ccpun:consent", schedule);
    sync();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mutations.disconnect();
      window.removeEventListener("ccpun:consent", schedule);
      restoreInert(exempted);
    };
  }, []);

  return (
    <div ref={wrapRef} className={shell.buttonRow}>
      <V5ChatLink
        href={href}
        className={shell.buttonOutline}
        trigger="coming_soon"
        onActivate={() => {
          if (sent.current) return;
          sent.current = true;
          trackEvent("coming_soon_interest", { coming_soon_path: path });
        }}
      >
        อยากให้เสร็จเร็ว
      </V5ChatLink>
    </div>
  );
}
