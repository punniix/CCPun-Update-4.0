import "server-only";

import { createClient, defineQuery } from "next-sanity";
import { z } from "zod";

import {
  isAdminDataPlaneAllowed,
  isAdminReadDataPlaneAllowed,
} from "../environment";
import {
  getAdminSanityReadToken,
  getAdminSanityWriteToken,
} from "../sanity-credentials";
import {
  LINE_DISCOVERY_CONFIG,
  type LineDiscoverySelection,
} from "../../line/content-cards";
import type { LineJourneyId } from "../../line/ecosystem";

export const LINE_DISCOVERY_CONFIG_ID = "ccpun-line-discovery-v1";

export const LINE_DISCOVERY_JOURNEYS = [
  "life_health_policy_review",
  "motor_quote_review",
  "investment_before_you_act",
] as const satisfies readonly LineJourneyId[];

type DiscoveryJourney = (typeof LINE_DISCOVERY_JOURNEYS)[number];

const FIELD_BY_JOURNEY: Record<DiscoveryJourney, "lifeHealth" | "motor" | "investment"> = {
  life_health_policy_review: "lifeHealth",
  motor_quote_review: "motor",
  investment_before_you_act: "investment",
};

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();

const baseClient = projectId && dataset
  ? createClient({
      projectId,
      dataset,
      apiVersion: "2026-09-19",
      useCdn: false,
      stega: { enabled: false, studioUrl: "/studio" },
    })
  : null;

const storedItemSchema = z.object({
  slug: z.string().min(1).max(96).nullable(),
  enabled: z.boolean().default(true),
}).passthrough();

const storedJourneySchema = z.object({
  maxCards: z.coerce.number().int().min(1).max(5),
  items: z.array(storedItemSchema).max(20),
}).passthrough();

const storedConfigSchema = z.object({
  _rev: z.string().min(1),
  lifeHealth: storedJourneySchema.optional(),
  motor: storedJourneySchema.optional(),
  investment: storedJourneySchema.optional(),
}).passthrough();

const mutationItemSchema = z.object({
  slug: z.string().min(1).max(96),
  enabled: z.boolean(),
}).strict();

const mutationJourneySchema = z.object({
  maxCards: z.number().int().min(1).max(5),
  items: z.array(mutationItemSchema).min(1).max(20),
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (const [index, item] of value.items.entries()) {
    if (seen.has(item.slug)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "slug"],
        message: "duplicate article",
      });
    }
    seen.add(item.slug);
  }
  if (!value.items.some((item) => item.enabled)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["items"],
      message: "at least one article must remain active",
    });
  }
});

export const lineDiscoveryMutationSchema = z.object({
  revision: z.string().min(1).nullable(),
  journeys: z.object({
    life_health_policy_review: mutationJourneySchema,
    motor_quote_review: mutationJourneySchema,
    investment_before_you_act: mutationJourneySchema,
  }).strict(),
}).strict();

export type LineDiscoveryMutation = z.infer<typeof lineDiscoveryMutationSchema>;

export type LineDiscoveryArticleOption = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  featuredImage: string | null;
};

export type LineDiscoveryAdminModel = {
  revision: string | null;
  source: "stored" | "default";
  writeReady: boolean;
  journeys: Record<DiscoveryJourney, LineDiscoverySelection>;
  articles: LineDiscoveryArticleOption[];
};

const configQuery = defineQuery(
  '*[_id == $id][0]{_rev,lifeHealth{maxCards,items[]{enabled,"slug":article->slug.current}},motor{maxCards,items[]{enabled,"slug":article->slug.current}},investment{maxCards,items[]{enabled,"slug":article->slug.current}}}',
);

const publishedArticlesQuery = defineQuery(
  '*[_type == "article" && defined(slug.current) && coalesce(seo.noindex, false) != true] | order(coalesce(publishedAt, _updatedAt) desc) {_id,"slug": slug.current,title,excerpt,"category": category->title,"featuredImage": select(defined(featuredImage.asset) => featuredImage.asset->url,defined(migratedFeaturedImage.src) => migratedFeaturedImage.src)}',
);

const articleOptionSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string().min(1),
  category: z.string().min(1),
  featuredImage: z.string().url().nullable(),
});

function defaultJourney(journey: DiscoveryJourney): LineDiscoverySelection {
  const config = LINE_DISCOVERY_CONFIG[journey];
  return {
    maxCards: config.maxCards,
    items: config.articleSlugs.map((slug) => ({ slug, enabled: true })),
  };
}

export function defaultLineDiscoveryCuration(): Record<DiscoveryJourney, LineDiscoverySelection> {
  return {
    life_health_policy_review: defaultJourney("life_health_policy_review"),
    motor_quote_review: defaultJourney("motor_quote_review"),
    investment_before_you_act: defaultJourney("investment_before_you_act"),
  };
}

function readClient() {
  const token = getAdminSanityReadToken();
  if (!baseClient || !dataset || !token || !isAdminReadDataPlaneAllowed(dataset)) return null;
  return baseClient.withConfig({ token, perspective: "published", useCdn: false });
}

function writeClient() {
  const token = getAdminSanityWriteToken();
  if (!baseClient || !dataset || !token || !isAdminDataPlaneAllowed(dataset)) return null;
  return baseClient.withConfig({ token, perspective: "published", useCdn: false });
}

