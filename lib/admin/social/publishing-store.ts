import "server-only";

import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { createClient, groq } from "next-sanity";
import { z } from "zod";
import { getAdminSanityReadToken } from "../sanity-credentials";
import {
  SOCIAL_COMMENT_EXECUTION_MIGRATION_CHECKSUM,
  SOCIAL_COMMENT_EXECUTION_MIGRATION_VERSION,
  SOCIAL_PUBLICATION_EXECUTION_MIGRATION_CHECKSUM,
  SOCIAL_PUBLICATION_EXECUTION_MIGRATION_VERSION,
  isSocialPublicationApprovalEnabled,
  planSocialPublicationApproval,
  resolveSocialPublicationRuntime,
} from "./publishing";

export { isSocialPublicationApprovalEnabled };

const boundedId = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_.:-]+$/);
const commentSeriesSchema = z.array(z.object({
  position: z.number().int().min(1).max(20),
  text: z.string().min(1).max(2_000),
})).max(20).superRefine((comments, context) => {
  comments.forEach((comment, index) => {
    if (comment.position !== index + 1) {
      context.addIssue({ code: "custom", path: [index, "position"], message: "Comment positions must be consecutive and ordered" });
    }
  });
});
export const socialPublicationApprovalRequestSchema = z.strictObject({
  variantId: boundedId,
  expectedRevision: z.string().trim().min(1).max(120),
  expectedVersion: z.number().int().min(1),
  scheduledAt: z.string().datetime().nullable().default(null),
});

const sanityVariantSchema = z.object({
  id: z.string().trim().min(1).max(200),
  revision: z.string().trim().min(1).max(120),
  version: z.number().int().min(1),
  masterContentId: boundedId,
  platform: z.enum(["facebook", "instagram"]),
  format: z.enum(["text-post", "link-post", "image-post", "album", "carousel", "reel", "video", "short", "photo-post", "live"]),
  publishingMode: z.enum(["direct", "native-scheduled", "native-finish"]),
  reviewStatus: z.literal("approved"),
  linkUrl: z.string().url().refine((value) => new URL(value).protocol === "https:").nullable(),
  commentSeriesMode: z.enum(["top-level", "threaded"]),
  commentSeries: commentSeriesSchema,
});

const sanityExecutableVariantSchema = sanityVariantSchema.extend({
  format: z.enum(["text-post", "link-post", "image-post", "album", "carousel", "reel", "video", "photo-post"]),
  mediaBindings: z.array(z.object({
    assetId: boundedId,
    role: z.enum(["primary", "carousel-item"]),
    order: z.number().int().min(1).max(10).nullable(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4"]),
    sha256Checksum: z.string().regex(/^[0-9a-f]{64}$/),
  })).max(10),
}).superRefine((variant, context) => {
  const media = variant.mediaBindings;
  const images = new Set(["image/jpeg", "image/png", "image/webp"]);
  let valid = false;
  if (variant.format === "text-post" || variant.format === "link-post") valid = media.length === 0;
  else if (variant.format === "image-post" || variant.format === "photo-post") {
    valid = media.length === 1 && media[0]?.role === "primary" && images.has(media[0]?.mimeType ?? "");
  } else if (variant.format === "album" || variant.format === "carousel") {
    valid = media.length >= 2 && media.length <= 10 && media.every((item, index) => (
      item.role === "carousel-item" && item.order === index + 1 && images.has(item.mimeType)
    ));
  } else {
    valid = media.length === 1 && media[0]?.role === "primary" && media[0]?.mimeType === "video/mp4";
  }
  if (!valid) context.addIssue({ code: "custom", path: ["mediaBindings"], message: "Approved media binding is incomplete" });
  if (variant.platform !== "facebook" && variant.commentSeries.length > 0) {
    context.addIssue({ code: "custom", path: ["commentSeries"], message: "Comment Series belongs to Facebook only" });
  }
});

const approvedVariantListSchema = z.array(sanityVariantSchema.extend({
  title: z.string().trim().min(1).max(200),
  caption: z.string().max(50_000).nullable(),
  mediaMetadata: z.array(z.object({
    assetId: boundedId,
    role: z.enum(["primary", "carousel-item", "cover", "thumbnail", "caption"]),
    order: z.number().int().min(1).max(20).nullable(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "text/vtt"]).nullable(),
    sha256Checksum: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
    widthPx: z.number().int().min(1).max(32_768).nullable(),
    heightPx: z.number().int().min(1).max(32_768).nullable(),
    durationMs: z.number().int().min(1).max(86_400_000).nullable(),
  })).max(20),
})).max(200);

