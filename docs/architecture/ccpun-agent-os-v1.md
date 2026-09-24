# CCPun Agent OS v1

Status: foundation contract  
Baseline: `v4-production` at `a5e86d951283551fa9f124f3d844697af9b04872`  
Date: 2026-09-24 Asia/Bangkok

## Objective

Turn the existing CCPun stack into one operating system without adding paid infrastructure by default. Agent OS v1 coordinates Marketing, CRM, Admin, n8n, Local AI, optional sanitized Cloud AI, LINE, Google services, GitHub/Vercel and human actions while preserving the existing data-ownership and privacy boundaries.

This is a consolidation and orchestration project, not a platform rewrite.

## Product rules

1. Reuse before build.
2. Rules before AI.
3. Local before Cloud.
4. Automation before Agent.
5. Human before irreversible action.
6. Automation-first, manual-always-available.
7. One durable datum has one canonical owner.
8. Unknown provider outcomes reconcile; they are never blindly replayed.
9. Generic operational logs contain metadata, not raw customer-private content.
10. No new recurring infrastructure spend without measured evidence that the current stack is insufficient.

## Canonical ownership

| Domain | Owner |
| --- | --- |
| Editorial content and public SEO | Sanity |
| Customer, Lead, Conversation, Journey, CRM task and consent | Neon `private_line` |
| Admin operations, audit, generic Agent OS job summaries | Neon `ccpun_admin` |
| Social provider execution and metrics | Neon `ccpun_social` |
| Customer documents | Google Drive plus private CRM metadata |
| Appointments | CRM is business truth; Google Calendar is a time projection |
| Routine orchestration | n8n |
| Detailed n8n execution history | n8n |
| Local inference | Hostinger VPS / Ollama |
| Code, tests and migrations | GitHub |
| Deployment | Vercel |
| Human control | `admin.ccpun.com` |
| Personal quick input | Admin and future Apple Shortcut |
| LINE customer runtime | Existing LINE API/Webhook + private CRM |
| LINE agent/operator capability | LINE OA MCP, behind CCPun approval/audit boundaries |

## Existing foundations that must be extended, not replaced

- Admin Operations, Health, Deployments and Jobs.
- `ccpun_admin.audit_log`.
- Provider Control Plane command/lease/reconciliation pattern.
- Customer/Lead/Advisor Case/Conversation/Journey/Task foundations.
- LINE private archive, attribution, Campaign and business-intelligence foundations.
- Social Marketing Mart.
- Local-AI job/enclave contracts.
- n8n LINE Card workflow and Admin bridge.
- GitHub/Vercel CI and Preview/Production lanes.

## Cross-system runtime job contract

Long-running work must project a safe job summary using the contract in:

`lib/admin/operations/agent-os-job-contract.ts`

Shared states:

`queued → running → waiting_external / waiting_ai → validating → awaiting_review → completed`

Failure states:

`retrying → failed / reconciliation_required / cancelled`

Every job has a correlation ID, request ID, source, action, workflow key, stage, queue class, attempts, timestamps and optional n8n/provider references. Generic job records must never contain raw customer conversation, documents, health/financial details, secrets or unsanitized prompts.

## Runtime UX

Admin must not use a blind spinner for long-running work.

For a job it should show:

- current stage;
- elapsed time;
- heartbeat freshness;
- attempt count;
- queue state when available;
- historical p50/p90 duration when there is enough evidence;
- a slower-than-usual warning derived from history, not a fabricated ETA;
- normalized failure reason;
- reconciliation state when outcome is ambiguous;
- execution reference for owner troubleshooting.

Fake percentage progress is prohibited unless the workflow can prove deterministic completion units.

## Command boundary

The existing Control Plane is the pattern for future commands. Generic command policy is defined in:

`lib/admin/control-plane/agent-os-command-contract.ts`

Admin and Apple Shortcut may share the future Automation Gateway, but they do not share authority. Shortcut uses a scoped credential and cannot request Production deploy, destructive privacy actions, secret rotation or database migration.

Consequential actions require an authenticated human Admin path and explicit approval. n8n, system actors and AI actors cannot self-authorize them.

## Human Capture

Agent OS must support a universal Capture Inbox. A user can enter plain language from Admin or future Shortcut. Local processing proposes:

