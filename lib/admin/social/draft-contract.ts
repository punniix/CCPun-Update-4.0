import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

const boundedId = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_.:-]+$/);
const httpsLinkUrlSchema = z.string().trim().min(1).max(2_048).url()
  .refine((value) => new URL(value).protocol === "https:", "Link URL must use HTTPS");
const mediaReferenceSchema = z.strictObject({
  assetId: boundedId,
  role: z.enum(["primary", "carousel-item", "cover", "thumbnail", "caption"]),
  order: z.number().int().min(1).max(20).nullable(),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "text/vtt"]).nullable(),
  sha256Checksum: z.string().regex(/^[0-9a-f]{64}$/).nullable().default(null),
  widthPx: z.number().int().min(1).max(32_768).nullable(),
  heightPx: z.number().int().min(1).max(32_768).nullable(),
  durationMs: z.number().int().min(1).max(86_400_000).nullable(),
  altText: z.string().trim().max(2_000).nullable().default(null),
  thumbnailTimestampMs: z.number().int().min(0).max(86_400_000).nullable().default(null),
}).superRefine((reference, context) => {
  if ((reference.role === "carousel-item") !== (reference.order !== null)) {
    context.addIssue({ code: "custom", path: ["order"], message: "Only carousel items use an explicit order" });
  }
  if (reference.thumbnailTimestampMs !== null) {
    if (reference.mimeType !== "video/mp4") {
      context.addIssue({ code: "custom", path: ["thumbnailTimestampMs"], message: "Thumbnail timestamp is supported only for video" });
    } else if (reference.durationMs === null) {
      context.addIssue({ code: "custom", path: ["durationMs"], message: "Video duration is required before selecting a thumbnail timestamp" });
    } else if (reference.thumbnailTimestampMs >= reference.durationMs) {
      context.addIssue({ code: "custom", path: ["thumbnailTimestampMs"], message: "Thumbnail timestamp must be inside the video duration" });
    }
  }
});
const commentSeriesItemSchema = z.strictObject({
  position: z.number().int().min(1).max(20),
  text: z.string().min(1).max(2_000).refine((value) => value.trim().length > 0, "Comment text is required"),
});

const fields = {
  masterContentId: boundedId,
  title: z.string().trim().min(1).max(200),
  caption: z.string().max(50_000).default(""),
  linkUrl: httpsLinkUrlSchema.nullable().default(null),
  channel: z.enum(["facebook", "instagram"]),
  format: z.enum(["text-post", "link-post", "image-post", "album", "carousel", "reel", "video", "short", "photo-post", "live"]),
  publishingMode: z.enum(["direct", "native-scheduled", "native-finish"]),
  mediaReferences: z.array(mediaReferenceSchema).max(20).default([]),
  commentSeriesMode: z.enum(["top-level", "threaded"]).default("top-level"),
  commentSeries: z.array(commentSeriesItemSchema).max(20).default([]),
};

const createRequestSchema = z.strictObject({ action: z.literal("create"), ...fields });
const updateRequestSchema = z.strictObject({
  action: z.literal("update"),
  variantId: boundedId,
  expectedRevision: z.string().trim().min(1).max(120),
  ...fields,
});

export const socialDraftRequestSchema = z.discriminatedUnion("action", [createRequestSchema, updateRequestSchema])
  .superRefine((request, context) => {
    if (request.channel === "instagram" && request.publishingMode === "native-scheduled") {
      context.addIssue({ code: "custom", path: ["publishingMode"], message: "Instagram native scheduling requires the mobile handoff mode" });
    }
    if (request.channel === "facebook" && request.publishingMode === "native-finish") {
      context.addIssue({ code: "custom", path: ["publishingMode"], message: "Facebook does not use the Instagram mobile handoff mode" });
    }
    if (request.format === "link-post" && request.channel !== "facebook") {
      context.addIssue({ code: "custom", path: ["format"], message: "Link posts are supported only on Facebook" });
    }
    if (request.format === "link-post" && request.linkUrl === null) {
      context.addIssue({ code: "custom", path: ["linkUrl"], message: "Link posts require an explicit HTTPS link URL" });
    }
    if (request.format !== "link-post" && request.linkUrl !== null) {
      context.addIssue({ code: "custom", path: ["linkUrl"], message: "Only link posts may carry a link URL" });
    }
    if (request.channel !== "facebook" && request.commentSeries.length > 0) {
      context.addIssue({ code: "custom", path: ["commentSeries"], message: "Comment Series belongs to a Facebook main post only" });
    }
    request.commentSeries.forEach((comment, index) => {
      if (comment.position !== index + 1) {
        context.addIssue({ code: "custom", path: ["commentSeries", index, "position"], message: "Comment positions must be consecutive and ordered" });
      }
    });
  });
