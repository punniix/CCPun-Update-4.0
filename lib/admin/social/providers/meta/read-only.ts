import { z } from "zod";
import { normalizeMetaAnalytics } from "../../provider-adapters";
import { getSocialProviderReadiness } from "../../provider-readonly";
import { META_MINIMUM_READ_SCOPES, normalizeMetaConnection } from "./connection";
import { fetchMetaInsights, mapWithConcurrency, numberInsight, reactionBreakdownInsight } from "./insights-read";

if (typeof window !== "undefined") throw new Error("META_READ_SERVER_ONLY");

const optionalUrl = (max: number) => z.string().url().max(max).nullable().optional().transform((value) => value ?? undefined);
const optionalText = (max: number) => z.string().max(max).nullable().optional().transform((value) => value ?? undefined);
const optionalCount = z.number().int().nonnegative().safe().nullable().optional().transform((value) => value ?? undefined);
const optionalSummary = z.object({ summary: z.object({ total_count: z.number().int().nonnegative().safe() }) })
  .nullable().optional().transform((value) => value ?? undefined);
const optionalShares = z.object({ count: z.number().int().nonnegative().safe() })
  .nullable().optional().transform((value) => value ?? undefined);

const pagingSchema = z.object({
  next: z.string().url().max(4000).nullable().optional().transform((value) => value ?? undefined),
  cursors: z.object({ after: z.string().trim().min(1).max(1000).nullable().optional().transform((value) => value ?? undefined) })
    .nullable().optional().transform((value) => value ?? undefined),
}).nullable().optional().transform((value) => value ?? undefined);
const responseSchema = z.object({
  data: z.array(z.object({
    id: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(120),
    access_token: z.string().trim().min(1).max(4096).nullable().optional().transform((value) => value ?? undefined),
    instagram_business_account: z.object({
      id: z.string().trim().min(1).max(120),
      username: z.string().trim().min(1).max(120),
    }).nullable().optional(),
  })).max(100),
  paging: pagingSchema,
});
const metaDateTimeSchema = z.string()
  .transform((value) => value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"))
  .pipe(z.string().datetime({ offset: true }));
const facebookPostSchema = z.object({
  id: z.string().trim().min(1).max(200),
  message: optionalText(5000).transform((value) => value ?? ""),
  status_type: z.string().trim().min(1).max(80).nullable().optional().transform((value) => value ?? undefined),
  created_time: metaDateTimeSchema,
  permalink_url: optionalUrl(1000),
  full_picture: optionalUrl(2000),
  shares: optionalShares,
  comments: optionalSummary,
  reactions: optionalSummary,
});
const instagramMediaItemSchema = z.object({
  id: z.string().trim().min(1).max(200),
  caption: optionalText(5000).transform((value) => value ?? ""),
  media_type: z.string().trim().min(1).max(40),
  media_product_type: z.string().trim().min(1).max(40).nullable().optional().transform((value) => value ?? undefined),
  timestamp: metaDateTimeSchema,
  permalink: optionalUrl(1000),
  thumbnail_url: optionalUrl(2000),
  media_url: optionalUrl(2000),
  like_count: optionalCount,
  comments_count: optionalCount,
});
const facebookPostsSchema = z.object({ data: z.array(facebookPostSchema).max(100), paging: pagingSchema });
const instagramMediaSchema = z.object({ data: z.array(instagramMediaItemSchema).max(100), paging: pagingSchema });
const metaContentTargetSchema = z.object({
  platform: z.enum(["facebook", "instagram"]),
  providerObjectId: z.string().trim().min(1).max(200),
});
const metaObjectBatchResponseSchema = z.record(z.string(), z.unknown());
const META_METADATA_IDS_PER_REQUEST = 25;
const FACEBOOK_CONTENT_FIELDS = "id,message,status_type,created_time,permalink_url,full_picture,shares,comments.limit(0).summary(true),reactions.limit(0).summary(true)";
const INSTAGRAM_CONTENT_FIELDS = "id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type Publication = { publicationId: string; platform: string; platformObjectId: string | null };
type MetaInsightMetricFields = {
  views?: number; reach?: number; clicks?: number; saves?: number; shares?: number; totalInteractions?: number;
  reelTotalWatchTimeMs?: number; reelAverageWatchTimeMs?: number;
  reactionLike?: number; reactionLove?: number; reactionCare?: number; reactionWow?: number;
  reactionHaha?: number; reactionSad?: number; reactionAngry?: number;
};

function logInvalidResponse(stage: string, error: z.ZodError) {
  console.error("[meta-read-invalid-response]", {
    stage,
    issues: error.issues.slice(0, 5).map((issue) => ({
      code: issue.code,
      path: issue.path.map(String).join("."),
    })),
  });
}

async function request(url: string, token: string, fetcher: FetchLike) {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new Error("META_READ_TIMEOUT");
    throw new Error("META_READ_UNAVAILABLE");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { type?: unknown; code?: unknown; error_subcode?: unknown } } | null;
    const endpoint = new URL(url).pathname;
    console.error("[meta-read]", {
      endpoint,
      status: response.status,
      graphType: typeof body?.error?.type === "string" ? body.error.type : undefined,
      graphCode: typeof body?.error?.code === "number" ? body.error.code : undefined,
      graphSubcode: typeof body?.error?.error_subcode === "number" ? body.error.error_subcode : undefined,
    });
  }
  if (response.status === 401 || response.status === 403) throw new Error("META_READ_AUTH_REQUIRED");
  if (response.status === 429) throw new Error("META_READ_RATE_LIMITED");
  if (!response.ok) throw new Error("META_READ_UNAVAILABLE");
  return response.json().catch(() => null) as Promise<unknown>;
}

