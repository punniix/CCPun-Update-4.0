'use client';

import Link from "next/link";
import type { ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Article → CI Planning next-step link (plan T08). Emits the existing, allowlisted
 * `ci_calculator_cta_click` event through trackEvent() only (consent-gated, GA4-only
 * mapping, no new event name, no provider call). FHC/Money Story arrivals are measured
 * by those tools' existing landing events, so their links carry no click event.
 */
export default function NextStepCiLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} onClick={() => trackEvent("ci_calculator_cta_click", { tool_name: "ci_planning", cta_location: "blog_article", surface_group: "blog" })}>
      {children}
    </Link>
  );
}
