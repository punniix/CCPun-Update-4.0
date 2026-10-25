"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Counts a rendered amount from 0 up to its value once per value change (v5 motion round, UAT prototype).
 *
 * - React always renders the final text, so server output, no-JS and assistive tech never see a partial
 *   number. While counting, only the existing text node's value is rewritten (no React state, no
 *   re-render); the last frame writes the final text back.
 * - Reduced motion, a missing requestAnimationFrame or a non-positive value keep the final text.
 * - The frame callback stops itself when the duration ends (no loop, no interval).
 */
export const COUNT_UP_DELAY_MS = 450;
export const COUNT_UP_DURATION_MS = 900;

export function prefersReducedMotion(win: Pick<Window, "matchMedia"> | undefined = typeof window === "undefined" ? undefined : window): boolean {
  if (!win || typeof win.matchMedia !== "function") return true;
  return win.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** easeOutCubic, clamped to [0, 1]. */
export function countUpProgress(elapsed: number, delay = COUNT_UP_DELAY_MS, duration = COUNT_UP_DURATION_MS): number {
  const t = Math.min(Math.max((elapsed - delay) / duration, 0), 1);
  return 1 - (1 - t) ** 3;
}

export function countUpValue(target: number, elapsed: number, delay = COUNT_UP_DELAY_MS, duration = COUNT_UP_DURATION_MS): number {
  if (!Number.isFinite(target) || target <= 0) return target;
  return Math.round(target * countUpProgress(elapsed, delay, duration));
}

export function useCountUp<T extends HTMLElement>(target: number, format: (value: number) => string): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const formatRef = useRef(format);

  useLayoutEffect(() => {
    formatRef.current = format;
  });

  // Layout effect: the count starts at 0 before the first paint of a new result (no flash of the total).
  useLayoutEffect(() => {
    const node = ref.current?.firstChild;
    if (!node || node.nodeType !== 3 || !Number.isFinite(target) || target <= 0) return;
    if (prefersReducedMotion() || typeof window.requestAnimationFrame !== "function") return;
    const finalText = formatRef.current(target);
    let frame = 0;
    let start: number | null = null;
    let written: string | null = null;
    const write = (text: string) => { node.nodeValue = text; written = text; };
    const step = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      if (elapsed >= COUNT_UP_DELAY_MS + COUNT_UP_DURATION_MS) {
        node.nodeValue = finalText;
        written = null;
        return;
      }
      write(formatRef.current(countUpValue(target, elapsed)));
      frame = window.requestAnimationFrame(step);
    };
    write(formatRef.current(0));
    frame = window.requestAnimationFrame(step);
    // Cleanup stops the frame. If the text still shows our partial count, the final text goes back;
    // if React already wrote a newer value (the amount changed), that value is left alone.
    return () => {
      window.cancelAnimationFrame(frame);
      if (written !== null && node.nodeValue === written) node.nodeValue = finalText;
    };
  }, [target]);

  return ref;
}