async function readAllPages<T>(
  baseUrl: string,
  token: string,
  schema: z.ZodType<{ data: T[]; paging?: { next?: string; cursors?: { after?: string } } }>,
  fetcher: FetchLike,
  stopAfterPage?: (items: T[]) => boolean,
  stage = "provider-page",
) {
  const items: T[] = [];
  let url = baseUrl;
  for (let page = 0; page < 100; page += 1) {
    const parsed = schema.safeParse(await request(url, token, fetcher));
    if (!parsed.success) {
      logInvalidResponse(`${stage}:${page + 1}`, parsed.error);
      throw new Error("META_READ_INVALID_RESPONSE");
    }
    items.push(...parsed.data.data);
    if (stopAfterPage?.(parsed.data.data)) return items;
    if (!parsed.data.paging?.next) return items;
    const after = parsed.data.paging.cursors?.after;
    if (!after) throw new Error("META_READ_INVALID_RESPONSE");
    const next = new URL(baseUrl);
    next.searchParams.set("after", after);
    url = next.toString();
  }
  // ponytail: 10k items is the safety ceiling; move full imports to a resumable job if CCPun ever exceeds it.
  throw new Error("META_READ_PAGINATION_LIMIT");
}

async function resolveMetaReadContext(env: Record<string, string | undefined>, fetcher: FetchLike) {
  if (getSocialProviderReadiness("meta", env).status !== "manual-sync-ready") {
    throw new Error("META_READ_NOT_CONFIGURED");
  }
  const token = env.CCPUN_META_ACCESS_TOKEN!.trim();
  const version = env.CCPUN_META_GRAPH_VERSION!.trim();
  const fields = "id,name,access_token,instagram_business_account{id,username}";
  const parsedPages = responseSchema.safeParse(await request(
    `https://graph.facebook.com/${version}/me/accounts?fields=${encodeURIComponent(fields)}&limit=20`, token, fetcher,
  ));
  if (!parsedPages.success) {
    logInvalidResponse("accounts", parsedPages.error);
    throw new Error("META_READ_INVALID_RESPONSE");
  }
  const pages = parsedPages.data.data;
  const selectedPageId = env.CCPUN_META_PAGE_ID?.trim() || (pages.length === 1 ? pages[0]!.id : null);
  const selectedPage = pages.find((page) => page.id === selectedPageId);
  return {
    version,
    pages,
    selectedPageId,
    selectedPage,
    selectedPageToken: selectedPage?.access_token ?? token,
  };
}

