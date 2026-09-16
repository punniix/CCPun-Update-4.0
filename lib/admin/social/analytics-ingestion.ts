import "server-only";

import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { normalizeMetaAnalytics } from "./provider-adapters";
import { WEBSITE_42_SOCIAL_ANALYTICS_BRANCH } from "./provider-readonly";
import { fetchMetaContentMetadataByIds, fetchMetaReadOnlyDiscovery, matchMetaHistoricalAnalytics } from "./providers/meta/read-only";
import { fetchTikTokReadOnlyDiscovery, matchTikTokHistoricalAnalytics } from "./providers/tiktok/read-only";
import { fetchYouTubeReadOnlyDiscovery, matchYouTubeHistoricalAnalytics } from "./providers/youtube/read-only";
import {
  resolveSocialRuntime,
  SOCIAL_PROVIDER_HISTORY_MIGRATION_CHECKSUM,
  SOCIAL_PROVIDER_HISTORY_MIGRATION_VERSION,
  socialAnalyticsMigrationForLane,
} from "./runtime";

export {
  SOCIAL_ANALYTICS_MIGRATION_CHECKSUM,
  SOCIAL_ANALYTICS_MIGRATION_VERSION,
  SOCIAL_PRODUCTION_ANALYTICS_MIGRATION_CHECKSUM,
  SOCIAL_PRODUCTION_ANALYTICS_MIGRATION_VERSION,
  SOCIAL_PROVIDER_HISTORY_MIGRATION_CHECKSUM,
  SOCIAL_PROVIDER_HISTORY_MIGRATION_VERSION,
} from "./runtime";
export const SOCIAL_ANALYTICS_DASHBOARD_CONTENT_LIMIT = 10_000;
export const socialAnalyticsProviderSchema = z.enum(["meta", "youtube", "tiktok"]);

const providerFailureSchema = z.enum(["authentication", "authorization", "rate-limit", "timeout", "provider-unavailable", "invalid-response", "unknown"]);
const publicationsSchema = z.array(z.object({
  publication_id: z.string().trim().min(1).max(120), platform: z.enum(["facebook", "instagram", "youtube", "tiktok"]),
  platform_object_id: z.string().trim().min(1).max(200), published_at: z.coerce.date(),
})).max(10_000);
const metricSchema = z.object({
  key: z.string().trim().min(1).max(80), label: z.string().trim().min(1).max(120), value: z.number().nonnegative(),
  unit: z.enum(["count", "seconds", "minutes", "milliseconds"]), dimension: z.enum(["discovery", "engagement", "deep-engagement", "retention", "business-intent"]),
});
const latestMetricsSchema = z.array(z.object({
  publication_id: z.string().trim().min(1).max(120),
  native_metrics: z.array(metricSchema).min(1).max(20),
})).max(10_000);
const syncStateSchema = z.array(z.object({
  last_success_at: z.coerce.date().nullable(),
  backfill_completed_at: z.coerce.date().nullable(),
})).max(1);
const metaMetadataRefreshTargetsSchema = z.array(z.object({
  platform: z.enum(["facebook", "instagram"]),
  provider_object_id: z.string().trim().min(1).max(200),
  last_seen_at: z.coerce.date(),
})).max(100);

