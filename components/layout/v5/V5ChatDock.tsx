"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { trackEvent } from "@/lib/analytics";
import { chatPageGroupToken, chatSurfaceGroup, type ChatPageContext, type LineChatConfig } from "@/lib/line/chat-panel";
import { LINE_OA_CHAT_URL } from "@/lib/line/oa-link";
import { V5_OPEN_CHAT_EVENT, type V5ChatPanelTrigger, type V5OpenChatDetail } from "./chat-events";
import { useHydrated } from "./V5ChatLink";
import { exemptFromInert, restoreInert, type InertRecord } from "./chat-layer";
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
 * below the hero it tucks away while reading down and returns on scroll up, at the page end and after
 * the panel closes (D3; it never stays hidden). The chat does not depend on cookie consent (owner
 * requirement 2026-10-26): while the cookie notice is open the dock stays visible just above it (a
 * transform, so no layout shift, kept on screen however tall the notice grows). The notice is a
 * modal that makes the page inert; the dock keeps its own chat layer out of that boundary
 * (chat-layer.ts), so it stays usable above the notice. Its href is the real LINE OA link with this
 * page's prefill, the no-JS fallback; with JavaScript it opens the topic panel. Article-body LINE CTAs open the same
 * panel through V5_OPEN_CHAT_EVENT. All clicks go through trackEvent(), which stays consent-gated.
 */
