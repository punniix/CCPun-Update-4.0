"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import shell from "@/components/layout/v5/V5.module.css";
import styles from "./ComingSoon.module.css";

/**
 * "อยากให้เสร็จเร็ว": one semantic, consent-gated event per page view carrying only the planned
 * path (no personal data, no counter yet). The thank-you state is local to this view; focus moves
 * to it so keyboard and screen-reader users are not left on a removed button.
 */
export default function ComingSoonInterest({ path }: { path: string }) {
  const [sent, setSent] = useState(false);
  const thanksRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (sent) thanksRef.current?.focus(); }, [sent]);
  if (sent) {
    return (
      <p ref={thanksRef} tabIndex={-1} className={styles.thanks} role="status">
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 10.5 8.5 14 15 6.5" /></svg>
        <span>ขอบคุณครับ อยากให้แจ้งตอนเปิดใช้ ทักผมทาง LINE ที่ปุ่มด้านล่างได้</span>
      </p>
    );
  }
  return (
    <div className={shell.buttonRow}>
      <button
        type="button"
        className={shell.buttonOutline}
        onClick={() => {
          trackEvent("coming_soon_interest", { coming_soon_path: path });
          setSent(true);
        }}
      >
        อยากให้เสร็จเร็ว
      </button>
    </div>
  );
}
