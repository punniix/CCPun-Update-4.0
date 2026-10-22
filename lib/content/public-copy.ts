import "server-only";
import { cache } from "react";
import { draftMode } from "next/headers";
import { sanityFetch } from "./sanity-fetch";
import { IS_DRAFT_PREVIEW_ALLOWED } from "../deployment-environment";
import { parsePublicCopy, publicCopyDocumentId, type PublicCopyScope } from "./public-copy-registry";

// One fresh read per scope/request; no cross-request cache of drafts or published copy.
export const getPublicCopy = cache(async (scope: PublicCopyScope) => {
  const preview = IS_DRAFT_PREVIEW_ALLOWED && (await draftMode()).isEnabled;
  try {
    const { data } = await sanityFetch({
      query: '*[_id == $id && _type == "publicPageCopy"][0]{_id, _type, scope, locale, entries[]{_key, key, text}}',
      params: { id: publicCopyDocumentId(scope) },
      perspective: preview ? "drafts" : "published",
    });
    return parsePublicCopy(scope, data);
  } catch {
    // Preserve readable approved defaults during an unavailable/invalid CMS response.
    return parsePublicCopy(scope, null);
  }
});