const publicationListSchema = z.array(z.object({
  variant_id: boundedId,
  publication_id: boundedId,
  status: z.enum(["draft", "approved", "queued", "native-scheduled", "awaiting-native-finish", "processing", "published", "failed", "cancelled", "superseded"]),
  execution_target: z.enum(["facebook-publish-now", "facebook-native-scheduled", "instagram-publish-now", "instagram-mobile-handoff"]).nullable(),
  scheduled_at: z.coerce.date().nullable(),
  approved_revision: z.string().trim().min(1).max(120).nullable(),
  approved_version: z.number().int().min(1).nullable(),
  job_version: z.number().int().min(1).nullable(),
})).max(200);

const approvedSnapshotRowsSchema = z.array(z.object({
  publication_id: boundedId,
  publication_status: z.enum(["draft", "approved", "queued", "native-scheduled", "awaiting-native-finish", "processing", "published", "failed", "cancelled", "superseded"]),
  idempotency_key: z.string().min(16).max(200),
  scheduled_at: z.coerce.date().nullable(),
  execution_target: z.enum(["facebook-publish-now", "facebook-native-scheduled", "instagram-publish-now", "instagram-mobile-handoff"]),
  job_id: boundedId,
  job_status: z.enum(["queued", "processing", "succeeded", "failed", "cancelled"]),
  job_version: z.number().int().min(1),
  attempt_count: z.number().int().min(0),
})).max(1);
const approvedCommentRowsSchema = z.array(z.object({
  id: boundedId,
  position: z.number().int().min(1).max(20),
  parent_item_id: boundedId.nullable(),
  status: z.enum(["draft", "approved", "queued", "processing", "published", "failed", "cancelled"]),
  platform_comment_id: z.string().trim().min(1).max(200).nullable(),
})).max(20);

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeActorRef(actor: string) {
  return `admin:${digest(actor).slice(0, 32)}`;
}

function sameSchedule(existing: Date | null, requested: string | null) {
  return existing?.toISOString() === requested || (existing === null && requested === null);
}

function commentIdentity(idempotencyKey: string, position: number) {
  return `comment:${digest(`${idempotencyKey}:comment:${position}`).slice(0, 32)}`;
}

function assertApprovedCommentBinding(
  rows: z.infer<typeof approvedCommentRowsSchema>,
  idempotencyKey: string,
  mode: "top-level" | "threaded",
  comments: z.infer<typeof commentSeriesSchema>,
) {
  if (rows.length !== comments.length) throw new Error("SOCIAL_COMMENT_SERIES_PERSISTENCE_CONFLICT");
  rows.forEach((row, index) => {
    const position = index + 1;
    const expectedId = commentIdentity(idempotencyKey, position);
    const expectedParentId = mode === "threaded" && position > 1
      ? commentIdentity(idempotencyKey, position - 1)
      : null;
    if (row.id !== expectedId || row.position !== position || row.parent_item_id !== expectedParentId) {
      throw new Error("SOCIAL_COMMENT_SERIES_PERSISTENCE_CONFLICT");
    }
  });
}

function sanityReadClient(env: Record<string, string | undefined>) {
  const runtime = resolveSocialPublicationRuntime(env);
  if (!runtime) throw new Error("SOCIAL_PUBLICATION_APPROVAL_NOT_CONFIGURED");
  const token = getAdminSanityReadToken();
  if (!token) throw new Error("SOCIAL_SANITY_READ_NOT_CONFIGURED");
  return createClient({
    projectId: runtime.sanityProjectId,
    dataset: runtime.sanityDataset,
    apiVersion: "2026-08-20",
    token,
    useCdn: false,
    perspective: "raw",
  });
}

