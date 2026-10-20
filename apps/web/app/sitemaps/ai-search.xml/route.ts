import { listSitemapArticles } from "@/lib/content/sitemap";
import { getArticleCanonical, isArticleCanonicalAligned } from "@/lib/content/url";
import { getDeploymentLaneByEnvironment } from "@/lib/runtime/deployment-contract";
import { normalizeSitemapLastmod, uniqueSortedSitemapEntries } from "@/lib/sitemap/google";
import { renderUrlSet } from "@/lib/sitemap/xml";
import { shouldBlockWebIndexing } from "../../../runtime-environment";

export const dynamic = "force-dynamic";

export async function GET() {
  const lane = getDeploymentLaneByEnvironment("production");
  const origin = lane?.indexable && lane.role === "web" ? `https://${lane.domain}` : null;
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };
  if (!origin || shouldBlockWebIndexing()) {
    return new Response("AI Search sitemap unavailable", { status: 503, headers });
  }
  try {
    const articles = await listSitemapArticles({ includeDrafts: false, fresh: true });
    const now = Date.now();
    const entries = articles.flatMap((article) => {
      if (article.status !== "published" || article.noindex || /^(drafts|versions)\./.test(article.id)
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
