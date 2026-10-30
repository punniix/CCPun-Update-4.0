"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./V5.module.css";

/** Native disclosure on the approved phone pages; desktop retains the expanded footer. */
export default function V5FooterDisclosure({ title, children }: { title: ReactNode; children: ReactNode }) {
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => { setMobile(query.matches); setOpen(!query.matches); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return <details className={`${styles.footerColumn} ${styles.footerDisclosure}`} open={open}
    onToggle={(event) => {
      if (mobile) setOpen(event.currentTarget.open);
      else if (!event.currentTarget.open) event.currentTarget.open = true;
    }}>
    <summary tabIndex={mobile ? 0 : -1}>{title}<span aria-hidden="true">⌄</span></summary>
    {children}
  </details>;
}
