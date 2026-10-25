"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { getConsentData } from "@/lib/cookie-consent";
import { chatPageGroupToken, chatSurfaceGroup, type ChatPageContext, type LineChatConfig } from "@/lib/line/chat-panel";
import { LINE_OA_CHAT_URL } from "@/lib/line/oa-link";
import styles from "./V5ChatDock.module.css";

// The panel, its resolver and the QR encoder load on the first tap only (zero LCP/CLS cost).
const V5ChatPanel = lazy(() => import("./V5ChatPanel"));

const LABEL = "คุยกับปั้นทาง LINE";
const SCROLL_DELTA = 6;
/** After the reveal, reading on downward for this many pixels tucks the bar away (D3). */
const HIDE_AFTER = 360;

function ChatIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4c-4.97 0-9 3.13-9 7 0 2.2 1.31 4.16 3.36 5.44L5.5 20l4.03-2.2c.8.16 1.62.2 2.47.2 4.97 0 9-3.13 9-7s-4.03-7-9-7Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}

/**
 * The one bottom LINE element (L8: the chat button and the sticky LINE bar are merged). It shows
 * after the hero, hides while scrolling down and returns on scroll up (D3), and stays out of the
 * way of the cookie banner. All clicks go through trackEvent(), which stays consent-gated.
 */
export default function V5ChatDock({ config, context }: { config: LineChatConfig; context: ChatPageContext }) {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let heroBottom = 480;
    let lastY = window.scrollY;
    let revealY = Number.POSITIVE_INFINITY;
    let visible = false;
    let frame = 0;
    let consentDecided = Boolean(getConsentData());
    const set = (next: boolean) => { if (next !== visible) { visible = next; setShown(next); } };
    // Measured on every throttled frame, so a late-loading hero or a rotated phone is handled
    // without a window size listener.
    const measure = () => {
      const hero = document.querySelector("#main-content > :first-child");
      heroBottom = hero ? Math.max(240, hero.getBoundingClientRect().bottom + window.scrollY - 80) : 480;
    };
    const update = () => {
      frame = 0;
      measure();
      const y = window.scrollY;
      const delta = y - lastY;
      if (!consentDecided || y < heroBottom) {
        set(false);
        revealY = Number.POSITIVE_INFINITY;
      } else if (lastY < heroBottom || delta < -SCROLL_DELTA) {
        // Crossing the hero reveals the bar; scrolling back up brings it back.
        set(true);
        revealY = y;
      } else if (delta > SCROLL_DELTA && y > revealY + HIDE_AFTER) {
        set(false);
      }
      if (Math.abs(delta) > SCROLL_DELTA || y < heroBottom) lastY = y;
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const onConsent = () => { consentDecided = Boolean(getConsentData()); update(); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("ccpun:consent", onConsent);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("ccpun:consent", onConsent);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const token = chatPageGroupToken(context);
  const visible = shown || open;

  if (!config.enabled) {
    return (
      <div className={styles.dock} data-state={visible ? "shown" : "hidden"} data-v5-chat-dock="">
        <a className={styles.trigger} href={LINE_OA_CHAT_URL} target="_blank" rel="noopener noreferrer"
          onClick={() => trackEvent("line_oa_click", { contact_channel: "line", cta_location: "chat_button", page_group: token, surface_group: chatSurfaceGroup(token) })}>
          <ChatIcon />{LABEL}
        </a>
      </div>
    );
  }

  return (
    <>
      <div className={styles.dock} data-state={visible ? "shown" : "hidden"} data-v5-chat-dock="">
        <button ref={triggerRef} type="button" className={styles.trigger} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? "v5-chat-panel" : undefined}
          onClick={() => setOpen(true)}>
          <ChatIcon />{LABEL}
        </button>
      </div>
      {open ? <Suspense fallback={null}><V5ChatPanel config={config} context={context} onClose={close} /></Suspense> : null}
    </>
  );
}