async function readCurrentApprovedVariant(variantId: string, env: Record<string, string | undefined>) {
  const client = sanityReadClient(env);
  const publishedId = variantId.replace(/^drafts\./, "");
  const draftId = `drafts.${publishedId}`;
  const raw = await client.fetch(groq`coalesce(
    *[_type == "socialVariant" && _id == $draftId][0],
    *[_type == "socialVariant" && _id == $publishedId][0]
  ){
    "id": _id,
    "revision": _rev,
    version,
    "masterContentId": masterContent._ref,
    "platform": channel,
    format,
    publishingMode,
    "linkUrl": coalesce(linkUrl, null),
    "commentSeriesMode": coalesce(commentSeriesMode, "top-level"),
    "commentSeries": coalesce(commentSeries[] | order(position asc){ position, text }, []),
    "mediaBindings": coalesce(mediaReferences[]{
      assetId,
      role,
      "order": coalesce(order, null),
      "mimeType": coalesce(mimeType, null),
      "sha256Checksum": coalesce(sha256Checksum, null)
    }, []),
    "reviewStatus": review.status
  }`, { draftId, publishedId });
  if (!raw) throw new Error("SOCIAL_VARIANT_NOT_FOUND");
  const parsed = sanityExecutableVariantSchema.safeParse(raw);
  if (!parsed.success) throw new Error("SOCIAL_VARIANT_NOT_APPROVED_OR_UNSUPPORTED");
  return { ...parsed.data, variantId: publishedId };
}

export async function listApprovedSocialVariants(env: Record<string, string | undefined> = process.env) {
  const client = sanityReadClient(env);
  const raw = await client.fetch(groq`*[
    _type == "socialVariant"
    && review.status == "approved"
    && channel in ["facebook", "instagram"]
  ] | order(_updatedAt desc)[0...200]{
    "id": _id,
    "revision": _rev,
    version,
    "masterContentId": masterContent._ref,
    "platform": channel,
    format,
    publishingMode,
    "commentSeriesMode": coalesce(commentSeriesMode, "top-level"),
    "commentSeries": coalesce(commentSeries[] | order(position asc){ position, text }, []),
    "reviewStatus": review.status,
    title,
    "caption": coalesce(caption, null),
    "linkUrl": coalesce(linkUrl, null),
    "mediaMetadata": coalesce(mediaReferences[]{
      "assetId": coalesce(assetId, asset._ref),
      role,
      "order": coalesce(order, position, null),
      "mimeType": coalesce(mimeType, asset->mimeType, null),
      "sha256Checksum": coalesce(sha256Checksum, asset->checksumSha256, null),
      "widthPx": coalesce(widthPx, asset->widthPx, null),
      "heightPx": coalesce(heightPx, asset->heightPx, null),
      "durationMs": coalesce(durationMs, asset->durationMs, null)
    }, [])
  }`);
  const parsed = approvedVariantListSchema.parse(raw);
  const current = new Map<string, (typeof parsed)[number]>();
  for (const variant of parsed) {
    const baseId = variant.id.replace(/^drafts\./, "");
    if (!current.has(baseId) || variant.id.startsWith("drafts.")) current.set(baseId, { ...variant, id: baseId });
  }

  const sql = await verifiedSql(env);
  const publications = publicationListSchema.parse(await sql.query(
    `SELECT DISTINCT ON (publication.variant_id) publication.variant_id,publication.id AS publication_id,
       publication.status,publication.execution_target,publication.scheduled_at,
       publication.approved_revision,publication.approved_version,job.version AS job_version
     FROM ccpun_social.social_publication AS publication
     LEFT JOIN LATERAL (
       SELECT version FROM ccpun_social.social_publication_job
       WHERE publication_id=publication.id ORDER BY created_at DESC,id DESC LIMIT 1
     ) AS job ON true
     ORDER BY publication.variant_id,publication.created_at DESC`,
  ));
  const byVariant = new Map(publications.map((publication) => [publication.variant_id, publication]));
  return [...current.values()].map((variant) => {
    const publication = byVariant.get(variant.id);
    return {
      variantId: variant.id,
      revision: variant.revision,
      version: variant.version,
      masterContentId: variant.masterContentId,
      platform: variant.platform,
      format: variant.format,
      publishingMode: variant.publishingMode,
      reviewStatus: variant.reviewStatus,
      title: variant.title,
      caption: variant.caption,
      linkUrl: variant.linkUrl,
      commentSeriesMode: variant.commentSeriesMode,
      commentSeries: variant.commentSeries,
      mediaMetadata: variant.mediaMetadata,
      publication: publication ? {
        publicationId: publication.publication_id,
        status: publication.status,
        executionTarget: publication.execution_target,
        scheduledAt: publication.scheduled_at?.toISOString() ?? null,
        approvedRevision: publication.approved_revision,
        approvedVersion: publication.approved_version,
        jobVersion: publication.job_version,
      } : null,
    };
  });
}