function normalizedFacebookPost(post: z.infer<typeof facebookPostSchema>, insightMetrics: MetaInsightMetricFields = {}) {
  return {
    id: post.id,
    text: post.message,
    mediaType: post.status_type ?? "post",
    publishedAt: post.created_time,
    permalink: post.permalink_url ?? null,
    thumbnailUrl: post.full_picture ?? null,
    metrics: {
      likes: post.reactions?.summary.total_count,
      comments: post.comments?.summary.total_count,
      shares: post.shares?.count,
      ...insightMetrics,
    },
  };
}

function normalizedInstagramMedia(media: z.infer<typeof instagramMediaItemSchema>, insightMetrics: MetaInsightMetricFields = {}) {
  return {
    id: media.id,
    text: media.caption,
    mediaType: media.media_type,
    publishedAt: media.timestamp,
    permalink: media.permalink ?? null,
    thumbnailUrl: media.thumbnail_url ?? media.media_url ?? null,
    metrics: {
      likes: media.like_count,
      comments: media.comments_count,
      ...insightMetrics,
    },
  };
}

export async function fetchMetaReadOnlyDiscovery(
  env: Record<string, string | undefined> = process.env,
  fetcher: FetchLike = fetch,
  options: { since?: string | null; includeInsights?: boolean; insightsBackfillLimit?: number } = {},
) {
  const { version, pages, selectedPageId, selectedPage, selectedPageToken } = await resolveMetaReadContext(env, fetcher);
  const since = options.since === undefined || options.since === null ? null : z.string().datetime().parse(options.since);
  const withSince = (value: string) => {
    if (!since) return value;
    const url = new URL(value);
    url.searchParams.set("since", String(Math.floor(Date.parse(since) / 1000)));
    return url.toString();
  };
  const [facebookPosts, instagramMedia] = selectedPage ? await Promise.all([
    readAllPages(withSince(`https://graph.facebook.com/${version}/${encodeURIComponent(selectedPage.id)}/published_posts?fields=${encodeURIComponent(FACEBOOK_CONTENT_FIELDS)}&limit=100`), selectedPageToken, facebookPostsSchema, fetcher, undefined, "facebook-posts"),
    selectedPage.instagram_business_account
      // ponytail: IG media has cursor-only pagination; stop after the first page wholly older than the overlap window.
      ? readAllPages(
        `https://graph.facebook.com/${version}/${encodeURIComponent(selectedPage.instagram_business_account.id)}/media?fields=${encodeURIComponent(INSTAGRAM_CONTENT_FIELDS)}&limit=100`,
        selectedPageToken,
        instagramMediaSchema,
        fetcher,
        since ? (items) => items.length > 0 && items.every((item) => Date.parse(item.timestamp) < Date.parse(since)) : undefined,
        "instagram-media",
      )
      : Promise.resolve([]),
  ]) : [[], []];
  const includeInsights = options.includeInsights === true;
  const insightLimit = Math.max(1, Math.min(options.insightsBackfillLimit ?? 25, 50));
  let latestFacebookForInsights = facebookPosts.slice(0, insightLimit);
  if (includeInsights && since && selectedPage) {
    latestFacebookForInsights = await readAllPages(
      `https://graph.facebook.com/${version}/${encodeURIComponent(selectedPage.id)}/published_posts?fields=${encodeURIComponent(FACEBOOK_CONTENT_FIELDS)}&limit=${insightLimit}`,
      selectedPageToken, facebookPostsSchema, fetcher, () => true, "facebook-insights-backfill",
    );
  }
  const latestInstagramForInsights = instagramMedia.slice(0, insightLimit);

  const facebookInsightMap = new Map<string, MetaInsightMetricFields>();
  const instagramInsightMap = new Map<string, MetaInsightMetricFields>();
  if (includeInsights && selectedPage) {
    const facebookEnriched = await mapWithConcurrency(latestFacebookForInsights, 5, async (post) => {
      const values = await fetchMetaInsights({
        version, objectId: post.id, token: selectedPageToken,
        metrics: ["post_media_view", "post_clicks", "post_reactions_by_type_total"],
      }, fetcher);
      const reactions = reactionBreakdownInsight(values, "post_reactions_by_type_total");
      return [post.id, {
        views: numberInsight(values, "post_media_view"),
        clicks: numberInsight(values, "post_clicks"),
        reactionLike: reactions.like, reactionLove: reactions.love, reactionCare: reactions.care, reactionWow: reactions.wow,
        reactionHaha: reactions.haha, reactionSad: reactions.sad, reactionAngry: reactions.angry,
      }] as const;
    });
    for (const [id, metrics] of facebookEnriched) facebookInsightMap.set(id, metrics);

    if (selectedPage.instagram_business_account) {
      const instagramEnriched = await mapWithConcurrency(latestInstagramForInsights, 5, async (media) => {
        const metrics = ["views", "reach", "saved", "shares", "total_interactions"];
        if (media.media_type === "VIDEO") metrics.push("ig_reels_video_view_total_time", "ig_reels_avg_watch_time");
        const values = await fetchMetaInsights({ version, objectId: media.id, token: selectedPageToken, metrics }, fetcher);
        return [media.id, {
          views: numberInsight(values, "views"), reach: numberInsight(values, "reach"), saves: numberInsight(values, "saved"),
          shares: numberInsight(values, "shares"), totalInteractions: numberInsight(values, "total_interactions"),
          reelTotalWatchTimeMs: numberInsight(values, "ig_reels_video_view_total_time"),
          reelAverageWatchTimeMs: numberInsight(values, "ig_reels_avg_watch_time"),
        }] as const;
      });
      for (const [id, metrics] of instagramEnriched) instagramInsightMap.set(id, metrics);
    }
  }

  const mergeById = <T extends { id: string }>(primary: T[], extra: T[]) => {
    const seen = new Set(primary.map((item) => item.id));
    return [...primary, ...extra.filter((item) => !seen.has(item.id))];
  };
  const facebookReturned = includeInsights ? mergeById(facebookPosts, latestFacebookForInsights) : facebookPosts;
  const instagramWindow = instagramMedia.filter((media) => !since || Date.parse(media.timestamp) >= Date.parse(since));
  const instagramReturned = includeInsights ? mergeById(instagramWindow, latestInstagramForInsights) : instagramWindow;

  const connection = normalizeMetaConnection({
    mode: "provider-read-only",
    authorizationState: "active",
    grantedScopes: [...META_MINIMUM_READ_SCOPES],
    selectedPageId,
    pages: pages.map((page) => ({
      id: page.id,
      name: page.name,
      instagramAccount: page.instagram_business_account
        ? { id: page.instagram_business_account.id, username: page.instagram_business_account.username }
        : null,
    })),
  });
  return {
    ...connection,
    fetchedAt: new Date().toISOString(),
    syncWindowStart: since,
    selectedInstagramAccountId: selectedPage?.instagram_business_account?.id ?? null,
    insightsCollected: includeInsights,
    insightBackfillLimit: includeInsights ? insightLimit : 0,
    facebookPosts: facebookReturned.map((post) => normalizedFacebookPost(post, facebookInsightMap.get(post.id))),
    instagramMedia: instagramReturned.map((media) => normalizedInstagramMedia(media, instagramInsightMap.get(media.id))),
  };
}

