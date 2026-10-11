import { getArticleCanonical, isArticleCanonicalAligned } from "@/lib/content/url";

export const BLOG_SITEMAP_URL = "https://ccpun.com/sitemaps/blog.xml";

export function approvedPublicArticleUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "ccpun.com" || url.port || url.username || url.password
      || url.search || url.hash || url.origin !== "https://ccpun.com"
      || !/^\/blog\/[a-z0-9-]+\/[a-z0-9-]+\/$/.test(url.pathname)
      || url.toString() !== value) return null;
    return value;
  } catch {
    return null;
  }
}

export function approvedPublishedArticle(article: {
  slug: string; category: string; categorySlug: string; canonical?: string | null;
}): string | null {
  if (!isArticleCanonicalAligned({
    slug: article.slug, category: article.category, categorySlug: article.categorySlug,
    canonical: article.canonical ?? undefined,
  })) return null;
  return approvedPublicArticleUrl(getArticleCanonical({ ...article, canonical: article.canonical ?? undefined }));
}

export async function boundedSeoFetch(
  url: string,
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch,
  limit = 1_500_000,
): Promise<{ response: Response; body: string }> {
  if (url !== BLOG_SITEMAP_URL && !approvedPublicArticleUrl(url)) throw new Error("SEO_UNTRUSTED_URL");
  const response = await fetcher(url, {
    method: "GET",
    cache: "no-store",
    redirect: "manual",
    headers: { Accept: "text/html,application/xml,text/xml;q=0.9,*/*;q=0.8", "User-Agent": "CCPun-Post-Publish-SEO/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status >= 300 && response.status < 400) throw new Error("SEO_REDIRECT_DENIED");
  if (response.url && response.url !== url) throw new Error("SEO_UNTRUSTED_RESPONSE_URL");
  const announced = Number(response.headers.get("content-length"));
  if (announced > limit) throw new Error("SEO_RESPONSE_TOO_LARGE");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("SEO_RESPONSE_MISSING");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw new Error("SEO_RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  return { response, body: new TextDecoder().decode(data) };
}
