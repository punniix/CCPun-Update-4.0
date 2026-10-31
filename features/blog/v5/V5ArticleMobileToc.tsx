"use client";

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import styles from "./V5Blog.module.css";

export default function V5ArticleMobileToc({ label, closeLabel, children }: {
  label: ReactNode; countLabel: string; closeLabel: string; children: ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const overflow = useRef<string | null>(null);
  const destination = useRef<HTMLElement | null>(null);
  const dragStart = useRef<number | null>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const resized = () => { if (desktop.matches && dialog.current?.open) dialog.current.close(); };
    desktop.addEventListener("change", resized);
    return () => {
      desktop.removeEventListener("change", resized);
      if (overflow.current !== null) document.body.style.overflow = overflow.current;
    };
  }, []);

  const close = () => dialog.current?.close();
  const closed = () => {
    if (overflow.current !== null) { document.body.style.overflow = overflow.current; overflow.current = null; }
    const target = destination.current;
    destination.current = null;
    if (target?.isConnected) {
      const previous = target.getAttribute("tabindex");
      target.tabIndex = -1;
      target.addEventListener("blur", () => {
        if (previous === null) target.removeAttribute("tabindex"); else target.setAttribute("tabindex", previous);
      }, { once: true });
      target.focus({ preventScroll: true });
    } else trigger.current?.focus();
  };
  const clicked = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) { close(); return; }
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
    if (!link) return;
    try { destination.current = document.getElementById(decodeURIComponent(link.hash.slice(1))); }
    catch { destination.current = null; }
    close();
  };
  return <div className={styles.tocMobileSheet}>
    <button ref={trigger} type="button" className={styles.tocTrigger} aria-haspopup="dialog" aria-controls={id}
      onClick={() => {
        if (!dialog.current || dialog.current.open) return;
        dialog.current.showModal();
        overflow.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";
      }}>
      <span>{label}</span><span aria-hidden="true">⌄</span>
    </button>
    <dialog ref={dialog} id={id} className={styles.tocSheet} aria-labelledby={`${id}-title`} onClose={closed} onClick={clicked}>
      <div>
        <div className={styles.tocSheetHandle} aria-hidden="true"
          onPointerDown={(event) => { dragStart.current = event.clientY; event.currentTarget.setPointerCapture?.(event.pointerId); }}
          onPointerUp={(event) => {
            if (dragStart.current !== null && event.clientY - dragStart.current >= 64) close();
            dragStart.current = null;
          }} onPointerCancel={() => { dragStart.current = null; }}><span /></div>
        <div className={styles.tocSheetHeader}>
          <h2 id={`${id}-title`}>{label}</h2>
          <button type="button" onClick={close} aria-label={closeLabel}><span aria-hidden="true">×</span></button>
        </div>
        <nav className={`${styles.toc} ${styles.tocSheetList}`} aria-labelledby={`${id}-title`}>{children}</nav>
      </div>
    </dialog>
  </div>;
}
