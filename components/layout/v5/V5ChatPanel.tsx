"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { getAttribution } from "@/lib/acquisition";
import { getConsentData } from "@/lib/cookie-consent";
import { chatSurfaceGroup, resolveChatPanel, type ChatPageContext, type LineChatConfig, type LineChatResultTool } from "@/lib/line/chat-panel";
import type { V5ChatPanelTrigger } from "./chat-events";
import { V5_MOTION_MS } from "./motion-tokens";
import styles from "./V5ChatDock.module.css";

const CLOSE_LABEL = "ปิด";
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Arrow() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/**
 * Chat topics for this page: a bottom sheet on phones and a popover with a QR code on desktop.
 * Loaded and rendered only after the visitor taps the chat button. The campaign is read from this
 * page's URL; it follows the visitor to later pages only with analytics consent (L3, via
 * lib/acquisition.ts). Topic links open the @ccpun chat with owner-written text only.
 * The chat never depends on cookie consent (owner requirement 2026-10-26): a topic is a plain link
 * to line.me that opens whatever the visitor chose; only the analytics event is consent-gated, inside
 * trackEvent(), and it is fire-and-forget (never awaited, never blocks the link). On touch devices the
 * link opens in the same tab. Desktop selection displays its QR; only a QR failure offers a browser fallback.
 */
