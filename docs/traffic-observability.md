# CCPun Traffic Observability

This document defines one owner for each traffic question so Cloudflare, Vercel and GA4 do not become competing sources of truth.

## Ownership model

| Question | Primary source | Notes |
| --- | --- | --- |
| Which verified bot/operator reached CCPun? | Cloudflare | AI Crawl Control / bot verification is authoritative when available. |
| Was the bot allowed or blocked at the edge? | Cloudflare | Security and edge policy belong here. |
| Which route was requested and did the app/runtime fail? | Vercel | Runtime/request/cache/deployment observability. |
| Which declared AI User-Agent reached a public CCPun route? | Vercel `[AI_CRAWL]` logs | Supplemental attribution only; User-Agent values can be spoofed. |
| How many people visited and where did they come from? | GA4 | Human marketing acquisition and engagement. |
| Which consented user actions became marketing conversions? | GA4 | Keep application events behind `lib/analytics.ts` and the existing consent contract. |

## Existing human analytics

CCPun already mounts GA4, GTM, Meta Pixel and Cookie Consent through the existing analytics feature. Application events are centralized through `lib/analytics.ts`.

Do not duplicate human pageview, source/medium, scroll or conversion tracking in Vercel. GA4 remains the human marketing source of truth.

## Vercel AI crawler observability

`proxy.ts` has a header-based matcher for the AI User-Agent tokens tracked by `lib/observability/ai-crawler.ts`. Ordinary browser traffic does not enter Proxy because of this new matcher; the existing Admin/auth matchers are unchanged.

Recognized public AI requests emit one structured line:

```text
[AI_CRAWL] {"schema":"ccpun.ai_crawl.v1","observed_at":"...","crawler":"OAI-SearchBot","operator":"OpenAI","category":"ai_search","user_triggered_likelihood":"low","path":"/blog/.../","method":"GET","environment":"production","attribution":"user_agent_unverified","vercel_request_id":"...","cf_ray":"..."}
```

The event deliberately excludes:

- IP addresses and Cloudflare connecting IP headers
- cookies or session identifiers
- query strings
- referrers
- form/body data
- names, email addresses, phone numbers, health data or financial values
- the full raw User-Agent

The optional `cf_ray` is a request correlation identifier, not an identity field. It can help compare a Vercel event with Cloudflare evidence when Cloudflare data is available.

## Categories

The crawler/operator/category list mirrors the Cloudflare AI Crawl Control bot reference at implementation time:

- `ai_assistant`: automated AI access driven by user action; examples include ChatGPT-User, Claude-User and Perplexity-User.
- `ai_search`: AI/search indexing or search retrieval crawlers; examples include OAI-SearchBot, Claude-SearchBot and PerplexityBot.
- `ai_crawler`: model/content crawling category; examples include GPTBot and ClaudeBot.

`user_triggered_likelihood=high` means the crawler category is AI Assistant. It does **not** identify which human triggered the request and cannot prove that the site owner triggered it.

## Querying Vercel

Use the `ccpun-web` project and Production environment. Search Runtime Logs for:

```text
[AI_CRAWL]
```

Then narrow with a crawler or operator token, for example:

```text
[AI_CRAWL] OAI-SearchBot
[AI_CRAWL] ChatGPT-User
[AI_CRAWL] PerplexityBot
[AI_CRAWL] Anthropic
```

For self-tests, note the exact time and test URL, then request that URL from an AI assistant. A matching `ai_assistant` log at the same time/path is strong circumstantial evidence of the test, but it is not user identity proof.

## Cloudflare correlation

Cloudflare remains the preferred source for verified crawler identity and allow/block status. When Cloudflare AI Crawl Control is accessible, correlate by:

1. time window,
2. crawler/operator,
3. path,
4. `cf_ray` when surfaced on both sides.

Do not replace a Cloudflare verified-bot result with Vercel User-Agent attribution when the two disagree.

## GA4 boundaries

GA4 owns human acquisition, engagement and conversion. Continue using consent-gated semantic events through `lib/analytics.ts`; do not add direct `gtag`, `fbq` or provider calls in feature code.

Recommended reporting split:

- **Human:** GA4 users, sessions, source/medium, landing page, engagement and key events.
- **AI visibility:** Cloudflare verified crawls plus Vercel `[AI_CRAWL]` route evidence.
- **Website health:** Vercel requests, status codes, runtime errors, cache and deployment data.

A future CCPun Marketing Dashboard may aggregate these sources, but their ownership boundaries should remain intact.

## Limitations

- User-Agent strings are self-declared and spoofable; Vercel attribution is not verified operator identity.
- AI Assistant traffic cannot reveal the triggering user's account or identity.
- Vercel log retention and wide-range query availability depend on the active plan and log limits.
- Requests blocked by Cloudflare before reaching Vercel will not appear in Vercel logs.
- Requests served in ways that bypass the application runtime may have different observability characteristics; validate with Preview before Production merge.

## Rollback

Revert the observability commit(s) that add `lib/observability/ai-crawler.ts`, the AI User-Agent matcher/log call in `proxy.ts`, and the associated regression test. No GA4 event names, consent behavior, SEO URLs, Sanity data or Production content are changed by this feature.
