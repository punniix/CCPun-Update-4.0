"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { cubicBezierAt, V5_EASE_EMPHASIZED, V5_MOTION_MS } from "@/components/layout/v5/motion-tokens";

/**
 * Counts a rendered amount from 0 up to its value once per value change (v5 motion round, UAT prototype).
 *
 * - React always renders the final text, so server output, no-JS and assistive tech never see a partial
 *   number. While counting, only the existing text node's value is rewritten (no React state, no
 *   re-render); the last frame writes the final text back.
 * - Reduced motion, a missing requestAnimationFrame or a non-positive value keep the final text.
 * - The frame callback stops itself when the duration ends (no loop, no interval).
 * - Motion smoothing (2026-10-26): the count runs on the same delay, duration and curve as the gold gap
 *   bar (motion tokens), so number and bar land together (they used to land 530ms apart). With a `scope`
 *   element, the reveal waits until that element is on screen: the scope carries `data-reveal="wait"`,
 *   which holds the CSS bar animations at their first frame, and both start together once at least half
 *   of it is visible. Results that appear below the fold used to finish animating before anyone saw them.
 */
export const COUNT_UP_DELAY_MS = V5_MOTION_MS.slow;
export const COUNT_UP_DURATION_MS = V5_MOTION_MS.reveal;
/** Share of the scope that must be visible before the reveal plays. */
export const REVEAL_VISIBLE_RATIO = 0.5;

export function prefersReducedMotion(win: Pick<Window, "matchMedia"> | undefined = typeof window === "undefined" ? undefined : window): boolean {
  if (!win || typeof win.matchMedia !== "function") return true;
  return win.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The emphasized motion curve (same as the result bars), clamped to [0, 1]. */
export function countUpProgress(elapsed: number, delay = COUNT_UP_DELAY_MS, duration = COUNT_UP_DURATION_MS): number {
  const t = Math.min(Math.max((elapsed - delay) / duration, 0), 1);
  return cubicBezierAt(V5_EASE_EMPHASIZED, t);
}

export function countUpValue(target: number, elapsed: number, delay = COUNT_UP_DELAY_MS, duration = COUNT_UP_DURATION_MS): number {
  if (!Number.isFinite(target) || target <= 0) return target;
  return Math.min(target, Math.round(target * countUpProgress(elapsed, delay, duration)));
}

export function useCountUp<T extends HTMLElement>(target: number, format: (value: number) => string, scope?: RefObject<HTMLElement | null>): RefObject<T | null> {
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
    const holder = scope?.current ?? null;
    let frame = 0;
    let start: number | null = null;
    let written: string | null = null;
    let observer: IntersectionObserver | null = null;
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
    const play = () => {
      holder?.removeAttribute("data-reveal");
      frame = window.requestAnimationFrame(step);
    };
    write(formatRef.current(0));
    if (holder && typeof IntersectionObserver === "function") {
      holder.setAttribute("data-reveal", "wait");
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= REVEAL_VISIBLE_RATIO)) return;
        observer?.disconnect();
        observer = null;
        play();
      }, { threshold: [REVEAL_VISIBLE_RATIO] });
      observer.observe(holder);
    } else {
      play();
    }
    // Cleanup stops the frame and the wait. If the text still shows our partial count, the final text goes back;
    // if React already wrote a newer value (the amount changed), that value is left alone.
    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
      holder?.removeAttribute("data-reveal");
      if (written !== null && node.nodeValue === written) node.nodeValue = finalText;
    };
  }, [target, scope]);

  return ref;
}
