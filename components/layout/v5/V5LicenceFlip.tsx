"use client";

import { useState } from "react";
import styles from "./V5LicenceFlip.module.css";
import type { V5FlipLine } from "./licence-flip-copy";

/**
 * v5 motion round (owner-approved idea #4, UAT prototype): credential cards that flip on tap, click,
 * Enter or Space. Facts come only from what the site already shows or the owner approved. A card with
 * nothing new on its back (a licence without approved verification wording outside UAT) renders
 * as a plain card: no flip and no hint, so it never promises something the back does not hold.
 *
 * Accessibility: one native button with aria-pressed. The back text stays in the accessibility tree
 * (only turned away visually), so it is reachable with or without JavaScript; a back line that repeats
 * the front (the licence number) is hidden from assistive tech because the front already reads it.
 */
function TurnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" />
    </svg>
  );
}

export function isV5CardFlippable(back: readonly V5FlipLine[], note: string | null | undefined): boolean {
  return Boolean(note) || back.some((line) => !line.repeatsFront && line.value.trim() !== "");
}

export default function V5LicenceFlip({ term, detail, hint, back, note = null }: { term: string; detail: string; hint: string; back: readonly V5FlipLine[]; note?: string | null }) {
  const [flipped, setFlipped] = useState(false);

  if (!isV5CardFlippable(back, note)) {
    return (
      <span className={styles.face}>
        <span className={styles.term}>{term}</span>
        {detail ? <span className={styles.number}>{detail}</span> : null}
      </span>
    );
  }

  return (
    <>
      <button type="button" className={styles.card} aria-pressed={flipped} onClick={() => setFlipped((value) => !value)}>
        <span className={styles.inner}>
          <span className={`${styles.face} ${styles.front}`}>
            <span className={styles.term}>{term}</span>
            {detail ? <span className={styles.number}>{detail}</span> : null}
            <span className={styles.hint}><TurnIcon />{hint}</span>
          </span>
          <span className={`${styles.face} ${styles.back}`}>
            {back.map((line) => (
              <span className={styles.line} key={line.label} aria-hidden={line.repeatsFront ? true : undefined}>
                <span className={styles.label}>{line.label}</span>
                <span className={styles.backValue}>{line.value}</span>
              </span>
            ))}
            {note ? <span className={styles.verify}>{note}</span> : null}
          </span>
        </span>
      </button>
      {/* No JavaScript: the back face shows on hover or keyboard focus, so its text stays readable. */}
      <noscript><style>{`.${styles.card}:is(:hover,:focus-visible) .${styles.inner}{transform:rotateY(180deg)}`}</style></noscript>
    </>
  );
}
