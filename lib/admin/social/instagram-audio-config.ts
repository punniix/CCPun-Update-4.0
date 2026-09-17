import "server-only";

import { createClient, groq } from "next-sanity";
import { z } from "zod";
import { isAdminDataPlaneAllowed } from "../environment";
import { getAdminSanityWriteToken } from "../sanity-credentials";
import { socialDraftId } from "./draft-contract";
import { discoverInstagramPublishingUser, readInstagramAudio } from "./providers/meta/publishing";
import { resolveSocialRuntime, SOCIAL_UAT_RUNTIME_BRANCHES } from "./runtime";

const graphIdSchema = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_.:-]+$/);
const baseVolume = {
  audioVolume: z.number().int().min(0).max(100).default(100),
  videoVolume: z.number().int().min(0).max(100).default(100),
};

export const instagramAudioConfigurationSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("original"), ...baseVolume }),
  z.strictObject({
    mode: z.literal("instagram-audio"),
    audioId: graphIdSchema,
    audioType: z.enum(["music", "original_sound"]),
    title: z.string().trim().min(1).max(500),
    artist: z.string().trim().min(1).max(500).nullable(),
    creator: z.string().trim().min(1).max(120).nullable(),
    ...baseVolume,
  }),
  z.strictObject({ mode: z.literal("add-in-app"), ...baseVolume }),
]);
export type InstagramAudioConfiguration = z.infer<typeof instagramAudioConfigurationSchema>;

export const instagramAudioConfigurationMutationSchema = z.strictObject({
  variantId: graphIdSchema,
  expectedRevision: z.string().trim().min(1).max(120),
  configuration: instagramAudioConfigurationSchema,
});

const storedDraftSchema = z.object({
  _id: z.string().startsWith("drafts."),
  _rev: z.string().min(1),
  version: z.number().int().min(1),
  channel: z.literal("instagram"),
  format: z.literal("reel"),
  review: z.object({ notes: z.string().optional() }).passthrough(),
  instagramAudio: instagramAudioConfigurationSchema.optional().nullable(),
});

function client(env: Record<string, string | undefined> = process.env) {
  const runtime = resolveSocialRuntime(env, { uatBranches: SOCIAL_UAT_RUNTIME_BRANCHES });
  if (!runtime || !isAdminDataPlaneAllowed(runtime.sanityDataset)) throw new Error("SOCIAL_AUDIO_DRAFT_UNAVAILABLE");
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

async function readDraft(variantId: string, env: Record<string, string | undefined>) {
  const sanity = client(env);
  const id = socialDraftId(variantId);
  const raw = await sanity.fetch(groq`*[_id == $id && _type == "socialVariant"][0]{
    _id,_rev,version,channel,format,review,
    "instagramAudio": coalesce(instagramAudio, null)
  }`, { id });
  if (!raw) throw new Error("SOCIAL_DRAFT_NOT_FOUND");
  const parsed = storedDraftSchema.safeParse(raw);
  if (!parsed.success) throw new Error("SOCIAL_AUDIO_REEL_DRAFT_REQUIRED");
  return { sanity, draft: parsed.data };
}

function defaultConfiguration(): InstagramAudioConfiguration {
  return { mode: "original", audioVolume: 100, videoVolume: 100 };
}

export async function readSocialInstagramAudioConfiguration(
  variantId: string,
  env: Record<string, string | undefined> = process.env,
) {
  const { draft } = await readDraft(variantId, env);
  return {
    variantId: draft._id.replace(/^drafts\./, ""),
    revision: draft._rev,
    version: draft.version,
    configuration: draft.instagramAudio ?? defaultConfiguration(),
  };
}

export async function revalidateInstagramAudioConfiguration(
  configuration: InstagramAudioConfiguration,
  env: Record<string, string | undefined> = process.env,
) {
  const parsed = instagramAudioConfigurationSchema.parse(configuration);
  if (parsed.mode !== "instagram-audio") return parsed;
  const { instagramUserId } = await discoverInstagramPublishingUser(env);
  const audio = await readInstagramAudio({ instagramUserId, audioId: parsed.audioId }, env);
  if (audio.audio_id !== parsed.audioId || audio.audio_type !== parsed.audioType) throw new Error("SOCIAL_INSTAGRAM_AUDIO_UNAVAILABLE");
  return instagramAudioConfigurationSchema.parse({
    mode: "instagram-audio",
    audioId: audio.audio_id,
    audioType: audio.audio_type,
    title: audio.title,
    artist: audio.display_artist?.trim() || null,
    creator: audio.ig_username?.trim() || null,
    audioVolume: parsed.audioVolume,
    videoVolume: parsed.videoVolume,
  });
}

export async function saveSocialInstagramAudioConfiguration(input: {
  mutation: z.input<typeof instagramAudioConfigurationMutationSchema>;
  env?: Record<string, string | undefined>;
}) {
  const mutation = instagramAudioConfigurationMutationSchema.parse(input.mutation);
  const env = input.env ?? process.env;
  const { sanity, draft } = await readDraft(mutation.variantId, env);
  if (draft._rev !== mutation.expectedRevision) throw new Error("SOCIAL_DRAFT_REVISION_CONFLICT");
  const configuration = await revalidateInstagramAudioConfiguration(mutation.configuration, env);
  const review = { status: "drafting", ...(draft.review.notes ? { notes: draft.review.notes } : {}) };
  try {
    const updated = await sanity.patch(draft._id)
      .ifRevisionId(mutation.expectedRevision)
      .set({ instagramAudio: configuration, version: draft.version + 1, review })
      .commit({ returnDocuments: true });
    if (!updated._rev) throw new Error("SOCIAL_DRAFT_MUTATION_AMBIGUOUS");
    return {
      variantId: draft._id.replace(/^drafts\./, ""),
      revision: updated._rev,
      version: draft.version + 1,
      reviewStatus: "drafting" as const,
      configuration,
    };
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : null;
    if (statusCode === 409) throw new Error("SOCIAL_DRAFT_REVISION_CONFLICT");
    throw error;
  }
}
