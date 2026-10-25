import "server-only";

import { createClient, groq } from "next-sanity";
import { z } from "zod";
import { getArticleCanonical } from "../../content/url";
import { isAdminReadDataPlaneAllowed } from "../environment";
import { getAdminSanityReadToken } from "../sanity-credentials";
import { assembleMonthArticles, bangkokMonthWindow, type PublishedArticleCandidate } from "./email-digest-model";

/**
 * Read-only article source for the monthly digest: published articles of the
 * lane's own dataset (UAT in UAT). Canonical URLs come from lib/content/url.ts;
 * this module never decides URL ownership and never writes to Sanity.
 */
const rowSchema = z.object({
  id: z.string().min(1),
  title: z.string().nullish(),
  slug: z.string().min(1),
  category: z.string().nullish(),
  categorySlug: z.string().nullish(),
  canonical: z.string().nullish(),
  noindex: z.boolean().nullish(),
  publishedAt: z.string().min(1),
});

const monthArticlesQuery = groq`*[_type == "article" && !(_id in path("drafts.**")) && defined(slug.current)
  && defined(publishedAt) && dateTime(publishedAt) >= dateTime($start) && dateTime(publishedAt) < dateTime($end)]
  | order(publishedAt asc)[0...60]{
    "id": _id, title, "slug": slug.current, "category": category->title, "categorySlug": category->slug.current,
    "canonical": seo.canonical, "noindex": seo.noindex, publishedAt
  }`;

export type MonthArticlesResult =
  | { state: "ok"; articles: ReturnType<typeof assembleMonthArticles> }
  | { state: "not-configured" | "request-failed" };

export async function listMonthArticlesForDigest(month: string): Promise<MonthArticlesResult> {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
  const token = getAdminSanityReadToken();
  if (!projectId || !dataset || !token || !isAdminReadDataPlaneAllowed(dataset)) return { state: "not-configured" };
  const { startUtc, endUtc } = bangkokMonthWindow(month);
  try {
    const client = createClient({ projectId, dataset, apiVersion: "2026-08-20", useCdn: false, token, perspective: "published", stega: { enabled: false } });
    const rows = z.array(rowSchema).parse(await client.fetch(monthArticlesQuery, { start: startUtc, end: endUtc }));
    const candidates: PublishedArticleCandidate[] = rows.flatMap((row) => {
      if (!row.title || !row.category) return [];
      try {
        return [{
          documentId: row.id,
          title: row.title,
          canonicalUrl: getArticleCanonical({ slug: row.slug, category: row.category, categorySlug: row.categorySlug ?? undefined, canonical: row.canonical ?? undefined }),
          publishedAt: row.publishedAt,
          noindex: row.noindex,
        }];
      } catch {
        return [];
      }
    });
    return { state: "ok", articles: assembleMonthArticles(candidates, month) };
  } catch {
    return { state: "request-failed" };
  }
}
