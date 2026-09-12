import "server-only";

import type { ComponentType } from "react";
import { defineLive } from "next-sanity/live";
import { sanityReadToken, sanityServerClient } from "@/lib/content/sanity-fetch";

type LiveProps = { includeDrafts?: boolean };

const NoopLive: ComponentType<LiveProps> = () => null;

const live = sanityServerClient
  ? defineLive({
      client: sanityServerClient,
      serverToken: sanityReadToken || false,
      browserToken: false,
    })
  : null;

/** Preview-only client bridge; never import this from the public content path. */
export const SanityLive = live?.SanityLive ?? NoopLive;