export async function fetchMetaContentMetadataByIds(
  env: Record<string, string | undefined>,
  targetsInput: Array<z.input<typeof metaContentTargetSchema>>,
  fetcher: FetchLike = fetch,
) {
  const parsedTargets = z.array(metaContentTargetSchema).max(100).parse(targetsInput);
  const targets = [...new Map(parsedTargets.map((target) => [`${target.platform}:${target.providerObjectId}`, target])).values()];
  const { version, selectedPageId, selectedPage, selectedPageToken } = await resolveMetaReadContext(env, fetcher);
  if (!selectedPageId || !selectedPage) throw new Error("META_PAGE_SELECTION_REQUIRED");
  if (targets.length === 0) {
    return { fetchedAt: new Date().toISOString(), selectedPageId, selectedInstagramAccountId: selectedPage.instagram_business_account?.id ?? null, items: [], unavailableObjectIds: [], unavailableTargets: [] };
  }

  const batches = (["facebook", "instagram"] as const).flatMap((platform) => {
    const platformTargets = targets.filter((target) => target.platform === platform);
    const result: Array<{ platform: typeof platform; targets: typeof platformTargets }> = [];
    for (let index = 0; index < platformTargets.length; index += META_METADATA_IDS_PER_REQUEST) {
      result.push({ platform, targets: platformTargets.slice(index, index + META_METADATA_IDS_PER_REQUEST) });
    }
    return result;
  });

  const batchResults = await mapWithConcurrency(batches, 2, async (batch) => {
    const url = new URL(`https://graph.facebook.com/${version}/`);
    url.searchParams.set("ids", batch.targets.map((target) => target.providerObjectId).join(","));
    url.searchParams.set("fields", batch.platform === "facebook" ? FACEBOOK_CONTENT_FIELDS : INSTAGRAM_CONTENT_FIELDS);
    const raw = await request(url.toString(), selectedPageToken, fetcher);
    const parsed = metaObjectBatchResponseSchema.safeParse(raw);
    if (!parsed.success) {
      logInvalidResponse(`metadata-refresh:${batch.platform}`, parsed.error);
      throw new Error("META_READ_INVALID_RESPONSE");
    }
    const itemSchema = batch.platform === "facebook" ? facebookPostSchema : instagramMediaItemSchema;
    return batch.targets.map((target) => {
      const payload = parsed.data[target.providerObjectId];
      const item = itemSchema.safeParse(payload);
      if (!item.success) return { target, item: null };
      return {
        target,
        item: batch.platform === "facebook"
          ? { ...normalizedFacebookPost(item.data as z.infer<typeof facebookPostSchema>), platform: "facebook" as const }
          : { ...normalizedInstagramMedia(item.data as z.infer<typeof instagramMediaItemSchema>), platform: "instagram" as const },
      };
    });
  });
  const results = batchResults.flat();
  const fetchedAt = new Date().toISOString();
  return {
    fetchedAt,
    selectedPageId,
    selectedInstagramAccountId: selectedPage.instagram_business_account?.id ?? null,
    items: results.flatMap((result) => result.item ? [result.item] : []),
    unavailableObjectIds: results.filter((result) => !result.item).map((result) => result.target.providerObjectId),
    unavailableTargets: results.filter((result) => !result.item).map((result) => result.target),
  };
}

export function matchMetaHistoricalAnalytics(
  publications: Publication[],
  discovery: Awaited<ReturnType<typeof fetchMetaReadOnlyDiscovery>>,
) {
  const publishedByObjectId = new Map(publications.filter((item) => ["facebook", "instagram"].includes(item.platform) && item.platformObjectId)
    .map((item) => [item.platformObjectId!, item]));
  const providerItems = [
    ...discovery.facebookPosts.map((item) => ({ ...item, platform: "facebook" as const })),
    ...discovery.instagramMedia.map((item) => ({ ...item, platform: "instagram" as const })),
  ];
  const snapshots = providerItems.flatMap((item) => {
    const publication = publishedByObjectId.get(item.id);
    return publication?.platform === item.platform ? [normalizeMetaAnalytics({
      publicationId: publication.publicationId,
      platform: item.platform,
      fetchedAt: discovery.fetchedAt,
      metrics: item.metrics,
    })] : [];
  });
  return {
    snapshots,
    unmatchedProviderObjectIds: providerItems.filter((item) => !publishedByObjectId.has(item.id)).map((item) => item.id),
    persisted: false as const,
  };
}
