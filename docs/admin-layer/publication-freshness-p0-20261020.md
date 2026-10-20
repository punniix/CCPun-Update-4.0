# CCPun P0: Publication freshness, cache and SEO date contract

Checked 20 October 2026 against v4-production and live https://ccpun.com.

## Source of truth and event semantics

- Draft saves, review/internal note edits, approvals and previews never alter live publishedAt, live contentUpdatedAt, public cache or lastmod.
- First publish through CCPun Studio/owner scheduler uses publishApprovedArticle: publishedAt is set once and contentUpdatedAt is set to the publication time.
- Optimize publish keeps live publishedAt and only advances contentUpdatedAt for reader-visible article changes, not notes, review status, rebuilt Portable Text keys or internal SEO audits.
- Optimizations of title, excerpt, body, FAQ, sources, featured images, or public SEO metadata count as visible changes. Review and internal notes do not.
- There is no generic write-time Sanity hook that can force third-party tools or direct Content Lake writes to use this helper. An external writer MUST preserve original publishedAt, set contentUpdatedAt only on substantive updates, and verify the live result. Do not assume Sanity publish_documents automatically stamps contentUpdatedAt.
- Existing direct-API historical exceptions require scoped reconciliation with source publication evidence and optimistic concurrency. Do not set contentUpdatedAt to the time of the reconciliation itself unless new substantive content was also published.

## Confirmed production headers

On 20 October 2026, HTML at /blog/personal-finance/tax-deduction/ replied with Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate and CF-Cache-Status: DYNAMIC. No HTML purge was warranted.
The blog sitemap served Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400 and CF-Cache-Status: DYNAMIC in the sampled response. Its TTL tuning remains a separate P1 policy decision.
We have not independently verified all Cloudflare dashboard Cache Rules or optional Hostinger CDN configuration.

## QA for every live publication

1. Assert the published document exists, the draft has been resolved, the original publishedAt is retained on optimize, and contentUpdatedAt matches the accepted substantive publication timestamp.
2. Check the canonical live article HTML contains the intended content and renders the expected latest-update date; test cold GET rather than only a prefetched client navigation.
3. Check /sitemaps/blog.xml contains the same document URL and its expected lastmod timestamp. A Google re-crawl cannot be guaranteed on publish.
4. Check Cache-Control, CF-Cache-Status, Age and Vary on live HTML; target purge an affected URL only when stale caching is demonstrated.
5. Never use Purge Everything, change DNS, or deploy unrelated branches to fix a stale content timestamp.

## Validation

Run node --import tsx --test tests/sitemap-google-regression.test.ts tests/admin/article-publish-action.test.ts.