- destination;
- field/value;
- fact vs inference vs recommendation;
- follow-up/task/calendar actions.

Customer facts are never overwritten by AI inference. The human can edit or manually enter the record even when AI or n8n is unavailable.

## CRM operating model

Existing CRM state remains canonical. Smart Admin views are derived, not a second CRM:

- Needs Attention
- Follow-up Today
- Overdue
- Waiting Customer
- Waiting CCPun
- Documents Ready
- High Intent
- Dormant
- Review Due

Next Best Action starts deterministic. Every suggestion must include a reason.

## Historical Customer Intelligence

Time windows are configurable:

- 30 days
- 90 days
- 180 days
- 1 year
- year to date
- all retained history
- custom range

Comparisons support previous period, previous year and custom comparison.

Raw history remains private. The intended flow is scoped private retrieval → Local structured extraction → aggregate signals → owner-safe insight. Optional Cloud reasoning receives only minimized, de-identified, allowlisted context.

Insights distinguish observed evidence, derived interpretation and suggested action.

## Marketing closed loop

The common attribution dimensions are:

`origin / campaign_id / content_id / tool_id / journey`

The business funnel is:

`Reach → Traffic → Intent → Tool → LINE → Lead → Qualified Conversation → Implementation → Won → Revenue`

The working north-star metric is Qualified Conversation, with Won and Revenue downstream.

## n8n role

n8n is the Routine Engine, not the durable source of truth.

Good candidates:

- CRM follow-up and overdue detection;
- Calendar projection/reconciliation;
- GSC and Social collection;
- health checks;
- scheduled aggregation;
- notification routing;
- approved campaign orchestration;
- Local-AI public-safe workflows;
- runtime event projection.

GitHub/Vercel retain code/deploy authority.

## VPS scheduling

The existing 2 vCPU / 8 GB VPS remains the default.

Classes:

- realtime: webhook/Admin/Shortcut/CRM event;
- interactive: owner-requested Local AI;
- routine: health, follow-up, reconciliation;
- batch: SEO, historical aggregation and bulk Local AI.

Ollama remains concurrency 1. Heavy Local-AI batch work should be placed in a low-traffic window and must not overlap another heavy batch by default.

## Local / Cloud / Agent ladder

0. SQL and deterministic rules.
1. Local AI.
2. Sanitized Cloud AI.
3. AI Agent for open-ended exception work.
4. Human decision.

Use the lowest level that can safely and reliably complete the task.

Raw sensitive data stays in the private plane. Cloud AI receives only minimum sanitized context after deterministic detection, Local semantic redaction and an outbound allowlist.

## Reliability

Every important workflow requires:

- idempotency;
- bounded retry;
- timeout;
- heartbeat;
- normalized error category;
- reconciliation for ambiguous external outcomes;
- kill switch / feature gate;
- owner-visible history;
- manual fallback.

## Notifications

- Info: Admin only.
- Warning: grouped into Daily Brief.
- Critical: immediate owner notification.

Notification policy should minimize alert fatigue.

## Backup

The current repository contains `scripts/backup/README.md` but the referenced `.github/workflows/backup-sanity-production.yml` is absent from the audited baseline. Backup automation is therefore not treated as proven until current provider/live state is read back. Restore evidence, not a successful export alone, is the recovery criterion.

## Explicit non-goals for v1

Do not add by default:

- another CRM;
- another Vercel project;
- another Neon project;
- another Sanity project;
- a vector database;
- a queue SaaS;
- an observability SaaS;
- a new agent platform;
- multiple large Local models;
- Local image generation.

## Definition of Done — Core

Agent OS Core is ready when:

1. Important background jobs have a safe cross-system Job/Correlation ID.
2. Admin shows real stage/elapsed/heartbeat/error state.
3. n8n execution can be traced from the Admin summary without exposing private payloads.
4. Retry cannot create duplicate consequential actions.
5. Ambiguous outcomes become reconciliation-required.
6. Admin Today surfaces actionable CRM/Operations work.
7. Manual CRM/Capture paths remain usable without AI.
8. AI inference is visibly separate from confirmed facts.
9. Raw customer-private data cannot reach Cloud AI.
10. Automation has kill switches.
11. Critical workflows retain a manual fallback.
12. No new recurring infrastructure subscription is required for the core.