export type SocialDraftRequest = z.infer<typeof socialDraftRequestSchema>;
type SocialDraftFields = Omit<SocialDraftRequest, "action" | "variantId" | "expectedRevision">;

export const existingSocialDraftSchema = z.object({
  _id: z.string().startsWith("drafts."),
  _rev: z.string().min(1),
  version: z.number().int().min(1),
  review: z.object({
    status: z.string().min(1),
    contentReviewedAt: z.string().optional(),
    factCheckedAt: z.string().optional(),
    complianceReviewedAt: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const socialDraftWorkspaceSchema = z.strictObject({
  drafts: z.array(z.strictObject({
    variantId: boundedId,
    revision: z.string().min(1).max(120),
    version: z.number().int().min(1),
    masterContentId: boundedId,
    title: z.string().min(1).max(200),
    caption: z.string().max(50_000),
    linkUrl: httpsLinkUrlSchema.nullable(),
    channel: z.enum(["facebook", "instagram"]),
    format: fields.format,
    publishingMode: fields.publishingMode,
    reviewStatus: z.enum(["drafting", "content-review", "fact-check", "compliance-review", "ready-for-coo", "approved"]),
    mediaReferences: z.array(mediaReferenceSchema).max(20),
    commentSeriesMode: z.enum(["top-level", "threaded"]),
    commentSeries: z.array(commentSeriesItemSchema).max(20),
  })).max(200),
  masterContentChoices: z.array(z.strictObject({
    id: boundedId,
    title: z.string().min(1).max(200),
    summary: z.string().max(50_000),
  })).max(200),
});

export function socialLogicalId(id: string) {
  return id.replace(/^drafts\./, "");
}

export function socialDraftId(id: string) {
  return `drafts.${socialLogicalId(boundedId.parse(id))}`;
}

function keyedMedia(references: SocialDraftFields["mediaReferences"]) {
  return references.map((reference, index) => ({
    _key: createHash("sha256").update(`${reference.assetId}:${reference.role}:${reference.order ?? index}`).digest("hex").slice(0, 24),
    ...reference,
  }));
}

function keyedComments(comments: SocialDraftFields["commentSeries"]) {
  return comments.map((comment) => ({
    _key: createHash("sha256").update(`${comment.position}:${comment.text}`).digest("hex").slice(0, 24),
    ...comment,
  }));
}

function draftFields(input: SocialDraftFields, masterContentId: string) {
  return {
    masterContent: { _type: "reference", _ref: masterContentId },
    title: input.title,
    caption: input.caption,
    linkUrl: input.linkUrl,
    channel: input.channel,
    format: input.format,
    publishingMode: input.publishingMode,
    mediaReferences: keyedMedia(input.mediaReferences),
    commentSeriesMode: input.commentSeriesMode,
    commentSeries: keyedComments(input.commentSeries),
  };
}

export function buildSocialDraftCreateDocument(
  input: z.input<typeof createRequestSchema>,
  id: string = randomUUID(),
  resolvedMasterContentId = input.masterContentId,
) {
  const parsed = createRequestSchema.parse(input);
  return {
    _id: socialDraftId(`socialVariant-${id}`),
    _type: "socialVariant" as const,
    ...draftFields(parsed, socialLogicalId(resolvedMasterContentId)),
    version: 1,
    review: { status: "drafting" as const },
  };
}

export function planSocialDraftUpdate(
  input: z.input<typeof updateRequestSchema>,
  existing: z.input<typeof existingSocialDraftSchema>,
  resolvedMasterContentId = input.masterContentId,
) {
  const parsed = updateRequestSchema.parse(input);
  const current = existingSocialDraftSchema.parse(existing);
  if (current._rev !== parsed.expectedRevision) throw new Error("SOCIAL_DRAFT_REVISION_CONFLICT");
  // ponytail: every editorial edit invalidates every later review stage.
  const review = { status: "drafting", ...(current.review.notes ? { notes: current.review.notes } : {}) };
  return {
    draftId: socialDraftId(parsed.variantId),
    expectedRevision: parsed.expectedRevision,
    set: {
      ...draftFields(parsed, socialLogicalId(resolvedMasterContentId)),
      version: current.version + 1,
      review,
    },
  };
}
