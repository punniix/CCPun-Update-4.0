import "server-only";

import { createClient } from "next-sanity";
import { isSanityLaneAllowed } from "@/lib/admin/environment";
import { getAdminSanityReadToken } from "@/lib/admin/sanity-credentials";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
export const sanityReadToken = getAdminSanityReadToken();

type SanityFetchArgs = {
  query: string;
  params?: Record<string, unknown>;
  perspective?: "raw" | "drafts" | "published";
  stega?: boolean;
};

export const sanityServerClient = projectId && dataset && isSanityLaneAllowed(dataset)
  ? createClient({
      projectId,
      dataset,
      apiVersion: "2026-08-18",
      useCdn: false,
      token: sanityReadToken || undefined,
      stega: { enabled: false, studioUrl: "/studio" },
    })
  : null;

/**
 * Production content must reflect a Sanity publish on the very next request.
 * We intentionally bypass both the Sanity CDN and Next's fetch cache here.
 * This is the fail-safe source of truth for article pages, cards, metadata,
 * Open Graph data, and structured data. Draft preview keeps the requested
 * perspective and Stega behavior while using the same fresh server fetch.
 *
 * Keep this server fetch path free from Sanity Live / Visual Editing imports.
 * Public content uses this module on every request, while preview-only client
 * tooling belongs behind the admin preview boundary.
 */
export async function sanityFetch({
  query,
  params = {},
  perspective = "published",
  stega = false,
}: SanityFetchArgs) {
  if (!sanityServerClient) throw new Error("Sanity content fetch is not configured");

  const data = await sanityServerClient
    .withConfig({
      perspective,
      useCdn: false,
      token: sanityReadToken || undefined,
      stega: { enabled: stega, studioUrl: "/studio" },
    })
    .fetch(query, params, { cache: "no-store" });

  return { data };
}
