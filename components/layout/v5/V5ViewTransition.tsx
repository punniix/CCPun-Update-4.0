import { cache, ViewTransition, type ReactNode } from "react";
import { cssCubicBezier, V5_EASE_STANDARD, V5_MOTION_MS } from "./motion-tokens";

/**
 * v5 motion round (owner-approved idea #2, UAT prototype): a tapped article card's image and title
 * continue into the article cover and heading. React's <ViewTransition> (shipped with the Next 16
 * App Router) pairs elements with the same name across a client navigation and drives the browser
 * View Transitions API; browsers without it, hard loads and no-JS navigate exactly as before.
 *
 * - Only the shared pair animates (`default="none"`); nothing animates on first load, so LCP/CLS are untouched.
 * - A name may appear once per page or the browser skips the transition, so the first claim wins.
 * - Snapshots move with transform/opacity only. Reduced motion removes every animation (instant swap).
 * - Timing comes from the shared motion tokens (motion-tokens.ts): the morph uses the "slow" move, the page
 *   crossfade the "base" duration. V5HeaderEnhancer makes the next page start at its top instead of
 *   smooth-scrolling there under the morph.
 */
export const V5_VIEW_TRANSITION_CSS = [
  "::view-transition{pointer-events:none}",
  `::view-transition-group(.ccpun-vt-cover),::view-transition-group(.ccpun-vt-title){animation-duration:${V5_MOTION_MS.slow}ms;animation-timing-function:${cssCubicBezier(V5_EASE_STANDARD).replaceAll(" ", "")}}`,
  // Text keeps its own size and crossfades while its box travels, instead of being stretched.
  "::view-transition-old(.ccpun-vt-title),::view-transition-new(.ccpun-vt-title){width:auto;height:auto}",
  `::view-transition-old(root),::view-transition-new(root){animation-duration:${V5_MOTION_MS.base}ms}`,
  "@media (prefers-reduced-motion:reduce){::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){animation:none!important}}",
].join("");

export type V5SharedPart = "cover" | "title";

export function v5ArticleTransitionName(part: V5SharedPart, articleId: string): string {
  return `ccpun-article-${part}-${articleId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

// Per-request registry on the server (React cache); a plain render without RSC simply never dedupes.
const claimedNames = cache(() => new Set<string>());

export function claimV5TransitionName(name: string, claimed: Set<string> = claimedNames()): boolean {
  if (claimed.has(name)) return false;
  claimed.add(name);
  return true;
}

export function V5SharedTransition({ part, articleId, children }: { part: V5SharedPart; articleId: string; children: ReactNode }) {
  // A React build without <ViewTransition> (plain test renderers) gets the unchanged markup.
  if (ViewTransition == null) return <>{children}</>;
  const name = v5ArticleTransitionName(part, articleId);
  if (!claimV5TransitionName(name)) return <>{children}</>;
  // The stylesheet travels once per request: React hoists it, and later claims skip it in the payload.
  const firstClaim = claimV5TransitionName("ccpun-v5-view-transitions-style");
  return (
    <>
      {firstClaim ? <style href="ccpun-v5-view-transitions" precedence="default">{V5_VIEW_TRANSITION_CSS}</style> : null}
      <ViewTransition name={name} share={part === "title" ? "ccpun-vt-title" : "ccpun-vt-cover"} default="none">{children}</ViewTransition>
    </>
  );
}
