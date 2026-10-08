import "server-only";

import { randomUUID } from "node:crypto";
import { approvedPublishedArticle } from "@/lib/admin/seo-intelligence/post-publish-network";
import { getGscSitemapWriteToken, isGscSitemapWriteApproved } from "@/lib/admin/seo-intelligence/gsc-sitemap-write-auth";
import { insertAdminAudit } from "@/lib/admin/operations/database";
import { getPublishedSeoObservationArticle } from "@/lib/admin/sanity-control";
import { getGoogleDataAccessToken } from "@/lib/admin/seo-intelligence/google-data-auth";
import { emptyGoogleInspection, verifyPublishedArticleSeo, type PostPublishSeoCheck } from "@/lib/admin/seo-intelligence/post-publish";
import { inspectGscIndexedUrl, submitGscSitemap } from "@/lib/admin/seo-intelligence/providers/gsc";

const BLOG_SITEMAP_URL = "https://ccpun.com/sitemaps/blog.xml";

type SitemapSubmissionState = "submitted" | "authorization-required" | "provider-unavailable" | "skipped";

export type PostPublishSeoPipelineResult = PostPublishSeoCheck & {
  sitemapSubmission: {
    state: SitemapSubmissionState;
    submittedAt: string | null;
    limitation: string;
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyWithRetry(articleId: string, url: string, expectedLastmod: string) {
  let result = await verifyPublishedArticleSeo({ articleId, url, expectedLastmod, sitemapUrl: BLOG_SITEMAP_URL });
  for (const delay of [500, 1500]) {
    if (result.live.state === "pass" && result.indexability.state === "pass" && result.canonical.state === "pass" && result.sitemap.state === "pass") break;
    await sleep(delay);
    result = await verifyPublishedArticleSeo({ articleId, url, expectedLastmod, sitemapUrl: BLOG_SITEMAP_URL });
  }
  return result;
}

export async function runPostPublishSeoPipeline(input: {
  articleId: string; actor: string; requestId: string; revision: string; ownerApproved: boolean;
  beforeExternalWrite: () => Promise<void>;
}): Promise<PostPublishSeoPipelineResult | null> {
  const article = await getPublishedSeoObservationArticle(input.articleId);
  if (!article || article.noindex === true || Date.parse(article.updatedAt) !== Date.parse(input.revision)) return null;
  const url = approvedPublishedArticle(article);
  if (!url) return null;
  const verification = await verifyWithRetry(article.id, url, article.updatedAt);
  const siteUrl = process.env.CCPUN_GSC_SITE_URL?.trim();

  let google: PostPublishSeoCheck["google"] = emptyGoogleInspection("Search Console is not connected for this runtime.");
  let sitemapSubmission: PostPublishSeoPipelineResult["sitemapSubmission"] = {
    state: "skipped",
    submittedAt: null,
    limitation: verification.sitemap.state === "pass"
      ? "Sitemap submission was not attempted because Search Console authorization is unavailable."
      : "Sitemap submission was skipped because the published URL was not yet verified in the blog sitemap.",
  };

  // Read-only GSC observations never depend on the optional write credential.
  if (siteUrl) {
    try {
      const readToken = await getGoogleDataAccessToken();
      google = await inspectGscIndexedUrl({ siteUrl, inspectionUrl: url, token: readToken });
    } catch {
      google = emptyGoogleInspection("Search Console URL Inspection unavailable; keep existing read-only authorization.");
    }
  }

  // Write-scoped credentials are completely independent from the read token.
  if (input.ownerApproved && isGscSitemapWriteApproved()
    && verification.live.state === "pass" && verification.canonical.state === "pass"
    && verification.indexability.state === "pass" && verification.sitemap.state === "pass" && siteUrl) {
    await input.beforeExternalWrite(); // durable uncertainty marker BEFORE any external write
    try {
      const writeToken = await getGscSitemapWriteToken();
      const submitted = await submitGscSitemap({ siteUrl, sitemapUrl: BLOG_SITEMAP_URL, token: writeToken });
      sitemapSubmission = {
        state: "submitted", submittedAt: submitted.submittedAt,
        limitation: "Google accepted the sitemap submission, not an individual URL indexing request.",
      };
    } catch {
      sitemapSubmission = {
        state: "provider-unavailable", submittedAt: null,
        limitation: "The sitemap submission outcome requires readback before another write is attempted.",
      };
    }
  }

  const result: PostPublishSeoPipelineResult = { ...verification, google, sitemapSubmission };
  try {
    await insertAdminAudit({
      id: randomUUID(),
      actor: input.actor,
      actorType: "human",
      action: "seo:post-publish-discovery",
      objectType: "article",
      objectId: article.id,
      after: result,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Observability must never turn a successful publication into a failure.
  }
  return result;
}
