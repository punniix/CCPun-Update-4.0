# LINE Attribution, Revenue, Privacy & Operations

This release closes the private business-outcome loop after the LINE Lead/Advisor foundation.

## Business funnel

The private funnel is:

View / CTA → LINE continue → Material received → Qualified conversation → Advisor review → Solution / Quote → Implementation → Won / Lost → Revenue attribution

Qualified Conversations remain the Growth North Star. Revenue is private business data and is never sent to GA4, Meta, generic analytics, public Web APIs, or SafeForAI.

## Private business events

`private_line.business_event` accepts only the reviewed event allowlist:

- view
- cta
- line_continue
- material_received
- lead_qualified
- advisor_review
- solution_or_quote
- implementation_started
- implementation_complete
- won
- lost
- revenue_attributed

Rows may contain internal Lead/Advisor Case references plus safe origin/journey/content/campaign/tool identifiers. The table has no raw LINE identifiers, names, contact data, messages, documents, health/financial inputs, ciphertext or arbitrary JSON payload.

Stage transitions remain authoritative for Lead stage. Stage transitions emit business events, but revenue attribution never changes Lead stage.

## Attribution

Website/LINE attribution is explicit only. An owner-authorized binding links one already-safe `web_journey_event` to one known Lead.

There is no fingerprinting, identity inference, email/phone matching or probabilistic attribution. If explicit linkage is absent, attribution remains unknown.

A successful explicit bind can project safe CTA/LINE-continue context into the private business-event store. Material received is projected only from the Lead's existing boolean state.

## Implementation and revenue

Implementation state is stored privately with optional safe partner code.

Revenue records are private and idempotent:

- internal Lead reference
- integer minor units
- ISO 4217-style three-letter currency
- idempotency digest
- actor digest
- attributed timestamp

Currencies are never combined into one total. Admin analytics groups revenue by currency.

## Content Intelligence

Content Intelligence receives aggregate safe dimensions only:

- origin
- journey
- content_id
- campaign_id
- tool_id
- Lead count
- material-received count
- qualified count
- implementation-complete count
- won count
- revenue-record count

It receives no customer code, Lead row, transcript, document, private note, health/financial value or revenue amount per individual.

No LLM is required for this aggregate projection.

## Privacy / Data Rights

Privacy requests are private workflow records with:

- request type: export | delete
- state: requested → verified → prepared → approved
- terminal states: executed | cancelled | failed
- internal Customer/Lead reference
- actor/verification digests
- timestamps

Export/Delete preparation returns category counts only through the Admin surface. It does not send raw data through AI/MCP.

Delete execution is intentionally unavailable from the Admin UI/API. The database transition function rejects delete → executed with an irreversible Human Gate error.

No destructive customer-delete function or purge cron ships in this release.

## Retention

Retention defaults to:

- policy_mode = manual_review
- automatic_delete_enabled = false

No legal retention period is invented. A future retention period requires an explicit legal/business decision and reviewed migration.

Unsend remains a separate immediate-content-purge contract and is not weakened by this retention policy.

## Least privilege

`ccpun_admin_runtime` and `ccpun_line_ingress` retain zero direct private_line base-table grants.

Reviewed Admin capabilities use fixed-search-path SECURITY DEFINER functions. PUBLIC execution is revoked. LINE ingress cannot access revenue, privacy or Admin analytics functions.

## Operations

System Health receives aggregate counts/status only:

- outbound queued / failed / reconciliation
- campaign queued / reconciliation
- privacy requests pending
- business-event count / latest timestamp
- manual retention mode / auto-delete state
- encryption-key rotation aggregate state from the existing key-rotation capability

No request bodies, customer identifiers, ciphertext or raw provider errors are returned.

## Human Gates remaining

These actions stay outside automation:

1. LINE Channel Access Token provisioning before real outbound send is enabled.
2. Google Drive owner consent for the future customer-document runtime.
3. Any irreversible privacy delete after a reviewed request reaches Approved.
4. Final mobile/LINE Human UAT.