async function verifiedSql(env: Record<string, string | undefined>) {
  const runtime = resolveSocialPublicationRuntime(env);
  if (!runtime) throw new Error("SOCIAL_PUBLICATION_APPROVAL_NOT_CONFIGURED");
  const identity = runtime.neonIdentity;
  const sql = neon(env.CCPUN_SOCIAL_DATABASE_URL!.trim(), { fetchOptions: { signal: AbortSignal.timeout(15_000) } });
  const rows = await sql.query(
    `SELECT current_database() AS database_name,current_user AS role_name,
       EXISTS (SELECT 1 FROM ccpun_social.schema_migration WHERE version=$1 AND checksum=$2) AS execution_ledger_current,
       EXISTS (SELECT 1 FROM ccpun_social.schema_migration WHERE version=$3 AND checksum=$4) AS comment_ledger_current,
       EXISTS (SELECT 1 FROM ccpun_social.system_identity WHERE singleton=true AND project_id=$5 AND branch_id=$6
         AND endpoint_id=$7 AND database_name=$8) AS identity_current`,
    [SOCIAL_PUBLICATION_EXECUTION_MIGRATION_VERSION, SOCIAL_PUBLICATION_EXECUTION_MIGRATION_CHECKSUM,
      SOCIAL_COMMENT_EXECUTION_MIGRATION_VERSION, SOCIAL_COMMENT_EXECUTION_MIGRATION_CHECKSUM,
      identity.projectId, identity.branchId, identity.endpointId, identity.database],
  ) as Array<{ database_name: string; role_name: string; execution_ledger_current: boolean; comment_ledger_current: boolean; identity_current: boolean }>;
  const row = rows[0];
  if (!row || row.database_name !== identity.database
    || row.role_name !== identity.role || !row.execution_ledger_current
    || !row.comment_ledger_current || !row.identity_current) {
    throw new Error("SOCIAL_PUBLICATION_APPROVAL_IDENTITY_MISMATCH");
  }
  return sql;
}