const META_METRICS_OVERLAP_DEFAULT_DAYS = 30;
const META_METRICS_OVERLAP_MAX_DAYS = 180;
const META_INSIGHTS_LIMIT_DEFAULT = 25;
const META_METADATA_REFRESH_DEFAULT_DAYS = 2;
const META_METADATA_REFRESH_BATCH_DEFAULT = 100;

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function resolveMetaAnalyticsSyncPolicy(env: Record<string, string | undefined> = process.env) {
  return {
    metricsOverlapDays: boundedInteger(env.CCPUN_META_METRICS_OVERLAP_DAYS, META_METRICS_OVERLAP_DEFAULT_DAYS, 1, META_METRICS_OVERLAP_MAX_DAYS),
    insightsBackfillLimit: boundedInteger(env.CCPUN_META_INSIGHTS_BACKFILL_LIMIT, META_INSIGHTS_LIMIT_DEFAULT, 1, 50),
    metadataRefreshDays: boundedInteger(env.CCPUN_META_METADATA_REFRESH_DAYS, META_METADATA_REFRESH_DEFAULT_DAYS, 1, 30),
    metadataRefreshBatchSize: boundedInteger(env.CCPUN_META_METADATA_REFRESH_BATCH_SIZE, META_METADATA_REFRESH_BATCH_DEFAULT, 1, 100),
  };
}
const dashboardRowsSchema = z.array(z.object({
  publication_id: z.string().trim().min(1).max(120), provider: socialAnalyticsProviderSchema,
  platform: z.enum(["facebook", "instagram", "youtube", "tiktok"]), platform_object_id: z.string().trim().min(1).max(200),
  fetched_at: z.coerce.date(), native_metrics: z.array(metricSchema).min(1).max(20), limitations: z.array(z.string()).min(1).max(10),
  format: z.string().trim().min(1).max(80).nullable(), published_at: z.coerce.date().nullable(),
  snapshot_count: z.coerce.number().int().positive(),
})).max(SOCIAL_ANALYTICS_DASHBOARD_CONTENT_LIMIT * 2);
const providerDashboardRowsSchema = z.array(z.object({
  content_id: z.string().trim().min(1).max(120), provider: socialAnalyticsProviderSchema,
  platform: z.enum(["facebook", "instagram", "youtube", "tiktok"]), provider_object_id: z.string().trim().min(1).max(200),
  linked_publication_id: z.string().trim().min(1).max(120).nullable(), published_at: z.coerce.date(),
  text_content: z.string().max(50_000), media_type: z.string().trim().min(1).max(80),
  permalink_url: z.string().min(1).max(1_000).nullable(), thumbnail_url: z.string().min(1).max(2_000).nullable(),
  fetched_at: z.coerce.date().nullable(), native_metrics: z.array(metricSchema).min(1).max(20).nullable(),
  previous_native_metrics: z.array(metricSchema).min(1).max(20).nullable(), snapshot_count: z.coerce.number().int().nonnegative(),
})).max(SOCIAL_ANALYTICS_DASHBOARD_CONTENT_LIMIT);

