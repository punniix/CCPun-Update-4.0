import "server-only";

import { randomUUID } from "node:crypto";
import { createClient, groq } from "next-sanity";
import { isAdminDataPlaneAllowed } from "../environment";
import { getAdminSanityWriteToken } from "../sanity-credentials";
import {
  buildSocialDraftCreateDocument,
  existingSocialDraftSchema,
  planSocialDraftUpdate,
  socialDraftId,
  socialDraftRequestSchema,
  socialDraftWorkspaceSchema,
  socialLogicalId,
  type SocialDraftRequest,
} from "./draft-contract";
import { resolveSocialRuntime, SOCIAL_UAT_RUNTIME_BRANCHES } from "./runtime";

export { socialDraftRequestSchema } from "./draft-contract";

function client() {
  const runtime = resolveSocialRuntime(process.env, { uatBranches: SOCIAL_UAT_RUNTIME_BRANCHES });
  if (!runtime || !isAdminDataPlaneAllowed(runtime.sanityDataset)) {
    throw new Error("SOCIAL_DRAFT_UAT_ONLY");
  }
  const token = getAdminSanityWriteToken();
  if (!token) throw new Error("SOCIAL_DRAFT_WRITE_NOT_CONFIGURED");
  return createClient({
    projectId: runtime.sanityProjectId,
    dataset: runtime.sanityDataset,
    apiVersion: "2026-08-20",
    token,
    useCdn: false,
    perspective: "raw",
  });
}

async function requireApprovedMasterContent(sanity: ReturnType<typeof client>, id: string) {
  const publishedId = socialLogicalId(socialDraftId(id));
  const draftMasterId = `drafts.${publishedId}`;
  const exists = await sanity.fetch<boolean>(groq`defined(coalesce(
    *[_id == $draftMasterId && _type == "masterContent" && review.status == "approved"][0]._id,
    *[_id == $publishedId && _type == "masterContent" && review.status == "approved"][0]._id
  ))`, { draftMasterId, publishedId });
  if (!exists) throw new Error("SOCIAL_DRAFT_MASTER_CONTENT_NOT_APPROVED");
  return publishedId;
}

export async function getSocialDraftWorkspace() {
  const sanity = client();
  const raw = await sanity.fetch(groq`{
    "drafts": *[_type == "socialVariant" && _id match "drafts.*" && channel in ["facebook", "instagram"]]
      | order(_updatedAt desc)[0...200]{
        "variantId": _id,
        "revision": _rev,
        version,
        "masterContentId": masterContent._ref,
        title,
        "caption": coalesce(caption, ""),
        "linkUrl": coalesce(linkUrl, null),
        channel,
        format,
        publishingMode,
        "commentSeriesMode": coalesce(commentSeriesMode, "top-level"),
        "commentSeries": coalesce(commentSeries[] | order(position asc){ position, text }, []),
        "reviewStatus": review.status,
        "mediaReferences": coalesce(mediaReferences[]{
          assetId,
          role,
          "order": coalesce(order, null),
          "mimeType": coalesce(mimeType, null),
          "sha256Checksum": coalesce(sha256Checksum, null),
          "widthPx": coalesce(widthPx, null),
          "heightPx": coalesce(heightPx, null),
          "durationMs": coalesce(durationMs, null),
          "altText": coalesce(altText, null),
          "thumbnailTimestampMs": coalesce(thumbnailTimestampMs, null)
        }, [])
      },
    "masterContentChoices": *[_type == "masterContent" && review.status == "approved"]
      | order(_updatedAt desc)[0...200]{
        "id": _id,
        title,
        "summary": coalesce(summary, "")
      }
  }`);
  const parsed = socialDraftWorkspaceSchema.parse(raw);
  const masterContentChoices = new Map<string, (typeof parsed.masterContentChoices)[number]>();
  for (const choice of parsed.masterContentChoices) {
    const id = socialLogicalId(choice.id);
    const stored = masterContentChoices.get(id);
    if (!stored || choice.id.startsWith("drafts.")) masterContentChoices.set(id, { ...choice, id });
  }
  return {
    drafts: parsed.drafts.map((draft) => ({ ...draft, variantId: socialLogicalId(draft.variantId) })),
    masterContentChoices: [...masterContentChoices.values()],
  };
}

export async function saveSocialDraft(request: SocialDraftRequest) {
  const parsed = socialDraftRequestSchema.parse(request);
  const sanity = client();
  const masterContentId = await requireApprovedMasterContent(sanity, parsed.masterContentId);

  if (parsed.action === "create") {
    const created = await sanity.create(buildSocialDraftCreateDocument(parsed, randomUUID(), masterContentId));
    if (!created._id.startsWith("drafts.") || !created._rev) throw new Error("SOCIAL_DRAFT_MUTATION_AMBIGUOUS");
    return { variantId: socialLogicalId(created._id), revision: created._rev, version: 1, reviewStatus: "drafting" as const };
  }

  const id = socialDraftId(parsed.variantId);
  const raw = await sanity.fetch(groq`*[_id == $id && _type == "socialVariant"][0]{ _id, _rev, version, review }`, { id });
  if (!raw) throw new Error("SOCIAL_DRAFT_NOT_FOUND");
  const plan = planSocialDraftUpdate(parsed, existingSocialDraftSchema.parse(raw), masterContentId);
  try {
    const updated = await sanity.patch(plan.draftId)
      .ifRevisionId(plan.expectedRevision)
      .set(plan.set)
      .commit({ returnDocuments: true });
    if (!updated._id.startsWith("drafts.") || !updated._rev) throw new Error("SOCIAL_DRAFT_MUTATION_AMBIGUOUS");
    return {
      variantId: socialLogicalId(updated._id),
      revision: updated._rev,
      version: plan.set.version,
      reviewStatus: plan.set.review.status,
    };
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : null;
    if (statusCode === 409) throw new Error("SOCIAL_DRAFT_REVISION_CONFLICT");
    throw error;
  }
}
