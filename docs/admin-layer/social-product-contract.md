# Social workspace product contract

This file is the PR57 acceptance source of truth. Chat summaries and agent-local plans may not reduce it.

## Content continuity

- Read current and future `socialVariant` Drafts from Sanity on every workspace load; no fixture or baseline-count fallback.
- Discover new provider content on every manual sync; refresh mutable Meta metrics with a configurable bounded overlap (30 days by default, adjustable up to 180 days). The effective read window starts at the previous successful sync minus that overlap, so a delayed sync automatically covers the elapsed gap plus the overlap. Stale historical metadata/thumbnails refresh in bounded batches rather than scanning the full history on every sync.
- Keep editorial bodies in Sanity and operational publication/metric state in Neon.

## Facebook authoring and publishing

The UI and execution contract must distinguish and validate:

| Format | Publish now | Schedule | Required media |
| --- | --- | --- | --- |
| Text | Yes | Meta native | None |
| Link | Yes | Meta native | HTTPS link |
| Single image | Yes | Meta native | One approved image |
| Multi-image / album | Yes | Meta native | 2-10 ordered approved images |
| Video | Yes | Meta native when supported by the endpoint | One approved video |
| Reel | Yes | Meta native when supported by the endpoint | One approved vertical video |

Live streaming is a separate RTMP/live-video workflow and must not be presented as an ordinary post upload.

## Instagram authoring and publishing

- Support image, carousel and Reel variants when an approved trusted media-delivery URL exists.
- Support Reel audio discovery and the approved Audio API configuration.
- `native-finish` creates a CCPun mobile handoff; it must never claim to create an Instagram native Draft.
- Direct scheduled Instagram publishing requires the CCPun-owned scheduler lane; no n8n. Until that lane is separately enabled, keep provider execution disabled and show the limitation.

## Human control and safety

- Saving or editing always creates/updates a Sanity Draft and resets review to `drafting`.
- Approval and execution are separate owner actions bound to the exact Sanity revision/version.
- One approved revision may have only one active execution; changing its schedule updates or supersedes the existing inactive job instead of creating a duplicate post.
- Final Meta write adapters enforce the exact Admin UAT lane and `CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED=1` themselves.
- No provider write, Production deploy, cron enablement or external publish is implied by implementing or testing this contract.

## Workspace and reporting

- Social navigation: Overview, Posts, Calendar, Stats, Connections; Blog remains unchanged.
- Stats keeps provider-native metric names, never sums unlike metrics across platforms, and shows filters, trends, Top content and raw history in one page.
- Manual Google Sheets export creates separate sheets for content, publications and each platform/stat family without persisting a Google access token.
- Keep required secrets/config minimal and documented; no n8n in this phase.
