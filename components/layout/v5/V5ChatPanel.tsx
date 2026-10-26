"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { getAttribution } from "@/lib/acquisition";
import { getConsentData } from "@/lib/cookie-consent";
import { chatSurfaceGroup, LINE_CHAT_QR_LABEL, resolveChatPanel, type ChatPageContext, type LineChatConfig } from "@/lib/line/chat-panel";
import type { V5ChatPanelTrigger } from "./chat-events";
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
 * link opens in the same tab, where the LINE app takes it over; elsewhere a new tab shows LINE's page.
 */
export default function V5ChatPanel({ config, context, trigger, onClose }: { config: LineChatConfig; context: ChatPageContext; trigger: V5ChatPanelTrigger; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [newTab] = useState(() => !window.matchMedia("(pointer: coarse)").matches);
  const [qr, setQr] = useState<{ viewBox: string; path: string } | null>(null);

  const panel = useMemo(() => {
    const consentGiven = getConsentData()?.analytics === true;
    let utmCampaign: string | null = null;
    try { utmCampaign = new URLSearchParams(window.location.search).get("utm_campaign"); } catch { /* no campaign */ }
    return resolveChatPanel({
      ...context,
      config,
      utmCampaign,
      storedUtmCampaign: consentGiven ? getAttribution()?.utm_campaign : undefined,
      now: new Date(),
      consentGiven,
    });
  }, [config, context]);

  const topics = panel.mode === "panel" ? panel.topics : [];
  const campaignCode = panel.mode === "panel" ? panel.campaignCode : undefined;
  const qrHref = topics.at(-1)?.href;

  useEffect(() => {
    // panel_trigger (owner-approved 2026-10-25): which control opened it, the dock or an article-body LINE CTA.
    try { trackEvent("line_chat_panel_open", { page_group: panel.pageGroup, panel_trigger: trigger, ...(campaignCode ? { campaign_code: campaignCode } : {}) }); } catch { /* never blocks the panel */ }
    // One event per opening of this panel instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!qrHref || !window.matchMedia("(min-width: 1024px)").matches) return;
    let cancelled = false;
    import("./qr-code").then(({ encodeQr, qrSvgPath }) => { if (!cancelled) setQr(qrSvgPath(encodeQr(qrHref))); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [qrHref]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
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
  }, [onClose]);

  if (panel.mode !== "panel") return null;
  const surface = chatSurfaceGroup(panel.pageGroup);

  return (
    <>
      <div className={styles.backdrop} aria-hidden="true" onClick={onClose} />
      <div ref={dialogRef} id="v5-chat-panel" className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="v5-chat-title" aria-describedby="v5-chat-note">
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
                onClick={() => {
                  try {
                    trackEvent("line_oa_click", {
                      contact_channel: "line", cta_location: "chat_panel", chat_topic_id: topic.id, page_group: panel.pageGroup,
                      ...(surface ? { surface_group: surface } : {}), ...(campaignCode ? { campaign_code: campaignCode } : {}),
                    });
                  } catch { /* Analytics never stands between the visitor and the LINE chat. */ }
                  window.setTimeout(onClose, 0);
                }}>
                <span>{topic.label}</span><Arrow />
              </a>
            </li>
          ))}
        </ul>
        <p id="v5-chat-note" className={styles.note}>{panel.note}</p>
        {qr ? (
          <figure className={styles.qr}>
            <svg viewBox={qr.viewBox} role="img" aria-label={LINE_CHAT_QR_LABEL}><path d={qr.path} fill="currentColor" shapeRendering="crispEdges" /></svg>
            <figcaption><p>{LINE_CHAT_QR_LABEL}</p></figcaption>
          </figure>
        ) : null}
      </div>
    </>
  );
}
