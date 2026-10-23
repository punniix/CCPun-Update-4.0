import "server-only";
import { cache } from "react";
import { sanityFetch } from "./sanity-fetch";
import { PUBLIC_COPY_SCOPES, parsePublicCopy, publicCopyDocumentId, type PublicCopyScope, type PublicCopyValues } from "./public-copy-registry";

// One fresh read per scope/request; no cross-request cache of drafts or published copy.
export const getPublicCopy = cache(async (scope: PublicCopyScope) => {
  try {
    const { data } = await sanityFetch({
      query: '*[_id == $id && _type == "publicPageCopy"][0]{_id, _type, scope, locale, entries[]{_key, key, text, size, sizeMobile, sizeDesktop}}',
      params: { id: publicCopyDocumentId(scope) },
      perspective: "published",
    });
    const values = parsePublicCopy(scope, data) as Record<string, string>;
    // Defaults already ship with each renderer; send only validated CMS edits
    // (changed wording or a chosen size) to clients.
    const defaults = PUBLIC_COPY_SCOPES[scope].defaults as Record<string, string>;
    return data ? Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== defaults[key])) as PublicCopyValues : {};
  } catch {
    // Preserve readable approved defaults during an unavailable/invalid CMS response.
    return {};
  }
});