function safeProviderUrl(value: string | null, platform: "facebook" | "instagram" | "youtube" | "tiktok", kind: "permalink" | "thumbnail") {
  if (!value) return null;
  const allowed = kind === "permalink"
    ? { facebook: ["facebook.com", "fb.com"], instagram: ["instagram.com"], youtube: ["youtube.com", "youtu.be"], tiktok: ["tiktok.com"] }[platform]
    : { facebook: ["fbcdn.net"], instagram: ["cdninstagram.com", "fbcdn.net"], youtube: ["ytimg.com", "ggpht.com"], tiktok: ["tiktokcdn.com"] }[platform];
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password
      && allowed.some((domain) => host === domain || host.endsWith(`.${domain}`)) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isSocialAnalyticsIngestionEnabled(env: Record<string, string | undefined> = process.env) {
  return env.CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED === "1"
    && Boolean(resolveSocialRuntime(env, {
      uatBranches: [WEBSITE_42_SOCIAL_ANALYTICS_BRANCH],
      requireUatNeon: true,
    }));
}

export function getSocialAnalyticsIngestionRuntimeStatus(env: Record<string, string | undefined> = process.env) {
  return { enabled: isSocialAnalyticsIngestionEnabled(env), mode: "manual-provider-read" as const, providerWriteAllowed: false as const, backgroundSyncAllowed: false as const };
}

function safeActorRef(actor: string) {
  return `admin:${createHash("sha256").update(actor).digest("hex").slice(0, 32)}`;
}

function snapshotId(publicationId: string, provider: string, fetchedAt: string) {
  return `metric:${createHash("sha256").update(`${publicationId}:${provider}:${fetchedAt}`).digest("hex")}`;
}

function digest(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function transientThumbnailIdentity(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}

function providerContentId(platform: string, providerObjectId: string) {
  return `provider-content:${digest(["meta", platform, providerObjectId])}`;
}

function metricsHash(metrics: z.infer<typeof metricSchema>[]) {
  return digest(metrics.map((metric) => [metric.key, metric.label, metric.value, metric.unit, metric.dimension]));
}

async function verifiedSql(env: Record<string, string | undefined>) {
  const runtime = env.CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED === "1"
    ? resolveSocialRuntime(env, { uatBranches: [WEBSITE_42_SOCIAL_ANALYTICS_BRANCH], requireUatNeon: true })
    : null;
  if (!runtime) throw new Error("SOCIAL_ANALYTICS_NOT_CONFIGURED");
  const identity = runtime.neonIdentity;
  const migration = socialAnalyticsMigrationForLane(runtime.lane);
  const sql = neon(env.CCPUN_SOCIAL_DATABASE_URL!.trim(), { fetchOptions: { signal: AbortSignal.timeout(30_000) } });
  const rows = await sql.query(
    `SELECT current_database() AS database_name, current_user AS role_name,
       EXISTS (SELECT 1 FROM ccpun_social.schema_migration WHERE version=$1 AND checksum=$2) AS ledger_current,
       EXISTS (SELECT 1 FROM ccpun_social.system_identity WHERE singleton=true AND project_id=$3 AND branch_id=$4
         AND endpoint_id=$5 AND database_name=$6 AND migration_version=$1 AND migration_checksum=$2) AS identity_current,
       EXISTS (SELECT 1 FROM ccpun_social.schema_migration WHERE version=$7 AND checksum=$8) AS provider_history_current`,
    [migration.version, migration.checksum, identity.projectId, identity.branchId, identity.endpointId, identity.database,
      SOCIAL_PROVIDER_HISTORY_MIGRATION_VERSION, SOCIAL_PROVIDER_HISTORY_MIGRATION_CHECKSUM],
  ) as Array<{ database_name: string; role_name: string; ledger_current: boolean; identity_current: boolean; provider_history_current: boolean }>;
  const row = rows[0];
  if (!row || row.database_name !== identity.database || row.role_name !== identity.role || !row.ledger_current || !row.identity_current || !row.provider_history_current) throw new Error("SOCIAL_ANALYTICS_IDENTITY_MISMATCH");
  return sql;
}

async function fetchProvider(
  provider: z.infer<typeof socialAnalyticsProviderSchema>,
  publications: z.infer<typeof publicationsSchema>,
  env: Record<string, string | undefined>,
  fetcher: typeof fetch,
  since: string | null,
  metaPolicy: ReturnType<typeof resolveMetaAnalyticsSyncPolicy>,
  metadataTargets: z.infer<typeof metaMetadataRefreshTargetsSchema>,
) {
  const refs = publications.map((item) => ({ publicationId: item.publication_id, platform: item.platform, platformObjectId: item.platform_object_id }));
  if (provider === "meta") {
    const discovery = await fetchMetaReadOnlyDiscovery(env, fetcher, {
      since,
      includeInsights: true,
      insightsBackfillLimit: metaPolicy.insightsBackfillLimit,
    });
    if (!discovery.selectedPageId) throw new Error("META_PAGE_SELECTION_REQUIRED");
    const linked = new Map(refs.map((item) => [`${item.platform}:${item.platformObjectId}`, item.publicationId]));
    const toProviderContent = (item: {
      id: string; platform: "facebook" | "instagram"; text: string; mediaType: string; publishedAt: string;
      permalink: string | null; thumbnailUrl: string | null; metrics: Record<string, number | undefined>;
    }, fetchedAt: string, providerAccountId: string) => {
      const contentId = providerContentId(item.platform, item.id);
      const nativeMetrics = normalizeMetaAnalytics({ publicationId: contentId, platform: item.platform, fetchedAt, metrics: item.metrics }).nativeMetrics;
      return {
        contentId, platform: item.platform, providerAccountId, providerObjectId: item.id,
        linkedPublicationId: linked.get(`${item.platform}:${item.id}`) ?? null,
        publishedAt: item.publishedAt, text: item.text, mediaType: item.mediaType,
        permalink: item.permalink, thumbnailUrl: item.thumbnailUrl, nativeMetrics, fetchedAt,
      };
    };
    const recentProviderContents = [
      ...discovery.facebookPosts.map((item) => toProviderContent({ ...item, platform: "facebook" as const }, discovery.fetchedAt, discovery.selectedPageId!)),
      ...discovery.instagramMedia.map((item) => toProviderContent({ ...item, platform: "instagram" as const }, discovery.fetchedAt, discovery.selectedInstagramAccountId ?? discovery.selectedPageId!)),
    ];
    const metadataRefresh = since !== null && metadataTargets.length > 0
      ? await fetchMetaContentMetadataByIds(env, metadataTargets.map((target) => ({ platform: target.platform, providerObjectId: target.provider_object_id })), fetcher)
      : null;
    const refreshedProviderContents = metadataRefresh?.items.map((item) => toProviderContent(
      item,
      metadataRefresh.fetchedAt,
      item.platform === "facebook" ? metadataRefresh.selectedPageId : metadataRefresh.selectedInstagramAccountId ?? metadataRefresh.selectedPageId,
    )) ?? [];
    const providerContentByKey = new Map(recentProviderContents.map((content) => [`${content.platform}:${content.providerObjectId}`, content]));
    for (const content of refreshedProviderContents) providerContentByKey.set(`${content.platform}:${content.providerObjectId}`, content);
    return {
      discovery,
      matched: matchMetaHistoricalAnalytics(refs, discovery),
      accountId: discovery.selectedPageId,
      cursor: null,
      providerContents: [...providerContentByKey.values()],
      providerMetricContents: recentProviderContents,
      metadataRefreshAttempted: metadataTargets.length,
      metadataRefreshSucceeded: refreshedProviderContents.length,
      metadataRefreshUnavailableObjectIds: metadataRefresh?.unavailableObjectIds ?? [],
      metadataRefreshUnavailableTargets: metadataRefresh?.unavailableTargets ?? [],
    };
  }
  if (provider === "youtube") {
    const discovery = await fetchYouTubeReadOnlyDiscovery(env, fetcher);
    return { discovery, matched: matchYouTubeHistoricalAnalytics(refs, discovery), accountId: discovery.channel.id, cursor: null, providerContents: [], providerMetricContents: [], metadataRefreshAttempted: 0, metadataRefreshSucceeded: 0, metadataRefreshUnavailableObjectIds: [] as string[], metadataRefreshUnavailableTargets: [] as Array<{ platform: "facebook" | "instagram"; providerObjectId: string }> };
  }
  const discovery = await fetchTikTokReadOnlyDiscovery(env, fetcher);
  return { discovery, matched: matchTikTokHistoricalAnalytics(refs, discovery), accountId: discovery.profile.openId, cursor: discovery.nextCursor === null ? null : String(discovery.nextCursor), providerContents: [], providerMetricContents: [], metadataRefreshAttempted: 0, metadataRefreshSucceeded: 0, metadataRefreshUnavailableObjectIds: [] as string[], metadataRefreshUnavailableTargets: [] as Array<{ platform: "facebook" | "instagram"; providerObjectId: string }> };
}

export async function syncSocialHistoricalAnalytics(input: {
  provider: z.input<typeof socialAnalyticsProviderSchema>; actor: string; requestId: string;
  env?: Record<string, string | undefined>; fetcher?: typeof fetch;
}) {
  const provider = socialAnalyticsProviderSchema.parse(input.provider);
  const env = input.env ?? process.env;
  const sql = await verifiedSql(env);
  const syncState = syncStateSchema.parse(await sql.query(
    `SELECT last_success_at,backfill_completed_at FROM ccpun_social.social_provider_sync_state
     WHERE provider=$1 ORDER BY last_success_at DESC NULLS LAST LIMIT 1`,
    [provider],
  ))[0];
  const metaPolicy = resolveMetaAnalyticsSyncPolicy(env);
  const since = provider === "meta" && syncState?.backfill_completed_at && syncState.last_success_at
    ? new Date(syncState.last_success_at.getTime() - metaPolicy.metricsOverlapDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const metadataRefreshTargets = provider === "meta" && since !== null
    ? metaMetadataRefreshTargetsSchema.parse(await sql.query(
      `SELECT platform,provider_object_id,last_seen_at
       FROM ccpun_social.social_provider_content
       WHERE provider='meta'
         AND platform IN ('facebook','instagram')
         AND published_at < $1::timestamptz
         AND GREATEST(last_seen_at,updated_at) < now() - ($2::int * interval '1 day')
       ORDER BY (thumbnail_url IS NULL) ASC,GREATEST(last_seen_at,updated_at) ASC,published_at DESC
       LIMIT $3`,
      [since, metaPolicy.metadataRefreshDays, metaPolicy.metadataRefreshBatchSize],
    ))
    : [];
  const publications = publicationsSchema.parse(await sql.query(
    `SELECT publication.id AS publication_id, variant.channel AS platform, publication.platform_object_id, publication.published_at
     FROM ccpun_social.social_publication AS publication JOIN ccpun_social.social_variant_link AS variant ON variant.variant_id=publication.variant_id
     WHERE publication.status='published' AND variant.channel IN ('facebook','instagram','youtube','tiktok') AND publication.platform_object_id IS NOT NULL`,
  ));
  const platforms = provider === "meta" ? new Set(["facebook", "instagram"]) : new Set([provider]);
  const relevant = publications.filter((publication) => platforms.has(publication.platform));
  const {
    discovery, matched, accountId, cursor, providerContents, providerMetricContents,
    metadataRefreshAttempted, metadataRefreshSucceeded, metadataRefreshUnavailableObjectIds, metadataRefreshUnavailableTargets,
  } = await fetchProvider(provider, relevant, env, input.fetcher ?? fetch, since, metaPolicy, metadataRefreshTargets);
  const publishedAt = new Map(relevant.map((publication) => [publication.publication_id, publication.published_at.getTime()]));
  const objectIds = new Map(relevant.map((publication) => [publication.publication_id, publication.platform_object_id]));
  const candidates = matched.snapshots.filter((snapshot) => Date.parse(snapshot.fetchedAt) >= (publishedAt.get(snapshot.publicationId) ?? Number.POSITIVE_INFINITY));
  const latestMetrics = latestMetricsSchema.parse(await sql.query(
    `SELECT DISTINCT ON (publication_id) publication_id,native_metrics FROM ccpun_social.social_metric_snapshot
     WHERE provider=$1 ORDER BY publication_id,fetched_at DESC`,
    [provider],
  ));
  const latestMetricHash = new Map(latestMetrics.map((row) => [row.publication_id, metricsHash(row.native_metrics)]));
  const snapshots = candidates.filter((snapshot) => latestMetricHash.get(snapshot.publicationId) !== metricsHash(snapshot.nativeMetrics));

  await sql.transaction((transaction) => [
    ...providerContents.flatMap((content) => {
      const contentHash = digest([content.text, content.mediaType, content.permalink, transientThumbnailIdentity(content.thumbnailUrl)]);
      return [
        transaction.query(
          `INSERT INTO ccpun_social.social_provider_content
           (id,provider,platform,provider_account_id,provider_object_id,linked_publication_id,published_at,text_content,media_type,permalink_url,thumbnail_url,latest_content_hash,first_seen_at,last_seen_at)
           VALUES ($1,'meta',$2,$3,$4,$5,$6::timestamptz,$7,$8,$9,$10,$11,$12::timestamptz,$12::timestamptz)
           ON CONFLICT (provider,platform,provider_object_id) DO UPDATE SET
             linked_publication_id=COALESCE(EXCLUDED.linked_publication_id,ccpun_social.social_provider_content.linked_publication_id),
             published_at=EXCLUDED.published_at,text_content=EXCLUDED.text_content,media_type=EXCLUDED.media_type,
             permalink_url=EXCLUDED.permalink_url,thumbnail_url=EXCLUDED.thumbnail_url,
             latest_content_hash=EXCLUDED.latest_content_hash,last_seen_at=EXCLUDED.last_seen_at,updated_at=now()`,
          [content.contentId, content.platform, content.providerAccountId, content.providerObjectId, content.linkedPublicationId,
            content.publishedAt, content.text, content.mediaType, content.permalink, content.thumbnailUrl, contentHash, content.fetchedAt],
        ),
        transaction.query(
          `INSERT INTO ccpun_social.social_provider_content_revision
           (id,content_id,content_hash,captured_at,text_content,media_type,permalink_url,thumbnail_url)
           VALUES ($1,$2,$3,$4::timestamptz,$5,$6,$7,$8) ON CONFLICT (content_id,content_hash) DO NOTHING`,
          [`provider-revision:${digest([content.contentId, contentHash])}`, content.contentId, contentHash, content.fetchedAt,
            content.text, content.mediaType, content.permalink, content.thumbnailUrl],
        ),
      ];
    }),
    ...metadataRefreshUnavailableTargets.map((target) => transaction.query(
      `UPDATE ccpun_social.social_provider_content
       SET updated_at=now()
       WHERE provider='meta' AND platform=$1 AND provider_object_id=$2`,
      [target.platform, target.providerObjectId],
    )),
    ...providerMetricContents.map((content) => {
      const nativeMetricsHash = metricsHash(content.nativeMetrics);
      return transaction.query(
        `INSERT INTO ccpun_social.social_provider_metric_snapshot
         (id,content_id,provider,platform,provider_object_id,fetched_at,metrics_hash,native_metrics)
         VALUES ($1,$2,'meta',$3,$4,$5::timestamptz,$6,$7::jsonb) ON CONFLICT (content_id,metrics_hash) DO NOTHING`,
        [`provider-metric:${digest([content.contentId, nativeMetricsHash])}`, content.contentId, content.platform,
          content.providerObjectId, content.fetchedAt, nativeMetricsHash, JSON.stringify(content.nativeMetrics)],
      );
    }),
    ...snapshots.map((snapshot) => transaction.query(
      `INSERT INTO ccpun_social.social_metric_snapshot (id,publication_id,provider,platform,platform_object_id,collection_mode,fetched_at,native_metrics,limitations)
       VALUES ($1,$2,$3,$4,$5,'manual-provider-read',$6::timestamptz,$7::jsonb,$8::jsonb) ON CONFLICT (id) DO NOTHING`,
      [snapshotId(snapshot.publicationId, provider, snapshot.fetchedAt), snapshot.publicationId, provider, snapshot.platform, objectIds.get(snapshot.publicationId), snapshot.fetchedAt, JSON.stringify(snapshot.nativeMetrics), JSON.stringify(snapshot.limitations)],
    )),
    transaction.query(
      `INSERT INTO ccpun_social.social_provider_sync_state
       (provider,provider_account_id,cursor,status,last_attempt_at,last_success_at,last_error_category,backfill_completed_at,last_window_start_at)
       VALUES ($1,$2,$3,'connected',$4::timestamptz,$4::timestamptz,NULL,$5::timestamptz,$6::timestamptz)
       ON CONFLICT (provider,provider_account_id) DO UPDATE SET
       cursor=EXCLUDED.cursor,status='connected',last_attempt_at=EXCLUDED.last_attempt_at,last_success_at=EXCLUDED.last_success_at,
       last_error_category=NULL,backfill_completed_at=COALESCE(ccpun_social.social_provider_sync_state.backfill_completed_at,EXCLUDED.backfill_completed_at),
       last_window_start_at=EXCLUDED.last_window_start_at,updated_at=now()`,
      [provider, accountId, cursor, discovery.fetchedAt, provider === "meta" && since === null ? discovery.fetchedAt : syncState?.backfill_completed_at?.toISOString() ?? null, since],
    ),
    transaction.query(
      `INSERT INTO ccpun_social.social_execution_audit (id,actor_type,actor_ref,action,object_type,object_id,request_ref,outcome)
       VALUES ($1,'human',$2,'analytics:sync','job',$3,$3,'succeeded')`,
      [`audit:${input.requestId}`, safeActorRef(input.actor), input.requestId],
    ),
  ], { isolationLevel: "Serializable" });
  const metricsWindowDays = provider === "meta" && since !== null
    ? Math.max(1, Math.ceil((Date.parse(discovery.fetchedAt) - Date.parse(since)) / (24 * 60 * 60 * 1000)))
    : null;
  return { discovery, persistence: {
    matchedSnapshots: snapshots.length, providerContentsSeen: providerContents.length,
    syncMode: provider === "meta" ? (since === null ? "full-backfill" as const : "incremental-overlap" as const) : "recent-provider-read" as const,
    syncWindowStart: since,
    metricsOverlapDays: provider === "meta" ? metaPolicy.metricsOverlapDays : null,
    metricsWindowDays,
    insightsBackfillLimit: provider === "meta" ? metaPolicy.insightsBackfillLimit : null,
    metadataRefreshDays: provider === "meta" ? metaPolicy.metadataRefreshDays : null,
    metadataRefreshBatchSize: provider === "meta" ? metaPolicy.metadataRefreshBatchSize : null,
    metadataRefreshAttempted,
    metadataRefreshSucceeded,
    metadataRefreshUnavailableObjectIds,
    unmatchedProviderObjectIds: matched.unmatchedProviderObjectIds, cursorStored: cursor !== null,
    providerWriteAllowed: false as const, backgroundSyncAllowed: false as const,
  } };
}

export async function recordSocialAnalyticsFailure(input: {
  provider: z.input<typeof socialAnalyticsProviderSchema>; actor: string; requestId: string;
  category: z.input<typeof providerFailureSchema>; env?: Record<string, string | undefined>;
}) {
  const env = input.env ?? process.env;
  const sql = await verifiedSql(env);
  const provider = socialAnalyticsProviderSchema.parse(input.provider);
  const category = providerFailureSchema.parse(input.category);
  const now = new Date().toISOString();
  await sql.transaction((transaction) => [
    transaction.query(`UPDATE ccpun_social.social_provider_sync_state SET status='error',last_attempt_at=$1::timestamptz,last_error_category=$2,updated_at=now() WHERE provider=$3`, [now, category, provider]),
    transaction.query(
      `INSERT INTO ccpun_social.social_execution_audit (id,actor_type,actor_ref,action,object_type,object_id,request_ref,outcome)
       VALUES ($1,'human',$2,'analytics:sync','job',$3,$3,'failed')`,
      [`audit:${input.requestId}`, safeActorRef(input.actor), input.requestId],
    ),
  ], { isolationLevel: "Serializable" });
}

export async function getSocialAnalyticsDashboard(env: Record<string, string | undefined> = process.env) {
  const sql = await verifiedSql(env);
  const providerRows = providerDashboardRowsSchema.parse(await sql.query(
    `SELECT content.id AS content_id,content.provider,content.platform,content.provider_object_id,
       content.linked_publication_id,content.published_at,content.text_content,content.media_type,
       content.permalink_url,content.thumbnail_url,latest.fetched_at,latest.native_metrics,
       previous.native_metrics AS previous_native_metrics,
       (SELECT count(*) FROM ccpun_social.social_provider_metric_snapshot AS snapshot_count
        WHERE snapshot_count.content_id=content.id) AS snapshot_count
     FROM ccpun_social.social_provider_content AS content
     LEFT JOIN LATERAL (
       SELECT snapshot.fetched_at,snapshot.native_metrics
       FROM ccpun_social.social_provider_metric_snapshot AS snapshot
       WHERE snapshot.content_id=content.id ORDER BY snapshot.fetched_at DESC LIMIT 1
     ) AS latest ON true
     LEFT JOIN LATERAL (
       SELECT snapshot.native_metrics
       FROM ccpun_social.social_provider_metric_snapshot AS snapshot
       WHERE snapshot.content_id=content.id ORDER BY snapshot.fetched_at DESC OFFSET 1 LIMIT 1
     ) AS previous ON true
     ORDER BY content.published_at DESC LIMIT $1`,
    [SOCIAL_ANALYTICS_DASHBOARD_CONTENT_LIMIT],
  ));
  const rows = dashboardRowsSchema.parse(await sql.query(
    `WITH ranked AS (
       SELECT snapshot.publication_id,snapshot.provider,snapshot.platform,snapshot.platform_object_id,
         snapshot.fetched_at,snapshot.native_metrics,snapshot.limitations,publication.published_at,
         variant.format,row_number() OVER (PARTITION BY snapshot.publication_id ORDER BY snapshot.fetched_at DESC) AS snapshot_rank,
         count(*) OVER (PARTITION BY snapshot.publication_id) AS snapshot_count
       FROM ccpun_social.social_metric_snapshot AS snapshot
       LEFT JOIN ccpun_social.social_publication AS publication ON publication.id=snapshot.publication_id
       LEFT JOIN ccpun_social.social_variant_link AS variant ON variant.variant_id=publication.variant_id
     )
     SELECT publication_id,provider,platform,platform_object_id,fetched_at,native_metrics,limitations,format,published_at,snapshot_count
     FROM ranked WHERE snapshot_rank <= 2 ORDER BY fetched_at DESC LIMIT $1`,
    [SOCIAL_ANALYTICS_DASHBOARD_CONTENT_LIMIT * 2],
  ));
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) grouped.set(row.publication_id, [...(grouped.get(row.publication_id) ?? []), row]);
  const providerItems = providerRows.map((content) => {
    const previous = new Map(content.previous_native_metrics?.map((metric) => [metric.key, metric.value]) ?? []);
    return {
      publicationId: content.linked_publication_id ?? content.content_id,
      contentId: content.content_id,
      linkedPublicationId: content.linked_publication_id,
      provider: content.provider,
      platform: content.platform,
      platformObjectId: content.provider_object_id,
      fetchedAt: content.fetched_at?.toISOString() ?? content.published_at.toISOString(),
      snapshotCount: content.snapshot_count,
      format: content.media_type,
      mediaType: content.media_type,
      title: null,
      text: content.text_content.trim() || null,
      permalink: safeProviderUrl(content.permalink_url, content.platform, "permalink"),
      thumbnail: safeProviderUrl(content.thumbnail_url, content.platform, "thumbnail"),
      publishedAt: content.published_at.toISOString(),
      source: "provider-content" as const,
      metrics: (content.native_metrics ?? []).map((metric) => ({
        ...metric,
        delta: previous.has(metric.key) ? metric.value - previous.get(metric.key)! : null,
      })),
      limitation: "Provider-native content history; an unlinked item has no CCPun publication lifecycle yet",
    };
  });
  const providerObjects = new Set(providerItems.map((item) => `${item.provider}:${item.platform}:${item.platformObjectId}`));
  const publicationItems = [...grouped.values()].map((snapshots) => {
    const latest = snapshots[0]!;
    const previous = new Map(snapshots[1]?.native_metrics.map((metric) => [metric.key, metric.value]) ?? []);
    return {
      publicationId: latest.publication_id, provider: latest.provider, platform: latest.platform,
      platformObjectId: latest.platform_object_id, fetchedAt: latest.fetched_at.toISOString(), snapshotCount: latest.snapshot_count,
      contentId: null, linkedPublicationId: latest.publication_id, format: latest.format ?? "unknown", mediaType: null,
      title: null, text: null, permalink: null, thumbnail: null, publishedAt: latest.published_at?.toISOString() ?? null,
      source: "publication-snapshot" as const,
      metrics: latest.native_metrics.map((metric) => ({ ...metric, delta: previous.has(metric.key) ? metric.value - previous.get(metric.key)! : null })),
      limitation: latest.limitations[0],
    };
  });
  return [...providerItems, ...publicationItems.filter((item) => !providerObjects.has(`${item.provider}:${item.platform}:${item.platformObjectId}`))]
    .sort((a, b) => Date.parse(b.publishedAt ?? b.fetchedAt) - Date.parse(a.publishedAt ?? a.fetchedAt));
}