export default function V5ChatDock({ config, context, fallbackHref }: { config: LineChatConfig; context: ChatPageContext; fallbackHref: string }) {
  const [shown, setShown] = useState(true);
  const enhanced = useHydrated();
  const [cookieOffset, setCookieOffset] = useState(0);
  const [panel, setPanel] = useState<{ trigger: V5ChatPanelTrigger; returnTo: HTMLElement | null; closing?: boolean; instance: number; resultTool?: V5OpenChatDetail["resultTool"] } | null>(null);
  const panelSequence = useRef(0);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<() => void>(() => undefined);
  const measureCollisionRef = useRef<() => void>(() => undefined);
  const token = chatPageGroupToken(context);

  useEffect(() => {
    let heroBottom = 480;
    let lastY = window.scrollY;
    let revealY = 0;
    let visible = true;
    let frame = 0;
    const set = (next: boolean) => { if (next !== visible) { visible = next; setShown(next); } };
    // Closing the panel brings the dock back, so the trigger is always there afterwards.
    revealRef.current = () => { set(true); revealY = window.scrollY; lastY = revealY; };
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
      } else if (y + window.innerHeight >= document.documentElement.scrollHeight - 4) {
        // At the end of the page it comes back.
        set(true);
        revealY = y;
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
    const exempted: InertRecord[] = [];
    // Resize callbacks run after layout and before paint, so the dock follows a growing notice in the same frame.
    const boxObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => measure()) : null;
    const measure = () => {
      frame = 0;
      const dialog = document.querySelector(COOKIE_DIALOG);
      if (dialog !== observed) {
        if (observed) boxObserver?.unobserve(observed);
        if (dialog) boxObserver?.observe(dialog);
        observed = dialog;
      }
      // The notice is fixed to the bottom edge, so its height is the offset (watching its box also
      // covers reflow when the window width changes), capped so the dock itself stays on screen.
      const height = dialog ? dialog.getBoundingClientRect().height : 0;
      const room = window.innerHeight - (dockRef.current?.getBoundingClientRect().height ?? 0);
      const offset = Math.round(Math.max(0, Math.min(height, room)));
      // Written straight onto the layer as well, so the dock moves in the frame the notice paints (the React
      // state below carries the same value one render later); no frame shows the dock behind the notice.
      if (offset > 0) layerRef.current?.style.setProperty("--v5-dock-offset", `${offset}px`);
      else layerRef.current?.style.removeProperty("--v5-dock-offset");
      setCookieOffset(offset);
      measureCollisionRef.current();
      // While the notice is open it makes the rest of the page inert; the chat layer stays out of it.
      if (dialog && layerRef.current) exemptFromInert(layerRef.current, exempted);
      else if (!dialog) restoreInert(exempted);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    // A notice that just mounted or unmounted is handled before the next paint; other page mutations stay frame-throttled.
    const mutations = new MutationObserver(() => { if (document.querySelector(COOKIE_DIALOG) !== observed) measure(); else schedule(); });
    // The notice sets inert in an effect after it mounts, so inert changes are watched too.
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["inert"] });
    window.addEventListener("ccpun:consent", schedule);
    measure();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mutations.disconnect();
      boxObserver?.disconnect();
      window.removeEventListener("ccpun:consent", schedule);
      restoreInert(exempted);
    };
  }, []);

  useEffect(() => {
    // C17 owner exception: move up only when the original mobile corner overlaps a visible
    // heading/form box. Always solve from the fixed corner, never from the previous lift.
    const dock = dockRef.current;
    const layer = layerRef.current;
    if (!dock || !layer) return;
    let frame = 0;
    let disposed = false;
    let applied = 0;
    const apply = (lift: number) => {
      if (lift === applied) return;
      applied = lift;
      if (lift > 0) layer.style.setProperty("--v5-dock-collision-offset", `${lift}px`);
      else layer.style.removeProperty("--v5-dock-collision-offset");
    };
    const measure = () => {
      if (window.innerWidth >= 1024) { apply(0); return; }
      const rect = dock.getBoundingClientRect();
      const bottom = parseFloat(getComputedStyle(dock).bottom) || 0;
      const cookie = parseFloat(layer.style.getPropertyValue("--v5-dock-offset")) || 0;
      const baseline = window.innerHeight - bottom - rect.height - cookie;
      const boxes = Array.from(document.querySelectorAll("h1,h2,h3,label,input"), element => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0
          && box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < window.innerHeight
          && box.left < rect.right && box.right > rect.left ? box : null;
      }).filter((box): box is DOMRect => box !== null);
      const minimumTop = Math.max(0, document.querySelector("[data-v5-header]")?.getBoundingClientRect().bottom ?? 0);
      let top = baseline;
      // Every step crosses at least one box top, so the search is bounded by the box count.
      for (let step = 0; step <= boxes.length; step++) {
        const collisions = boxes.filter(box => top < box.bottom && top + rect.height > box.top);
        if (!collisions.length) break;
        const next = Math.min(...collisions.map(box => box.top)) - rect.height - 4;
        if (next < minimumTop) { top = baseline; break; } // No free interval: preserve the reachable corner.
        top = next;
      }
      apply(Math.max(0, baseline - top));
    };
    const schedule = () => { if (!disposed && !frame) frame = window.requestAnimationFrame(() => { frame = 0; measure(); }); };
    measureCollisionRef.current = measure;
    // Observe content only: writing the dock's translate variable cannot trigger this observer.
    const content = [document.querySelector("#main-content"), document.querySelector("footer")].filter((node): node is Element => node !== null);
    const mutations = new MutationObserver(schedule);
    const sizes = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    for (const node of content) {
      mutations.observe(node, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "hidden", "open", "type", "aria-hidden"] });
      sizes?.observe(node);
      node.addEventListener("load", schedule, true);
    }
    sizes?.observe(dock);
    window.addEventListener("scroll", schedule, { passive: true });
    // Keep this DOM event name out of Tailwind's literal utility-class scan.
    const viewportEvent = ["re", "size"].join("");
    window.addEventListener(viewportEvent, schedule);
    document.fonts?.addEventListener("loadingdone", schedule);
    document.fonts?.ready.then(schedule);
    measure();
    return () => {
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      measureCollisionRef.current = () => undefined;
      mutations.disconnect(); sizes?.disconnect();
      for (const node of content) node.removeEventListener("load", schedule, true);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener(viewportEvent, schedule);
      document.fonts?.removeEventListener("loadingdone", schedule);
      layer.style.removeProperty("--v5-dock-collision-offset");
    };
  }, []);

  useEffect(() => {
    // Article-body LINE CTAs ask the dock to open the panel (or, with the panel switched off,
    // let their own LINE link open and record the click like the plain dock link does).
    const onOpenChat = (event: Event) => {
      const detail = (event as CustomEvent<V5OpenChatDetail>).detail;
      if (!detail) return;
      const resultTool = detail.resultTool === "ci" && token === "tool_ci" ? "ci" : detail.resultTool === "fhc" && token === "tool_fhc" ? "fhc" : undefined;
      if (!config.enabled) {
        // Only article-body CTAs (incl. calculator result actions) record a plain LINE click here; Coming Soon records its own interest event.
        if (detail.trigger === "article_cta") trackEvent("line_oa_click", { contact_channel: "line", cta_location: resultTool === "ci" ? "ci_result" : resultTool === "fhc" ? "fhc_result" : "blog_article", page_group: token, surface_group: chatSurfaceGroup(token) });
        return;
      }
      event.preventDefault();
      setPanel({ instance: ++panelSequence.current, trigger: detail.trigger, returnTo: detail.returnTo ?? null, ...(resultTool ? { resultTool } : {}) });
    };
    window.addEventListener(V5_OPEN_CHAT_EVENT, onOpenChat);
    return () => window.removeEventListener(V5_OPEN_CHAT_EVENT, onOpenChat);
  }, [config.enabled, token]);

  const close = useCallback(() => {
    setPanel(current => current ? { ...current, closing: true } : null);
    revealRef.current();
    // Release the hit area and focus in this event, before React paints the closing frame.
    layerRef.current?.querySelectorAll<HTMLElement>("[data-chat-state]").forEach(node => {
      node.dataset.chatState = "closing";
      node.inert = true;
    });
    dockRef.current?.setAttribute("data-state", "shown");
    triggerRef.current?.focus({ preventScroll: true });
  }, []);
  const finishClose = useCallback(() => setPanel(current => current?.closing ? null : current), []);

  const open = panel !== null && !panel.closing;
  const state = open || shown ? "shown" : "hidden";
  const style = cookieOffset > 0 ? { "--v5-dock-offset": `${cookieOffset}px` } as CSSProperties : undefined;

  if (!config.enabled) {
    return (
      <div ref={layerRef} className={styles.layer} style={style} data-v5-chat-layer="">
        <div ref={dockRef} className={styles.dock} data-state={state} data-v5-chat-dock="">
          <a className={styles.trigger} href={LINE_OA_CHAT_URL} target="_blank" rel="noopener noreferrer"
            onClick={() => trackEvent("line_oa_click", { contact_channel: "line", cta_location: "chat_button", page_group: token, surface_group: chatSurfaceGroup(token) })}>
            <ChatIcon /><span className={styles.triggerLabel}>{LABEL}</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div ref={layerRef} className={styles.layer} style={style} data-v5-chat-layer="">
      <div ref={dockRef} className={styles.dock} data-state={state} data-v5-chat-dock="">
        <a ref={triggerRef} className={styles.trigger} href={fallbackHref} target="_blank" rel="noopener noreferrer"
          role={enhanced ? "button" : undefined} aria-haspopup={enhanced ? "dialog" : undefined} aria-expanded={enhanced ? open : undefined} aria-controls={open ? "v5-chat-panel" : undefined}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            setPanel({ instance: ++panelSequence.current, trigger: "dock", returnTo: null });
          }}
          onKeyDown={(event) => {
            // role="button": Space activates it like a button (Enter already follows the click).
            if (event.key === " ") { event.preventDefault(); setPanel({ instance: ++panelSequence.current, trigger: "dock", returnTo: null }); }
          }}>
          <ChatIcon /><span className={styles.triggerLabel}>{LABEL}</span>
        </a>
      </div>
      {panel ? <Suspense fallback={null}><V5ChatPanel key={panel.instance} config={config} context={context} trigger={panel.trigger} resultTool={panel.resultTool} closing={panel.closing === true} onClose={close} onClosed={finishClose} /></Suspense> : null}
    </div>
  );
}
