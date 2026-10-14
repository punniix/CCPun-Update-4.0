# CCPun LINE customer-care continuation — private OCR security hold

Date: 2026-10-14 (Asia/Bangkok)
Source conversation: https://chatgpt.com/s/cx_6acfb3897d28819191c03a9156c4041b
Source report: `CCPun-Financial Advisor Project/Dev/Reports/2026-10-11-line-customer-ai-mcp.md`
Source branch: `codex/admin-owner-redesign-uat-20261014` at `c64540ec`
Isolated Khai-hub branch: `fix/line-care-safety-khai-20261014`

## Decision and scope

The older LINE screenshot OCR Admin endpoint forwarded raw screenshot bytes, original filenames, lead IDs and timestamps to a configurable n8n webhook. This was incompatible with the current absolute ban on sending sensitive customer data into cloud AI or unverified external workflows. A live private OCR transport with end-to-end authenticated receipt, bounded upload admission, owner-only confirmation and retention proof was not available for acceptance.

This change is a **deliberate fail-closed security hold**. It is not an OCR feature delivery or an assertion that the complete LINE customer-care platform is ready.

- Both screenshot upload and confirm routes continue to check authentication, owner RBAC, origin, and lead ID.
- Both paths return a deterministic HTTP 503 before reading the request body or invoking remote/DB transports, even when the old OCR feature flag is enabled.
- The configurable n8n raw-screenshot bridge and client-supplied request-ID-only confirmation path have been removed from these routes.
- The Admin OCR UI distinguishes the deliberate safety hold from an uncertain provider outcome, preserves the draft, and states explicitly that no OCR processing or CRM save occurred.
- Existing LINE manual import, customer records, messaging, OA menu and n8n workflow state remain untouched.

## Offline verification performed

- Dedicated synthetic behavioral tests exercise both routes with OCR enabled/disabled and verify no request-body read, network or storage action. Anonymous, non-owner, wrong-origin and invalid-UUID cases are denied.
- Focused and relevant Admin regression: **42 pass, 0 fail**.
- Full Admin suite: 1,153 tests, 1,148 pass, 3 fail, 2 conditional skip.
- Independent comparison on an unmodified checkout of `c64540ec`: the exact same three failures reproduce in the analytics local-assessment and marketing-collection test files (12 pass, 3 fail). Therefore these are baseline failures, not introduced by this change.
- Admin TypeScript typecheck: pass. Scoped ESLint: pass. `git diff --check`: pass.
- No customer traffic, live messages, OCR uploads, credentials, production settings, server environment values or outbound provider actions were used for these checks.

## Activation and remaining release blockers

**Do not activate the private OCR / new Care sender yet.** To safely restore OCR, replace this hold only after all of these are independently proven in UAT:

1. Fixed and authenticated **private** OCR gateway with verified operator ownership, transport, streaming request cap and concurrency/timeout bounds; no arbitrary n8n webhook or cloud fallback.
2. Server-issued OCR proposal receipt bound to actor, lead, image digest, exact revision and expiration; atomic one-time consumption and replay/changed-message rejection.
3. Private encryption and single transaction for accepted messages, audited rollback/unknown-result handling, owner-only access and suitable retention/erasure.
4. No sensitive payloads in n8n input/execution/history/pinned data/logs, or any OpenAI/cloud model/tool input or output; negative canary tests and actual request-byte inspection.
5. Complete LINE ingress (including the previously observed real 503/no-record case), idempotent delivery journal and revocation/STOP/takeover gates.
6. Human approval bound to exact recipient/content/action before Care send, quiet hours, consent and reminder revision checks, and an explicit owner-verified UAT → Production release gate.
7. Release lane/source identity, CI, secret scan and Hostinger readback verified before any deploy or activation.

No production deployment, provider activation or LINE customer messaging was performed in this continuation.
