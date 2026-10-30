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

/** A back value with its `keep` phrase held on one line (falls back to the plain text when the phrase is absent). */
function renderValue({ value, keep }: V5FlipLine) {
  const at = keep ? value.indexOf(keep) : -1;
  if (!keep || at < 0) return value;
  return <>{value.slice(0, at)}<span className={styles.keep}>{keep}</span>{value.slice(at + keep.length)}</>;
}

export function isV5CardFlippable(back: readonly V5FlipLine[], note: string | null | undefined): boolean {
  return Boolean(note) || back.some((line) => !line.repeatsFront && line.value.trim() !== "");
}

// About-only word protection; default Home cards retain their original markup.
function keepTerm(value: string) {
  return value.split(/(เครื่องมือ|การลงทุน|การเงิน|รับผิดชอบ|เตรียมตัว|วางแผน)/g)
    .map((part, index) => index % 2 ? <span className={styles.keep} key={index}>{part}</span> : part);
}

export type V5CardVerification = { href: string; label: string; backLabel: string };

export default function V5LicenceFlip({ term, detail, hint, back, note = null, verification }: { term: string; detail: string; hint: string; back: readonly V5FlipLine[]; note?: string | null; verification?: V5CardVerification }) {
  const [flipped, setFlipped] = useState(false);

  if (!isV5CardFlippable(back, note) && !verification) {
    return (
      <span className={styles.face}>
        <span className={styles.term}>{term}</span>
        {detail ? <span className={styles.number}>{detail}</span> : null}
      </span>
    );
  }

  const card = (
    <>
      <button type="button" className={styles.card} aria-pressed={flipped} onClick={() => setFlipped((value) => !value)}>
        <span className={styles.inner}>
          <span className={`${styles.face} ${styles.front}`}>
            <span className={styles.term}>{verification ? keepTerm(term) : term}</span>
            {detail ? <span className={styles.number}>{detail}</span> : null}
            <span className={styles.hint}><TurnIcon />{hint}</span>
          </span>
          <span className={`${styles.face} ${styles.back}`}>
            {verification ? <span className={styles.term}>{keepTerm(term)}</span> : null}
            {back.map((line) => (
              <span className={styles.line} key={line.label} aria-hidden={line.repeatsFront ? true : undefined}>
                <span className={styles.label}>{line.label}</span>
                <span className={styles.backValue}>{renderValue(line)}</span>
              </span>
            ))}
            {note ? <span className={styles.verify}>{note}</span> : null}
            {verification ? <span className={styles.verifyReturn}>{verification.backLabel}</span> : null}
          </span>
        </span>
      </button>
      {/* No JavaScript: the back face shows on hover or keyboard focus, so its text stays readable. */}
      <noscript><style>{`.${styles.card}:is(:hover,:focus-visible) .${styles.inner}{transform:rotateY(180deg)}.${styles.card}:is(:hover,:focus-visible) .${styles.back}{opacity:1;transition-delay:0s}.${styles.card}:is(:hover,:focus-visible) .${styles.front}{opacity:0;transition-delay:var(--v5-motion-slow)}`}</style></noscript>
    </>
  );
  // Keep the native flip button and link as siblings: links are never nested in a button.
  return verification ? <div className={styles.verifiedCard}>
    {card}
    <a className={styles.verifyLink} href={verification.href} target="_blank" rel="noopener noreferrer" hidden={!flipped}>{verification.label}</a>
    <noscript><a href={verification.href} target="_blank" rel="noopener noreferrer">{verification.label}</a></noscript>
  </div> : card;
}