export default function V5ChatPanel({ config, context, trigger, resultTool, closing, onClose, onClosed }: { config: LineChatConfig; context: ChatPageContext; trigger: V5ChatPanelTrigger; resultTool?: LineChatResultTool; closing: boolean; onClose: () => void; onClosed: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [newTab] = useState(() => !window.matchMedia("(pointer: coarse)").matches);
  const [desktop] = useState(() => window.matchMedia("(hover: hover) and (pointer: fine)").matches
    && !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    && !(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [qr, setQr] = useState<{ href: string; viewBox?: string; path?: string; failed?: boolean } | null>(null);

  const panel = useMemo(() => {
    const consentGiven = getConsentData()?.analytics === true;
    let utmCampaign: string | null = null;
    try { utmCampaign = new URLSearchParams(window.location.search).get("utm_campaign"); } catch { /* no campaign */ }
    return resolveChatPanel({
      ...context,
      config,
      resultTool,
      utmCampaign,
      storedUtmCampaign: consentGiven ? getAttribution()?.utm_campaign : undefined,
      now: new Date(),
      consentGiven,
    });
  }, [config, context, resultTool]);

  const topics = panel.mode === "panel" ? panel.topics : [];
  const campaignCode = panel.mode === "panel" ? panel.campaignCode : undefined;
  const selectedTopic = desktop ? topics.find(topic => topic.id === selectedTopicId) : undefined;
  const qrHref = selectedTopic?.href;

  useEffect(() => {
    // panel_trigger (owner-approved 2026-10-25): which control opened it, the dock or an article-body LINE CTA.
    try { trackEvent("line_chat_panel_open", { page_group: panel.pageGroup, panel_trigger: trigger, ...(campaignCode ? { campaign_code: campaignCode } : {}) }); } catch { /* never blocks the panel */ }
    // One event per opening of this panel instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!qrHref) return;
    let cancelled = false;
    import("./qr-code").then(({ encodeQr, qrSvgPath }) => {
      const image = qrSvgPath(encodeQr(qrHref));
      if (!cancelled) setQr({ href: qrHref, ...image });
    }).catch(() => { if (!cancelled) setQr({ href: qrHref, failed: true }); });
    return () => { cancelled = true; };
  }, [qrHref]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || closing) return;
    // The panel is the top layer, also when it opens above the cookie notice (a modal with its own
    // focus guard). While it is open it owns Escape, Tab and focus for its own controls; once it
    // closes, the notice (if still open) takes focus back as before.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); return; }
      if (event.key !== "Tab") return;
      event.stopPropagation();
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      else if (!dialog.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    };
    const keepFocus = (event: FocusEvent) => { if (dialog.contains(event.target as Node)) event.stopPropagation(); };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("focusin", keepFocus, true);
    dialog.querySelector<HTMLElement>("[data-chat-topic]")?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("focusin", keepFocus, true);
    };
  }, [onClose, closing]);

  useEffect(() => {
    if (!closing) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    // The CSS root rule also disables motion when the visitor changes this preference mid-close.
    const finishIfReduced = () => { if (reduced.matches) onClosed(); };
    if (reduced.matches) { onClosed(); return; }
    const timeout = window.setTimeout(onClosed, V5_MOTION_MS.micro);
    reduced.addEventListener("change", finishIfReduced);
    return () => { window.clearTimeout(timeout); reduced.removeEventListener("change", finishIfReduced); };
  }, [closing, onClosed]);

  if (panel.mode !== "panel") return null;
  const surface = chatSurfaceGroup(panel.pageGroup);
  const trackTopic = (topic: typeof panel.topics[number]) => {
    try {
      trackEvent("line_oa_click", {
        contact_channel: "line", cta_location: "chat_panel", chat_topic_id: topic.id, page_group: panel.pageGroup,
        ...(surface ? { surface_group: surface } : {}), ...(campaignCode ? { campaign_code: campaignCode } : {}),
      });
    } catch { /* Analytics never stands between the visitor and the LINE chat. */ }
  };

  return (
    <>
      <div className={styles.backdrop} data-chat-state={closing ? "closing" : "open"} inert={closing} aria-hidden="true" onClick={onClose} />
      <div ref={dialogRef} id="v5-chat-panel" className={styles.panel} data-chat-state={closing ? "closing" : "open"} inert={closing} aria-hidden={closing || undefined} onAnimationEnd={event => { if (closing && event.target === event.currentTarget) onClosed(); }} role="dialog" aria-modal={closing ? undefined : true} aria-labelledby="v5-chat-title" aria-describedby="v5-chat-note">
        <div className={styles.panelHead}>
          <h2 id="v5-chat-title" className={styles.panelTitle}>{panel.headline}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={CLOSE_LABEL}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        <ul className={styles.topics}>
          {panel.topics.map((topic) => (
            <li key={topic.id}>
              <a data-chat-topic="" className={`${styles.topic} ${topic.journey === "type_own" ? styles.topicOwn : ""}`.trim()} href={topic.href} target={newTab ? "_blank" : undefined} rel="noopener noreferrer"
                aria-current={selectedTopic?.id === topic.id ? "true" : undefined}
                onClick={(event) => {
                  if (desktop && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                    event.preventDefault();
                    setSelectedTopicId(topic.id);
                    return;
                  }
                  trackTopic(topic);
                  window.setTimeout(onClose, 0);
                }}>
                <span>{topic.label}</span><Arrow />
              </a>
            </li>
          ))}
        </ul>
        <p id="v5-chat-note" className={styles.note}>{desktop ? "เลือกหัวข้อเพื่อแสดง QR" : panel.note}</p>
        {selectedTopic ? (
          <section className={styles.desktopChoice} aria-label={selectedTopic.label}>
            {qr && qr.href === qrHref && qr.path ? <>
              <svg className={styles.desktopQr} viewBox={qr.viewBox} role="img" aria-label={`สแกน QR เพื่อเปิด LINE: ${selectedTopic.label}`}><path d={qr.path} fill="currentColor" shapeRendering="crispEdges" /></svg>
              <p className={styles.desktopHint}>สแกนด้วยมือถือเพื่อส่งข้อความนี้ทาง LINE</p>
            </> : null}
            {qr && qr.href === qrHref && qr.failed ? <p role="status" className={styles.desktopHint}>แสดง QR ไม่สำเร็จ{" "}<a data-chat-qr-fallback="" className={styles.desktopFallback} href={selectedTopic.href} target="_blank" rel="noopener noreferrer" onClick={() => trackTopic(selectedTopic)}>เปิดหน้า LINE</a></p> : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
