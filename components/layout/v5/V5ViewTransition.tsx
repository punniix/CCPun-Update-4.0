import { cache, ViewTransition, type ReactNode } from "react";

/**
 * v5 motion round (owner-approved idea #2, UAT prototype): a tapped article card's image and title
 * continue into the article cover and heading. React's <ViewTransition> (shipped with the Next 16
 * App Router) pairs elements with the same name across a client navigation and drives the browser
 * View Transitions API; browsers without it, hard loads and no-JS navigate exactly as before.
 *
 * - Only the shared pair animates (`default="none"`); nothing animates on first load, so LCP/CLS are untouched.
 * - A name may appear once per page or the browser skips the transition, so the first claim wins.
 * - Snapshots move with transform/opacity only. Reduced motion removes every animation (instant swap).
 */
export const V5_VIEW_TRANSITION_CSS = [
  "::view-transition{pointer-events:none}",
  "::view-transition-group(.ccpun-vt-cover),::view-transition-group(.ccpun-vt-title){animation-duration:380ms;animation-timing-function:cubic-bezier(0.2,0,0,1)}",
  // Text keeps its own size and crossfades while its box travels, instead of being stretched.
  "::view-transition-old(.ccpun-vt-title),::view-transition-new(.ccpun-vt-title){width:auto;height:auto}",
  "::view-transition-old(root),::view-transition-new(root){animation-duration:250ms}",
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
  return (
    <>
      <style href="ccpun-v5-view-transitions" precedence="default">{V5_VIEW_TRANSITION_CSS}</style>
      <ViewTransition name={name} share={part === "title" ? "ccpun-vt-title" : "ccpun-vt-cover"} default="none">{children}</ViewTransition>
    </>
  );
}
