import { approvedPublicArticleUrl, boundedSeoFetch, BLOG_SITEMAP_URL } from "./post-publish-network";
export type SeoCheckState = "pass" | "fail" | "unknown";
export type GoogleIndexState = "indexed" | "not-indexed" | "unknown" | "unavailable";

export type PostPublishSeoCheck = {
  articleId: string;
  url: string;
  checkedAt: string;
  live: { state: SeoCheckState; httpStatus: number | null; finalUrl: string | null };
  indexability: { state: SeoCheckState; noindexDetected: boolean | null; source: "html-or-header" | null };
  canonical: { state: SeoCheckState; expected: string; observed: string | null };
  sitemap: {
    state: SeoCheckState;
    sitemapUrl: string;
    observedLastmod: string | null;
    expectedLastmod: string | null;
  };
  discovery: { state: "sitemap-visible" | "sitemap-missing" | "unknown"; directIndexRequestSent: false };
  google: {
    state: GoogleIndexState;
    verdict: string | null;
    coverageState: string | null;
    indexingState: string | null;
    pageFetchState: string | null;
    lastCrawlTime: string | null;
    googleCanonical: string | null;
    userCanonical: string | null;
    inspectionResultLink: string | null;
    limitation: string;
  };
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(decodeEntities(value.trim()));
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? "") : null;
}

export function extractCanonical(html: string) {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attribute(tag, "rel")?.toLowerCase().split(/\s+/) ?? [];
    if (rel.includes("canonical")) return normalizeUrl(attribute(tag, "href"));
  }
  return null;
}

export function detectNoindex(html: string, headers?: Headers) {
  const header = headers?.get("x-robots-tag")?.toLowerCase() ?? "";
  if (/(?:^|[,;\s])noindex(?:$|[,;\s])/.test(header)) return true;
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = attribute(tag, "name")?.toLowerCase();
    if (name !== "robots" && name !== "googlebot") continue;
    const content = attribute(tag, "content")?.toLowerCase() ?? "";
    if (/(?:^|[,;\s])noindex(?:$|[,;\s])/.test(content)) return true;
  }
  return false;
}

export function findSitemapEntry(xml: string, expectedUrl: string) {
  const normalizedExpected = normalizeUrl(expectedUrl);
  if (!normalizedExpected) return null;
  for (const block of xml.match(/<url>[^]*?<\/url>/gi) ?? []) {
    const loc = block.match(/<loc>([^]*?)<\/loc>/i)?.[1]?.trim() ?? null;
    if (normalizeUrl(loc) !== normalizedExpected) continue;
    const lastmod = block.match(/<lastmod>([^]*?)<\/lastmod>/i)?.[1]?.trim() ?? null;
    return { loc: normalizedExpected, lastmod: lastmod ? decodeEntities(lastmod) : null };
  }
  return null;
}

function lastmodMatches(observed: string | null, expected: string | null) {
  if (!expected) return true;
  if (!observed) return false;
  const observedAt = Date.parse(observed);
  const expectedAt = Date.parse(expected);
  if (!Number.isFinite(observedAt) || !Number.isFinite(expectedAt)) return false;
  return Math.abs(observedAt - expectedAt) <= 120_000;
}

export async function verifyPublishedArticleSeo(input: {
  articleId: string;
  url: string;
  expectedLastmod: string | null;
  sitemapUrl?: string;
  fetcher?: FetchLike;
}): Promise<Omit<PostPublishSeoCheck, "google">> {
  const fetcher = input.fetcher ?? fetch;
  const sitemapUrl = input.sitemapUrl ?? BLOG_SITEMAP_URL;
  const expectedCanonical = normalizeUrl(input.url) ?? input.url;
  const checkedAt = new Date().toISOString();

  let live: PostPublishSeoCheck["live"] = { state: "unknown", httpStatus: null, finalUrl: null };
  let indexability: PostPublishSeoCheck["indexability"] = { state: "unknown", noindexDetected: null, source: null };
  let canonical: PostPublishSeoCheck["canonical"] = { state: "unknown", expected: expectedCanonical, observed: null };

  try {
    if (!approvedPublicArticleUrl(input.url)) throw new Error("SEO_UNTRUSTED_URL");
    const { response, body: html } = await boundedSeoFetch(input.url, fetcher);
    const finalUrl = normalizeUrl(response.url || input.url);
    live = {
      state: response.status === 200 && finalUrl === expectedCanonical ? "pass" : "fail",
      httpStatus: response.status,
      finalUrl,
    };
    const noindexDetected = detectNoindex(html, response.headers);
    indexability = {
      state: response.status === 200 && !noindexDetected ? "pass" : "fail",
      noindexDetected,
      source: "html-or-header",
    };
    const observedCanonical = extractCanonical(html);
    canonical = {
      state: observedCanonical === expectedCanonical ? "pass" : "fail",
      expected: expectedCanonical,
      observed: observedCanonical,
    };
  } catch {
    live = { state: "fail", httpStatus: null, finalUrl: null };
  }

  let sitemap: PostPublishSeoCheck["sitemap"] = {
    state: "unknown",
    sitemapUrl,
    observedLastmod: null,
    expectedLastmod: input.expectedLastmod,
  };
  try {
    if (!approvedPublicArticleUrl(input.url) || sitemapUrl !== BLOG_SITEMAP_URL) throw new Error("SEO_UNTRUSTED_URL");
    const { response, body } = await boundedSeoFetch(sitemapUrl, fetcher, 2_000_000);
    if (response.status === 200) {
      const entry = findSitemapEntry(body, expectedCanonical);
      sitemap = {
        state: entry && lastmodMatches(entry.lastmod, input.expectedLastmod) ? "pass" : "fail",
        sitemapUrl,
        observedLastmod: entry?.lastmod ?? null,
        expectedLastmod: input.expectedLastmod,
      };
    } else {
      sitemap = { ...sitemap, state: "fail" };
    }
  } catch {
    sitemap = { ...sitemap, state: "fail" };
  }

  return {
    articleId: input.articleId,
    url: expectedCanonical,
    checkedAt,
    live,
    indexability,
    canonical,
    sitemap,
    discovery: {
      state: sitemap.state === "pass" ? "sitemap-visible" : sitemap.state === "fail" ? "sitemap-missing" : "unknown",
      directIndexRequestSent: false,
    },
  };
}

export function emptyGoogleInspection(limitation: string): PostPublishSeoCheck["google"] {
  return {
    state: "unavailable",
    verdict: null,
    coverageState: null,
    indexingState: null,
    pageFetchState: null,
    lastCrawlTime: null,
    googleCanonical: null,
    userCanonical: null,
    inspectionResultLink: null,
    limitation,
  };
}
