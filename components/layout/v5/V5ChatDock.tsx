"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { trackEvent } from "@/lib/analytics";
import { chatPageGroupToken, chatSurfaceGroup, type ChatPageContext, type LineChatConfig } from "@/lib/line/chat-panel";
import { LINE_OA_CHAT_URL } from "@/lib/line/oa-link";
import { V5_OPEN_CHAT_EVENT, type V5ChatPanelTrigger, type V5OpenChatDetail } from "./chat-events";
import { useHydrated } from "./V5ChatLink";
import styles from "./V5ChatDock.module.css";

// The panel, its resolver and the QR encoder load on the first tap only (zero LCP/CLS cost).
const V5ChatPanel = lazy(() => import("./V5ChatPanel"));

const LABEL = "คุยกับปั้นทาง LINE";
const SCROLL_DELTA = 6;
/** Below the hero, reading on downward for this many pixels tucks the bar away (D3). */
const HIDE_AFTER = 360;
/** The consent dialog (rendered outside the v5 root); the dock sits above it while it is open. */
const COOKIE_DIALOG = '[role="dialog"][aria-labelledby^="cookie"]';

function ChatIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4c-4.97 0-9 3.13-9 7 0 2.2 1.31 4.16 3.36 5.44L5.5 20l4.03-2.2c.8.16 1.62.2 2.47.2 4.97 0 9-3.13 9-7s-4.03-7-9-7Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}

/**
 * The page's one LINE element (owner decision 2026-10-25: one LINE OA button per page; L8 merged the
 * chat button and the sticky bar). Server-rendered and visible from page load, over the hero too;
 * below the hero it tucks away while reading down and returns on scroll up (D3). While the cookie
 * notice is open the dock sits just above it (a transform, so no layout shift) and steps aside if the
 * notice fills most of the screen. Its href is the real LINE OA link with this page's prefill, the
 * no-JS fallback; with JavaScript it opens the topic panel. Article-body LINE CTAs open the same
 * panel through V5_OPEN_CHAT_EVENT. All clicks go through trackEvent(), which stays consent-gated.
 */
