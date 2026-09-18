# LINE Ecosystem Phase 8–10 — Safe Knowledge, Advisor OS, Campaign Return

This release extends the private LINE foundation without activating any new external provider write.

## Phase 8 — Safe Knowledge

Safe Knowledge accepts predefined `question_id` values plus an exact allowlist of safe journey state. It does not accept free-text user questions.

Published Sanity content is the only answer source in this release:

- published article only;
- Draft content is excluded;
- `noindex` content is excluded;
- an exact FAQ answer may be returned when a predefined question maps to a matching approved FAQ;
- otherwise the user receives related content or human handoff.

Any personalized situation, suitability/recommendation/quote requirement, health conclusion, explicit human request, or missing approved source forces `human_handoff`.

There is no LLM provider dependency in the runtime. The contract is ready for a future AI adapter only if that adapter accepts the same strict safe schema.

## Phase 9 — Advisor Operating System

The existing Advisor Inbox remains the Control Plane. This release adds:

- safe operational filters: stage, journey, priority, assignment, case state, safe tag and source/content/tool reference;
- assignment;
- follow-up;
- priority;
- case state;
- safe tags;
- operational timeline;
- document metadata status only;
- encrypted internal notes.

Inbox search is deliberately not transcript search. It cannot search customer names, phone/email, message text, documents or financial/health values.

Internal notes are Customer Confidential Data. They are AES-GCM encrypted with the LINE content encryption key and are available only when:

- `CCPUN_LINE_PRIVATE_NOTES_ENABLED=true`; and
- the existing Admin LINE encryption key is available.

There is no SafeForAI/internal-note projection.

## Phase 10 — Campaign / Return Layer

Campaigns are business objects with:

- draft → human approved → active lifecycle;
- safe journey/content/tool attribution references;
- approved copy/version;
- structured safe recipient criteria;
- schedule window;
- aggregate delivery counts.

Recipient selection happens inside the private database through a Security Definer function. Recipient rows and LINE identity never reach the Admin client or AI.

Allowed segment criteria are limited to structured safe fields such as journey, stage, material-received, priority, case state, safe tags/source references and bounded recency buckets.

The delivery queue has:

- unique campaign+lead idempotency;
- opaque delivery IDs;
- lease owner/expiry;
- bounded attempt count;
- checkpoint ledger;
- explicit `reconciliation_required`.

Human approval is required before queue construction.

Provider sending is intentionally absent from this release. Even after a private queue exists, no LINE request is made until a later exact feature gate and Channel Access Token are activated by the owner.

## Database boundary

Migration:

`20260918_line_safe_knowledge_crm_campaign_v1_*`

Rules:

- checksum-locked UAT/Production parity;
- exact Neon lane guard;
- `private_line.system_identity` is verified but never modified;
- zero direct private base-table grants to `ccpun_admin_runtime`;
- ingress privileges remain unchanged;
- PUBLIC execute/read is revoked on all new private functions/views;
- Admin receives reviewed safe views + Security Definer functions only.

## Human activation deferred

No owner secret is required to merge/deploy this release with private notes and campaign provider send disabled.

Later Final Activation Batch may enable:

- `CCPUN_LINE_PRIVATE_NOTES_ENABLED=true` after the exact existing LINE encryption key is installed in Admin;
- campaign provider send only after a dedicated exact feature gate and LINE Channel Access Token are installed;
- real recipient/provider tests only during owner-controlled Final Human UAT.

No secret value should be pasted into chat, GitHub, logs or migration files.
