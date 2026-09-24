# CCPun Agent OS — Current State Receipt

Date: 2026-09-24 Asia/Bangkok  
Branch baseline: `v4-production` at `a5e86d951283551fa9f124f3d844697af9b04872`  
Agent OS work branch: `admin/agent-os-foundation-20260924`

This receipt is read-only evidence. It does not authorize Production data mutation, provider writes, environment changes, migration apply, merge or deploy.

## Verified Git / Vercel state

Two Vercel projects remain canonical:

- Public Web: `ccpun-web` / `prj_dxwjITkd0av5QiJQv2snUlIASUWu`
- Admin: `ccpun-admin` / `prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN`

At this receipt:

- Admin Agent OS Preview deployments are being created from `admin/agent-os-foundation-20260924`.
- No Agent OS commit targets Production.
- Public Web Production's newest READY deployment in the inspected list remains SHA `8639d82b7f1886ad958be8fc9d92a7ddfd9d339f`; later Admin-only Production branch changes produced cancelled Web deployments, which is consistent with Web isolation.
- Admin Production previously reached `v4-production` SHA `a5e86d951283551fa9f124f3d844697af9b04872`.

## Current Vercel runtime-error evidence

### Public Web — observed in last 7 days

Existing error groups pre-date Agent OS work:

1. Sanity Category Registry request failures.
2. Invalid Category Registry records isolated by fail-soft logic.
3. Blog featured settings unavailable.
4. Category Registry unavailable on category metadata/page generation.
5. One Article list record skipped because `lineDescription` exceeded validation.

Agent OS does not change these content contracts in this branch.

### Admin — observed in last 7 days

Existing error groups pre-date Agent OS work:

1. SEO audit Portable Text row with `markDefs = null` failing strict array validation.
2. Article list rows skipped because `authorName` had invalid type.
3. Auth.js/Google OAuth PKCE check errors on a small number of requests.

These are hygiene findings, not evidence of an Agent OS regression.

## Sanity read-only verification

### Production

Project/dataset: `kyfxgjnq/production`

Correct content counts:

- canonical published Article documents: **7**
- Draft Article documents: **58**
- Sanity Release/version Article documents: **2**
- published Category documents: **6**
- published Author documents: **1**

Important counting rule:

A correct published-content audit must exclude both:

- `drafts.**`
- `versions.**`

The initial generic count of 9 was incorrect because it excluded Drafts but still counted 2 Release versions from `pre-health-url-cutover-2026-08-26`.

### Active UAT

Project/dataset: `ccb9lnw5/uat`

- published Article documents: **0**
- Draft Article documents: **11**
- published Category documents: **6**
- published Author documents: **2**

This remains consistent with the lane contract: UAT editorial work should remain Draft unless an intentional fixture is published.

### Dataset privacy constraint

The active Sanity datasets are public because of the current Free-plan architecture. Their dataset descriptions explicitly prohibit confidential/customer data. Agent OS must therefore continue to keep CRM, raw conversation, operational secrets and private execution payloads out of Sanity.

## Neon verification limitation in this Chat audit

The available Neon connector currently exposes calls such as `describe_branch({branch_id})`, but the runtime rejects them because it additionally requires `project_id`, which is not present in the exposed input schema. Because of that connector mismatch, no new live Production/UAT Neon claims are made in this receipt.

Repository and previous reviewed readback evidence remain the only Neon evidence used for this branch until a compatible read-only Neon call is available.

Agent OS migration files in this branch are **source only**. They have not been applied to UAT or Production.

## n8n verification limitation

The current Chat toolset has no connected n8n/Hostinger control-plane connector. Therefore:

- repository-controlled n8n snapshots/contracts were inspected;
- live n8n workflow inventory, current execution list and credentials were **not** independently read from the live instance in this receipt.

No claim should be made that every live workflow matches repository snapshots until live n8n readback is performed.

## Existing n8n / Local-AI contract verified in repository

The repository currently defines:

- n8n → Admin authenticated bridge for public-safe Local AI work;
- strict rejection of customer-private payloads through that public-safe bridge;
- LINE Card generation visibly orchestrated in n8n;
- Local Ollama kept on a private Docker network;
- Local AI concurrency intentionally bounded;
- Admin owner review before applying Local-AI output.

Agent OS extends this pattern rather than bypassing it.

## Backup finding

`scripts/backup/README.md` references:

`.github/workflows/backup-sanity-production.yml`

The audited Production branch does not contain that workflow.

Therefore automated Sanity backup is currently classified as:

**unproven / requires live provider verification**

A README is not accepted as backup evidence. Recovery requires restore evidence, not only export evidence.

## Agent OS branch safety state

Current Agent OS work is additive and fail-closed:

- no Production mutation;
- no provider write;
- no LINE campaign activation;
- no Cloud AI customer-data path;
- no new SaaS/infrastructure;
- no new Vercel/Neon/Sanity project;
- runtime bridge feature gate defaults to off;
- runtime bridge uses a dedicated token separate from Local-AI n8n auth;
- generic job metadata excludes raw customer payloads;
- Apple Shortcut policy explicitly denies consequential Production/destructive actions.

## Open reality-audit gates before activation

1. Live n8n workflow inventory and execution readback.
2. VPS/container runtime metrics and current Docker inventory.
3. Read-only Neon UAT/Production capability/readback after connector/tool access is working.
4. Actual Sanity backup scheduler/provider verification.
5. Restore drill evidence.
6. Google Calendar account/calendar selection and OAuth ownership for the future projection.
7. LINE OA MCP hosting/auth/read-only smoke before any write capability is enabled.

Until these gates are read back, their state is `not verified`, not `failed` and not `ready`.


## Source-only additions after the receipt baseline

The Agent OS branch now also contains source-controlled foundations for:

- private chat screenshot OCR through an authenticated self-hosted n8n workflow;
- a resource-bounded PaddleOCR Thai mobile sidecar on the existing VPS;
- owner review before encrypted manual_ocr CRM archive insertion;
- direct owner CSV exports;
- background Google Sheet exports through n8n;
- Bangkok UTC+7 export naming and timestamps;
- owner business/automation dashboard aggregates.

These are not evidence of live activation.

Outstanding activation evidence remains:

- live n8n network path to the OCR sidecar without public exposure;
- live OCR container resource measurements on the Hostinger VPS;
- UAT application/readback of the OCR archive migration;
- Google Sheets OAuth credential binding inside the live n8n workflow;
- Agent OS Runtime migration activation before background export jobs can report durable status.


## Vercel Preview retry note

The Agent OS head passed GitHub Foundation CI, Admin/Web shadow builds and the Sanity privacy boundary. One Vercel Preview attempt failed before application build with `ECONNRESET` during `npm ci`. This is classified as a transient dependency-install/network failure rather than an application compile failure. A fresh Preview run is required for final UI-preview evidence.