export default function V5ChatDock({ config, context, fallbackHref }: { config: LineChatConfig; context: ChatPageContext; fallbackHref: string }) {
  const [shown, setShown] = useState(true);
  const enhanced = useHydrated();
  const [cookieOffset, setCookieOffset] = useState(0);
  const [cookieCovers, setCookieCovers] = useState(false);
  const [panel, setPanel] = useState<{ trigger: V5ChatPanelTrigger; returnTo: HTMLElement | null } | null>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const token = chatPageGroupToken(context);

  useEffect(() => {
    let heroBottom = 480;
    let lastY = window.scrollY;
    let revealY = 0;
    let visible = true;
    let frame = 0;
    const set = (next: boolean) => { if (next !== visible) { visible = next; setShown(next); } };
    // Measured on every throttled frame, so a late-loading hero or a rotated phone is handled
    // without a window size listener. The hero is the first section in <main>; it is capped at
    // 1.25 screens so a tall first block never keeps the tuck behaviour away.
    const measure = () => {
      const hero = document.querySelector("#main-content section") ?? document.querySelector("#main-content > :first-child");
      const bottom = hero ? hero.getBoundingClientRect().bottom + window.scrollY - 80 : 480;
      heroBottom = Math.max(240, Math.min(bottom, window.innerHeight * 1.25));
    };
    const update = () => {
      frame = 0;
      measure();
      const y = window.scrollY;
      const delta = y - lastY;
      if (y < heroBottom) {
        // Visible from page load and over the hero.
        set(true);
        revealY = heroBottom;
      } else if (delta < -SCROLL_DELTA) {
        // Scrolling back up brings it back.
        set(true);
        revealY = y;
      } else if (delta > SCROLL_DELTA && y > revealY + HIDE_AFTER) {
        set(false);
      }
      if (Math.abs(delta) > SCROLL_DELTA || y < heroBottom) lastY = y;
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    // Cookie-sheet offset: the notice mounts after a short delay, grows into the preferences panel
    // and unmounts on save or Escape, so its box is watched rather than read once.
    let observed: Element | null = null;
    let frame = 0;
    const resize = typeof ResizeObserver === "function" ? new ResizeObserver(() => schedule()) : null;
    const measure = () => {
      frame = 0;
      const dialog = document.querySelector(COOKIE_DIALOG);
      if (dialog !== observed) {
        if (observed) resize?.unobserve(observed);
        if (dialog) resize?.observe(dialog);
        observed = dialog;
      }
      const offset = dialog ? Math.max(0, Math.round(window.innerHeight - dialog.getBoundingClientRect().top)) : 0;
      setCookieOffset(offset);
      setCookieCovers(offset > window.innerHeight * 0.5);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("ccpun:consent", schedule);
    measure();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mutations.disconnect();
      resize?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("ccpun:consent", schedule);
    };
  }, []);

  useEffect(() => {
    // Article-body LINE CTAs ask the dock to open the panel (or, with the panel switched off,
    // let their own LINE link open and record the click like the plain dock link does).
    const onOpenChat = (event: Event) => {
      const detail = (event as CustomEvent<V5OpenChatDetail>).detail;
      if (!detail) return;
      if (!config.enabled) {
        trackEvent("line_oa_click", { contact_channel: "line", cta_location: "blog_article", page_group: token, surface_group: chatSurfaceGroup(token) });
        return;
      }
      event.preventDefault();
      setPanel({ trigger: detail.trigger, returnTo: detail.returnTo ?? null });
    };
    window.addEventListener(V5_OPEN_CHAT_EVENT, onOpenChat);
    return () => window.removeEventListener(V5_OPEN_CHAT_EVENT, onOpenChat);
  }, [config.enabled, token]);

  const close = useCallback(() => {
    const returnTo = panel?.returnTo;
    setPanel(null);
    window.requestAnimationFrame(() => (returnTo && returnTo.isConnected ? returnTo : triggerRef.current)?.focus());
  }, [panel]);

  const open = panel !== null;
  const state = open || (shown && !cookieCovers) ? "shown" : "hidden";
  const style = cookieOffset > 0 && !cookieCovers ? { "--v5-dock-offset": `${cookieOffset}px` } as CSSProperties : undefined;

  if (!config.enabled) {
    return (
      <div className={styles.dock} data-state={state} style={style} data-v5-chat-dock="">
        <a className={styles.trigger} href={LINE_OA_CHAT_URL} target="_blank" rel="noopener noreferrer"
          onClick={() => trackEvent("line_oa_click", { contact_channel: "line", cta_location: "chat_button", page_group: token, surface_group: chatSurfaceGroup(token) })}>
          <ChatIcon />{LABEL}
        </a>
      </div>
    );
  }

  return (
    <>
      <div className={styles.dock} data-state={state} style={style} data-v5-chat-dock="">
        <a ref={triggerRef} className={styles.trigger} href={fallbackHref} target="_blank" rel="noopener noreferrer"
          role={enhanced ? "button" : undefined} aria-haspopup={enhanced ? "dialog" : undefined} aria-expanded={enhanced ? open : undefined} aria-controls={open ? "v5-chat-panel" : undefined}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            setPanel({ trigger: "dock", returnTo: null });
          }}
          onKeyDown={(event) => {
            // role="button": Space activates it like a button (Enter already follows the click).
            if (event.key === " ") { event.preventDefault(); setPanel({ trigger: "dock", returnTo: null }); }
          }}>
          <ChatIcon />{LABEL}
        </a>
      </div>
      {panel ? <Suspense fallback={null}><V5ChatPanel config={config} context={context} trigger={panel.trigger} onClose={close} /></Suspense> : null}
    </>
  );
}