function selectionFromStored(
  journey: DiscoveryJourney,
  stored: z.infer<typeof storedConfigSchema> | null,
): LineDiscoverySelection {
  const field = FIELD_BY_JOURNEY[journey];
  const value = stored?.[field];
  if (!value?.items?.length) return defaultJourney(journey);
  return {
    maxCards: value.maxCards,
    items: value.items
      .filter((item): item is typeof item & { slug: string } => typeof item.slug === "string" && item.slug.length > 0)
      .map((item) => ({ slug: item.slug, enabled: item.enabled })),
  };
}

export async function readLineDiscoveryCuration(): Promise<{
  revision: string | null;
  source: "stored" | "default";
  journeys: Record<DiscoveryJourney, LineDiscoverySelection>;
}> {
  const client = readClient();
  if (!client) {
    return { revision: null, source: "default", journeys: defaultLineDiscoveryCuration() };
  }

  try {
    const raw = await client.fetch(configQuery, { id: LINE_DISCOVERY_CONFIG_ID });
    if (!raw) {
      return { revision: null, source: "default", journeys: defaultLineDiscoveryCuration() };
    }
    const stored = storedConfigSchema.parse(raw);
    return {
      revision: stored._rev,
      source: "stored",
      journeys: {
        life_health_policy_review: selectionFromStored("life_health_policy_review", stored),
        motor_quote_review: selectionFromStored("motor_quote_review", stored),
        investment_before_you_act: selectionFromStored("investment_before_you_act", stored),
      },
    };
  } catch {
    return { revision: null, source: "default", journeys: defaultLineDiscoveryCuration() };
  }
}

export async function listPublishedLineDiscoveryArticles(): Promise<LineDiscoveryArticleOption[]> {
  const client = readClient();
  if (!client) return [];
  try {
    return z.array(articleOptionSchema).parse(await client.fetch(publishedArticlesQuery));
  } catch {
    return [];
  }
}

export async function readLineDiscoveryAdminModel(): Promise<LineDiscoveryAdminModel> {
  const [curation, articles] = await Promise.all([
    readLineDiscoveryCuration(),
    listPublishedLineDiscoveryArticles(),
  ]);
  return {
    ...curation,
    writeReady: Boolean(writeClient()),
    articles,
  };
}

function sanityItems(
  items: LineDiscoveryMutation["journeys"][DiscoveryJourney]["items"],
  articleIdBySlug: Map<string, string>,
) {
  return items.map((item, index) => ({
    _key: String(index + 1).padStart(2, "0") + "-" + item.slug.replace(/[^a-z0-9_-]/gi, "_").slice(0, 72),
    article: {
      _type: "reference",
      _ref: articleIdBySlug.get(item.slug)!,
      _weak: true,
    },
    enabled: item.enabled,
  }));
}

function toSanityFields(
  input: LineDiscoveryMutation,
  actor: string,
  articleIdBySlug: Map<string, string>,
) {
  return {
    version: 1,
    lifeHealth: {
      maxCards: input.journeys.life_health_policy_review.maxCards,
      items: sanityItems(input.journeys.life_health_policy_review.items, articleIdBySlug),
    },
    motor: {
      maxCards: input.journeys.motor_quote_review.maxCards,
      items: sanityItems(input.journeys.motor_quote_review.items, articleIdBySlug),
    },
    investment: {
      maxCards: input.journeys.investment_before_you_act.maxCards,
      items: sanityItems(input.journeys.investment_before_you_act.items, articleIdBySlug),
    },
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };
}

export async function saveLineDiscoveryCuration(input: unknown, actor: string) {
  const parsed = lineDiscoveryMutationSchema.safeParse(input);
  if (!parsed.success) throw new Error("LINE_DISCOVERY_INVALID");

  const client = writeClient();
  if (!client) throw new Error("LINE_DISCOVERY_WRITE_UNAVAILABLE");

  const published = await listPublishedLineDiscoveryArticles();
  const articleIdBySlug = new Map(published.map((article) => [article.slug, article.id] as const));
  for (const journey of LINE_DISCOVERY_JOURNEYS) {
    for (const item of parsed.data.journeys[journey].items) {
      if (!articleIdBySlug.has(item.slug)) throw new Error("LINE_DISCOVERY_ARTICLE_NOT_PUBLISHED");
    }
  }

  const current = await client.fetch<{ _rev?: string } | null>(
    defineQuery('*[_id == $id][0]{_rev}'),
    { id: LINE_DISCOVERY_CONFIG_ID },
  );
  const fields = toSanityFields(parsed.data, actor, articleIdBySlug);

  try {
    if (!current?._rev) {
      if (parsed.data.revision !== null) throw new Error("LINE_DISCOVERY_STALE");
      const created = await client.create({
        _id: LINE_DISCOVERY_CONFIG_ID,
        _type: "lineDiscoveryConfig",
        ...fields,
      });
      return { revision: created._rev };
    }

    if (parsed.data.revision !== current._rev) throw new Error("LINE_DISCOVERY_STALE");

    const updated = await client
      .patch(LINE_DISCOVERY_CONFIG_ID)
      .ifRevisionId(current._rev)
      .set(fields)
      .commit();

    return { revision: updated._rev };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("LINE_DISCOVERY_")) throw error;
    const statusCode = typeof error === "object" && error && "statusCode" in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : null;
    if (statusCode === 409) throw new Error("LINE_DISCOVERY_STALE");
    throw new Error("LINE_DISCOVERY_SAVE_UNAVAILABLE");
  }
}
