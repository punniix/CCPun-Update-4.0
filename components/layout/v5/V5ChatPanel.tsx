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
 */
export default function V5ChatPanel({ config, context, trigger, onClose }: { config: LineChatConfig; context: ChatPageContext; trigger: V5ChatPanelTrigger; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
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
    trackEvent("line_chat_panel_open", { page_group: panel.pageGroup, panel_trigger: trigger, ...(campaignCode ? { campaign_code: campaignCode } : {}) });
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
    dialog.querySelector<HTMLElement>("[data-chat-topic]")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      else if (!dialog.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
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
              <a data-chat-topic="" className={`${styles.topic} ${topic.journey === "type_own" ? styles.topicOwn : ""}`.trim()} href={topic.href} target="_blank" rel="noopener noreferrer"
                onClick={() => {
                  trackEvent("line_oa_click", {
                    contact_channel: "line", cta_location: "chat_panel", chat_topic_id: topic.id, page_group: panel.pageGroup,
                    ...(surface ? { surface_group: surface } : {}), ...(campaignCode ? { campaign_code: campaignCode } : {}),
                  });
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
