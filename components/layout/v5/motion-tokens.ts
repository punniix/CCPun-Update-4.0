/**
 * v5 motion tokens (motion smoothing pass, UAT 2026-10-26). One small set of durations and curves for every
 * v5 effect, so hover states, the dock, the chat panel, the flip cards, the page transition and the result
 * reveal feel like one system. The CSS custom properties on `.root` (V5.module.css) carry the same values;
 * this module feeds the places CSS variables cannot reach: the view-transition pseudo-elements (they live
 * on <html>, outside `.root`) and the count-up frame loop. tests/website-v5-motion.test.mjs keeps both in sync.
 */
export const V5_MOTION_MS = Object.freeze({
  /** Press feedback, dropdown fade, input focus feedback. */
  micro: 120,
  /** Hover and selected colour/border changes. */
  fast: 160,
  /** Dock tuck/return, chat panel entrance, page crossfade. */
  base: 240,
  /** Flip cards, card-to-article morph; also the stagger before the result gap fills. */
  slow: 400,
  /** Result bars growing and the count-up. */
  reveal: 600,
});

/** Things that move (dock, panel, flip, morph): quick start, soft landing. */
export const V5_EASE_STANDARD = Object.freeze([0.2, 0, 0, 1] as const);
/** Things that fill up to their final value (result bars, count-up). */
export const V5_EASE_EMPHASIZED = Object.freeze([0.22, 1, 0.36, 1] as const);

export const cssCubicBezier = (curve: readonly [number, number, number, number]) => `cubic-bezier(${curve.join(", ")})`;

/**
 * The y value of a CSS cubic-bezier(x1, y1, x2, y2) at progress x (0..1), so a JavaScript frame loop can
 * follow exactly the curve the CSS animation next to it uses. Newton iterations with a bisection fallback.
 */
export function cubicBezierAt(curve: readonly [number, number, number, number], x: number): number {
  const [x1, y1, x2, y2] = curve;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const sample = (a1: number, a2: number, t: number) => ((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t * t + 3 * a1 * t;
  const slope = (a1: number, a2: number, t: number) => 3 * (1 - 3 * a2 + 3 * a1) * t * t + 2 * (3 * a2 - 6 * a1) * t + 3 * a1;
  let t = x;
  for (let i = 0; i < 8; i += 1) {
    const error = sample(x1, x2, t) - x;
    if (Math.abs(error) < 1e-6) return sample(y1, y2, t);
    const d = slope(x1, x2, t);
    if (Math.abs(d) < 1e-6) break;
    t -= error / d;
  }
  let lo = 0;
  let hi = 1;
  t = x;
  for (let i = 0; i < 40; i += 1) {
    const value = sample(x1, x2, t);
    if (Math.abs(value - x) < 1e-6) break;
    if (value < x) lo = t; else hi = t;
    t = (lo + hi) / 2;
  }
  return sample(y1, y2, t);
}
