import { localContentProvider } from "./local";
import { hasSanityConfig, sanityContentProvider } from "./sanity";
import type { ContentProvider } from "./types";
import { resolveContentEnvironment } from "./sanity-lane";
import { isDeployedEnvironment } from "../runtime/deployment-contract";

/**
 * Content-provider boundary for Website 4.0.
 *
 * Local UAT intentionally uses an in-repo provider so UX/UI, Draft Mode,
 * sitemap rules and article rendering can be verified before any CMS account
 * is coupled to the release. The Sanity adapter will implement this same
 * interface after project/dataset configuration is approved.
 */
export function getContentProvider(): ContentProvider {
  const environment = resolveContentEnvironment();
  if (isDeployedEnvironment(environment) && !hasSanityConfig) {
    throw new Error("DEPLOYED_CONTENT_PROVIDER_NOT_CONFIGURED");
  }
  return hasSanityConfig ? sanityContentProvider : localContentProvider;
}
