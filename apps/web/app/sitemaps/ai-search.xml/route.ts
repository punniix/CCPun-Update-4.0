import { createClient, groq } from "next-sanity";
import { z } from "zod";
import { getSanityReadToken } from "@/lib/content/sanity-credentials";
import { isContentSanityLaneAllowed } from "@/lib/content/sanity-lane";
import { getArticleCanonical, isArticleCanonicalAligned } from "@/lib/content/url";
import { getDeploymentLaneByEnvironment } from "@/lib/runtime/deployment-contract";
import { normalizeSitemapLastmod, uniqueSortedSitemapEntries } from "@/lib/sitemap/google";
import { renderUrlSet } from "@/lib/sitemap/xml";
import { shouldBlockWebIndexing } from "../../../runtime-environment";

export const dynamic = "force-dynamic";

const articleSchema = z.object({
  id: z.string().min(1), slug: z.string().min(1), category: z.string().min(1),
  categorySlug: z.string().nullish().transform((value) => value ?? undefined),
  canonical: z.string().nullish().transform((value) => value ?? undefined), noindex: z.boolean().nullish(),
  publishedAt: z.string().min(1), optimizedAt: z.string().nullish(),
});
const articleQuery = groq`*[
  _type == "article" && defined(slug.current) && defined(publishedAt) &&
  dateTime(publishedAt) <= dateTime(now()) && review.status == "approved" &&
  coalesce(seo.noindex, false) == false
] { "id": _id, "slug": slug.current, "category": category->title,
  "categorySlug": category->slug.current, "canonical": seo.canonical,
  "noindex": seo.noindex, publishedAt, "optimizedAt": contentOptimizedAt }`;

export async function GET() {
  const lane = getDeploymentLaneByEnvironment("production");
  const origin = lane?.indexable && lane.role === "web" ? `https://${lane.domain}` : null;
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };
  if (!origin || shouldBlockWebIndexing()) {
    return new Response("AI Search sitemap unavailable", { status: 503, headers });
  }
  try {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
    if (!isContentSanityLaneAllowed(projectId, dataset)) throw new Error("AI_SITEMAP_LANE_DENIED");
    const client = createClient({ projectId, dataset, apiVersion: "2026-08-18", perspective: "published",
      token: getSanityReadToken(), useCdn: false, stega: { enabled: false, studioUrl: "/studio" } });
    const articles = z.array(articleSchema).parse(await client.fetch(articleQuery, {}, { cache: "no-store" }));
    const now = Date.now();
    const entries = articles.flatMap((article) => {
      if (article.noindex || /^(drafts|versions)\./.test(article.id)
        || !isArticleCanonicalAligned(article)) return [];
      const publishedAt = normalizeSitemapLastmod(article.publishedAt);
      // Only first publication or explicitly approved text optimization advances this feed.
      const lastmod = normalizeSitemapLastmod(article.optimizedAt ?? article.publishedAt);
      const loc = getArticleCanonical(article);
      if (!publishedAt || !lastmod || Date.parse(publishedAt) > now || Date.parse(lastmod) > now
        || !loc.startsWith(`${origin}/blog/`) || !/^\/blog\/[a-z0-9-]+\/[a-z0-9-]+\/$/.test(new URL(loc).pathname)) return [];
      return [{ loc, lastmod }];
    });
    return new Response(renderUrlSet(uniqueSortedSitemapEntries([{ loc: `${origin}/` }, ...entries])), {
      headers: { ...headers, "Content-Type": "application/xml; charset=utf-8" },
    });
  } catch {
    return new Response("AI Search sitemap temporarily unavailable", {
      status: 503, headers: { ...headers, "Retry-After": "300" },
    });
  }
}
