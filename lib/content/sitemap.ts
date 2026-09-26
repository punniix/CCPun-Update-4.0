import "server-only";

import { createClient, groq } from "next-sanity";
import { z } from "zod";
import { getSanityReadToken } from "@/lib/content/sanity-credentials";
import { isContentSanityLaneAllowed } from "@/lib/content/sanity-lane";
import { resolveContentLastmod } from "@/lib/sitemap/google";
import { resolveDeploymentIdentity } from "@/lib/runtime/deployment-identity";
import type { Article } from "./types";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
const token = getSanityReadToken();
const hasSanityConfig = Boolean(projectId && dataset && isContentSanityLaneAllowed(projectId, dataset));
const deploymentIdentity = resolveDeploymentIdentity(process.env, "web");
const isDeployedProduction =
  deploymentIdentity.valid &&
  deploymentIdentity.role === "web" &&
  deploymentIdentity.environment === "production";

const client = hasSanityConfig
  ? createClient({
      projectId: projectId!,
      dataset: dataset!,
      apiVersion: "2026-08-18",
      useCdn: false,
      stega: { enabled: false, studioUrl: "/studio" },
    })
  : null;

const rawSitemapArticleSchema = z.object({
  _id: z.string().min(1),
  slug: z.string().min(1),
  category: z.string().min(1),
  categorySlug: z.string().min(1).nullish(),
  tags: z.array(z.string()).nullish(),
  semanticTopic: z.string().min(1).nullish(),
  canonical: z.string().nullish(),
  noindex: z.boolean().nullish(),
  publishedAt: z.string().min(1),
  contentUpdatedAt: z.string().nullish(),
  sourceModifiedAt: z.string().nullish(),
  systemUpdatedAt: z.string().min(1),
});

type RawSitemapArticle = z.infer<typeof rawSitemapArticleSchema>;

export type SitemapArticle = Pick<
  Article,
  | "id"
  | "slug"
  | "category"
  | "categorySlug"
  | "tags"
  | "semanticTopic"
  | "canonical"
  | "noindex"
> & {
  status: "published";
  publishedAt: string;
  updatedAt: string;
};

const sitemapArticleQuery = groq`*[
  _type == "article" &&
  defined(slug.current) &&
  defined(publishedAt) &&
  dateTime(publishedAt) <= dateTime(now()) &&
  review.status == "approved" &&
  coalesce(seo.noindex, false) == false
] | order(publishedAt desc) {
  _id,
  "slug": slug.current,
  "category": category->title,
  "categorySlug": category->slug.current,
  tags,
  "semanticTopic": seo.semanticTopic,
  "canonical": seo.canonical,
  "noindex": coalesce(seo.noindex, false),
  publishedAt,
  contentUpdatedAt,
  "sourceModifiedAt": migration.sourceModifiedAt,
  "systemUpdatedAt": _updatedAt
}`;

function toSitemapArticle(rawInput: unknown): SitemapArticle | null {
  const parsed = rawSitemapArticleSchema.safeParse(rawInput);
  if (!parsed.success) {
    const id = rawInput && typeof rawInput === "object" && "_id" in rawInput ? String(rawInput._id) : "unknown";
    console.error("SITEMAP_ARTICLE_SKIPPED_INVALID", {
      id,
      issues: parsed.error.issues.map((issue) => issue.path.map(String).join(".")),
    });
    return null;
  }

  const raw: RawSitemapArticle = parsed.data;
  const updatedAt = resolveContentLastmod(raw);
  if (!updatedAt) {
    console.error("SITEMAP_ARTICLE_SKIPPED_LASTMOD", { id: raw._id });
    return null;
  }

  return {
    id: raw._id,
    slug: raw.slug,
    category: raw.category,
    categorySlug: raw.categorySlug ?? undefined,
    tags: raw.tags ?? undefined,
    semanticTopic: raw.semanticTopic ?? undefined,
    canonical: raw.canonical ?? undefined,
    noindex: raw.noindex ?? false,
    publishedAt: raw.publishedAt,
    updatedAt,
    status: "published",
  };
}

function fromLocalArticle(article: Article): SitemapArticle | null {
  if (article.status !== "published" || article.noindex === true || !article.publishedAt) return null;
  const publishedAt = Date.parse(article.publishedAt);
  if (!Number.isFinite(publishedAt) || publishedAt > Date.now()) return null;
  const updatedAt = resolveContentLastmod({ contentUpdatedAt: article.updatedAt });
  if (!updatedAt) return null;
  return { ...article, publishedAt: article.publishedAt, updatedAt, status: "published" };
}

export async function listSitemapArticles(
  options: { includeDrafts: false } = { includeDrafts: false },
): Promise<SitemapArticle[]> {
  if (!client) {
    if (isDeployedProduction) throw new Error("Production sitemap requires an approved Sanity data lane");
    const { getContentProvider } = await import("./provider");
    const localArticles = await getContentProvider().listArticles(options);
    return localArticles.flatMap((article) => {
      const mapped = fromLocalArticle(article);
      return mapped ? [mapped] : [];
    });
  }

  const rows = z.array(z.unknown()).parse(
    await client
      .withConfig({
        perspective: "published",
        token: token || undefined,
        useCdn: false,
        stega: { enabled: false, studioUrl: "/studio" },
      })
      .fetch(sitemapArticleQuery),
  );
  return rows.flatMap((row: unknown) => {
    const mapped = toSitemapArticle(row);
    return mapped ? [mapped] : [];
  });
}
