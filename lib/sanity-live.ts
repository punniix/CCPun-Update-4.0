import "server-only";

import type { ComponentType } from "react";
import { createClient } from "next-sanity";
import { defineLive } from "next-sanity/live";
import { isSanityLaneAllowed } from "@/lib/admin/environment";
import { getAdminSanityReadToken } from "@/lib/admin/sanity-credentials";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = getAdminSanityReadToken();

type LiveProps = { includeDrafts?: boolean };
type SanityFetchArgs = {
  query: string;
  params?: Record<string, unknown>;
  perspective?: "raw" | "drafts" | "published";
  stega?: boolean;
};

const NoopLive: ComponentType<LiveProps> = () => null;

const baseClient = projectId && dataset && isSanityLaneAllowed(dataset)
  ? createClient({
      projectId,
      dataset,
      apiVersion: "2026-08-18",
      useCdn: false,
      token: token || undefined,
      stega: { enabled: false, studioUrl: "/studio" },
    })
  : null;

const live = baseClient
  ? defineLive({
      client: baseClient,
      serverToken: token || false,
      browserToken: false,
    })
  : null;

export const SanityLive = live?.SanityLive ?? NoopLive;

/**
 * Production content must reflect a Sanity publish on the very next request.
 * We intentionally bypass both the Sanity CDN and Next's fetch cache here.
 * This is the fail-safe source of truth for article pages, cards, metadata,
 * Open Graph data, and structured data. Draft preview keeps the requested
 * perspective and Stega behavior while using the same fresh server fetch.
 */
export async function sanityFetch({
  query,
  params = {},
  perspective = "published",
  stega = false,
}: SanityFetchArgs) {
  if (!baseClient) throw new Error("Sanity Live is not configured");

  const data = await baseClient
    .withConfig({
      perspective,
      useCdn: false,
      token: token || undefined,
      stega: { enabled: stega, studioUrl: "/studio" },
    })
    .fetch(query, params, { cache: "no-store" });

  return { data };
}