export async function approveSocialPublication(input: {
  request: z.input<typeof socialPublicationApprovalRequestSchema>;
  actor: string;
  requestId: string;
  env?: Record<string, string | undefined>;
}) {
  const env = input.env ?? process.env;
  const request = socialPublicationApprovalRequestSchema.parse(input.request);
  const variant = await readCurrentApprovedVariant(request.variantId, env);
  const now = new Date().toISOString();
  const plan = planSocialPublicationApproval({
    variantId: variant.variantId,
    masterContentId: variant.masterContentId,
    platform: variant.platform,
    publishingMode: variant.publishingMode,
    approvedRevision: request.expectedRevision,
    approvedVersion: request.expectedVersion,
    currentRevision: variant.revision,
    currentVersion: variant.version,
    approvedByActorType: "human",
    approvalRequestRef: input.requestId,
    approvedAt: now,
    requestedAt: now,
    scheduledAt: request.scheduledAt,
    mediaAssetIds: variant.mediaBindings.map((media) => media.assetId),
  });
  if (plan.state !== "ready" || !plan.jobType || !plan.publicationStatus) throw new Error("SOCIAL_PUBLICATION_REVISION_CONFLICT");

  const sql = await verifiedSql(env);
  const publicationId = `publication:${digest(plan.idempotencyKey).slice(0, 32)}`;
  const jobId = `job:${digest(`${plan.idempotencyKey}:job`).slice(0, 32)}`;
  const actorRef = safeActorRef(input.actor);
  const readApprovedSnapshot = async () => approvedSnapshotRowsSchema.parse(await sql.query(
    `SELECT publication.id AS publication_id,publication.status AS publication_status,
       publication.idempotency_key,publication.scheduled_at,publication.execution_target,
       job.id AS job_id,job.status AS job_status,job.version AS job_version,job.attempt_count
     FROM ccpun_social.social_publication AS publication
     JOIN ccpun_social.social_publication_job AS job ON job.publication_id=publication.id
     WHERE publication.variant_id=$1 AND publication.approved_revision=$2 AND publication.approved_version=$3
     ORDER BY job.created_at DESC LIMIT 1`,
    [variant.variantId, variant.revision, variant.version],
  ))[0] ?? null;
  const existing = await readApprovedSnapshot();
  if (existing) {
    const existingComments = approvedCommentRowsSchema.parse(await sql.query(
      `SELECT id,position,parent_item_id,status,platform_comment_id
       FROM ccpun_social.social_comment_item WHERE publication_id=$1 ORDER BY position`,
      [existing.publication_id],
    ));
    assertApprovedCommentBinding(existingComments, existing.idempotency_key, variant.commentSeriesMode, variant.commentSeries);
    const unchanged = existing.execution_target === plan.executionTarget
      && sameSchedule(existing.scheduled_at, request.scheduledAt);
    if (unchanged) {
      return { ...plan, state: "replay" as const, idempotencyKey: existing.idempotency_key,
        publicationId: existing.publication_id, jobId: existing.job_id };
    }
    const amendable = variant.platform === "facebook"
      && existing.attempt_count === 0
      && ["approved", "failed", "cancelled", "superseded"].includes(existing.publication_status)
      && ["queued", "failed", "cancelled"].includes(existing.job_status);
    if (!amendable) throw new Error("SOCIAL_PUBLICATION_ACTIVE_EXECUTION_EXISTS");
    const amended = z.array(z.object({ publication_id: boundedId, job_id: boundedId })).max(1).parse(await sql.query(
      `WITH locked_job AS MATERIALIZED (
         SELECT publication.id AS publication_id,job.id AS job_id
         FROM ccpun_social.social_publication AS publication
         JOIN ccpun_social.social_publication_job AS job ON job.publication_id=publication.id
         WHERE publication.id=$1 AND job.id=$2 AND job.version=$3 AND job.attempt_count=0
           AND publication.status IN ('approved','failed','cancelled','superseded')
           AND job.status IN ('queued','failed','cancelled')
         FOR UPDATE OF publication,job
       ), amended_publication AS (
         UPDATE ccpun_social.social_publication SET status=$4,scheduled_at=$5::timestamptz,
           execution_target=$6,approved_by_actor_ref=$7,approved_at=$8::timestamptz,
           approval_request_ref=$9,platform_object_id=NULL,published_at=NULL,updated_at=now()
         WHERE id=$1 AND EXISTS (SELECT 1 FROM locked_job) RETURNING id AS publication_id
       ), amended_job AS (
         UPDATE ccpun_social.social_publication_job SET status='queued',version=version+1,
           attempt_count=0,execution_target=$6,lock_owner=NULL,locked_at=NULL,lock_expires_at=NULL,
           last_error_category=NULL,last_error_ref=NULL,updated_at=now()
         WHERE id=$2 AND version=$3 AND EXISTS (SELECT 1 FROM amended_publication)
         RETURNING id AS job_id
       ), audit AS (
         INSERT INTO ccpun_social.social_execution_audit
           (id,actor_type,actor_ref,action,object_type,object_id,request_ref,outcome)
         SELECT $10,'human',$7,'publication:amend','publication',$1,$9,'succeeded'
         FROM amended_job ON CONFLICT DO NOTHING
       )
       SELECT publication_id,job_id FROM amended_publication CROSS JOIN amended_job`,
      [existing.publication_id, existing.job_id, existing.job_version, plan.publicationStatus,
        request.scheduledAt, plan.executionTarget, actorRef, now, input.requestId, `audit:${input.requestId}`],
    ));
    if (!amended[0]) throw new Error("SOCIAL_PUBLICATION_AMENDMENT_CONFLICT");
    return { ...plan, state: "amended" as const, idempotencyKey: existing.idempotency_key,
      publicationId: amended[0].publication_id, jobId: amended[0].job_id };
  }

  await sql.transaction((transaction) => [
    transaction.query(
      `INSERT INTO ccpun_social.social_variant_link
       (variant_id,master_content_id,channel,format,publishing_mode,editorial_revision,editorial_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (variant_id) DO UPDATE SET editorial_revision=EXCLUDED.editorial_revision,
         editorial_version=EXCLUDED.editorial_version,format=EXCLUDED.format,
         publishing_mode=EXCLUDED.publishing_mode,updated_at=now()
       WHERE ccpun_social.social_variant_link.master_content_id=EXCLUDED.master_content_id
         AND ccpun_social.social_variant_link.channel=EXCLUDED.channel
         AND (
           ccpun_social.social_variant_link.editorial_version IS NULL
           OR EXCLUDED.editorial_version > ccpun_social.social_variant_link.editorial_version
           OR (EXCLUDED.editorial_version = ccpun_social.social_variant_link.editorial_version
             AND EXCLUDED.editorial_revision = ccpun_social.social_variant_link.editorial_revision)
         )`,
      [variant.variantId, variant.masterContentId, variant.platform, variant.format, variant.publishingMode, variant.revision, variant.version],
    ),
    transaction.query(
      `INSERT INTO ccpun_social.social_publication
       (id,variant_id,status,idempotency_key,scheduled_at,execution_target,approved_revision,approved_version,
        approved_by_actor_ref,approved_at,approval_request_ref)
       SELECT $1,$2,$3,$4,$5::timestamptz,$6,$7,$8,$9,$10::timestamptz,$11
       FROM ccpun_social.social_variant_link
       WHERE variant_id=$2 AND editorial_revision=$7 AND editorial_version=$8
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [publicationId, variant.variantId, plan.publicationStatus, plan.idempotencyKey, request.scheduledAt,
        plan.executionTarget, variant.revision, variant.version, actorRef, now, input.requestId],
    ),
    transaction.query(
      `INSERT INTO ccpun_social.social_publication_job
       (id,publication_id,job_type,status,idempotency_key,execution_target)
       SELECT $1,$2,$3,'queued',$4,$5
       FROM ccpun_social.social_publication WHERE id=$2
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [jobId, publicationId, plan.jobType, `${plan.idempotencyKey}:job`, plan.executionTarget],
    ),
    ...variant.commentSeries.map((comment) => {
      const commentId = commentIdentity(plan.idempotencyKey, comment.position);
      const parentId = variant.commentSeriesMode === "threaded" && comment.position > 1
        ? commentIdentity(plan.idempotencyKey, comment.position - 1)
        : null;
      return transaction.query(
        `INSERT INTO ccpun_social.social_comment_item
         (id,publication_id,position,parent_item_id,status,idempotency_key)
         SELECT $1,$2,$3,$4,'approved',$5
         FROM ccpun_social.social_publication
         WHERE id=$2 AND approved_revision=$6 AND approved_version=$7
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [commentId, publicationId, comment.position, parentId,
          `${plan.idempotencyKey}:comment:${comment.position}`, variant.revision, variant.version],
      );
    }),
    ...(plan.executionTarget === "instagram-mobile-handoff" ? [transaction.query(
      `INSERT INTO ccpun_social.social_mobile_handoff
       (id,publication_id,variant_id,approved_revision,approved_version,media_asset_ids,status,idempotency_key)
       SELECT $1,$2,$3,$4,$5,
         COALESCE((SELECT jsonb_agg(asset_id ORDER BY role,position NULLS FIRST) FROM ccpun_social.social_variant_media WHERE variant_id=$3),'[]'::jsonb),
         'ready',$6 FROM ccpun_social.social_publication WHERE id=$2
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [`handoff:${digest(plan.idempotencyKey).slice(0, 32)}`, publicationId, variant.variantId,
        variant.revision, variant.version, `${plan.idempotencyKey}:handoff`],
    )] : []),
    transaction.query(
      `INSERT INTO ccpun_social.social_execution_audit
       (id,actor_type,actor_ref,action,object_type,object_id,request_ref,outcome)
       SELECT $1,'human',$2,'publication:approve','publication',$3,$4,'succeeded'
       FROM ccpun_social.social_publication WHERE id=$3
       ON CONFLICT DO NOTHING`,
      [`audit:${input.requestId}`, actorRef, publicationId, input.requestId],
    ),
  ], { isolationLevel: "Serializable" });

  const persisted = await readApprovedSnapshot();
  if (!persisted) throw new Error("SOCIAL_PUBLICATION_PERSISTENCE_CONFLICT");
  const persistedComments = approvedCommentRowsSchema.parse(await sql.query(
    `SELECT id,position,parent_item_id,status,platform_comment_id
     FROM ccpun_social.social_comment_item WHERE publication_id=$1 ORDER BY position`,
    [persisted.publication_id],
  ));
  assertApprovedCommentBinding(persistedComments, persisted.idempotency_key, variant.commentSeriesMode, variant.commentSeries);
  return { ...plan, idempotencyKey: persisted.idempotency_key,
    publicationId: persisted.publication_id, jobId: persisted.job_id };
}
