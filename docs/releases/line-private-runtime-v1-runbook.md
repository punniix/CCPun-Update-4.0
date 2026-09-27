# CCPun LINE Private Runtime v1 — Deployment Runbook

Date: 2026-09-17

This runbook is deterministic and intentionally contains no secret values.

## Preflight

1. Refresh `origin/v4-production` and verify the release branch is not stale.
2. Inspect open PRs for overlapping `apps/web/app/api/line`, `apps/web/lib/line`, `lib/line`, or `private_line` changes.
3. Run:
   - LINE ingress tests;
   - Web TypeScript check;
   - app runtime-boundary check;
   - relevant foundation/Shadow CI before merge.
4. Verify the production webhook still returns 200 for a correctly signed empty `events` array.
5. Never inspect or export real customer rows during deployment verification.

## Database order

UAT first:

- project `young-term-47483330`
- branch `br-crimson-mouse-az7ajkv8`
- database `neondb`
- migration `db/migrations/20260917_private_line_runtime_v1_uat.sql`
- readback `db/migrations/20260917_private_line_runtime_v1_uat_readback.sql`

Production after Preview/UAT is green:

- project `lively-bar-43618798`
- branch `br-long-resonance-b3ys5xrv`
- database `neondb`
- migration `db/migrations/20260917_private_line_runtime_v1_production.sql`
- readback `db/migrations/20260917_private_line_runtime_v1_production_readback.sql`

Migrations are additive. `ccpun_line_ingress` is created `NOLOGIN`. Do not set a role password inside migration SQL.

## UAT evidence already established

On 2026-09-17 the UAT migration was applied transactionally and read back using schema/permission booleans only. Verified:

- lane/database/checksum identity;
- `ccpun_line_ingress` is non-superuser, no create-role/create-db/bypass-RLS;
- database `CONNECT` and private schema `USAGE` only;
- execute permission on `private_line.ingest_line_event(jsonb)`;
- no direct private table grants;
- no grants into `ccpun_admin` or `ccpun_social`;
- 12 expected private-line tables.

Synthetic-only function tests verified:

- new message -> `accepted`;
- same webhook event -> `duplicate_event`;
- new event carrying the same provider message -> `duplicate_message`;
- message then unsend -> `unsend_applied` and ciphertext purge;
- unsend before redelivered message -> `unsend_pending`, then the later message remains unsent with content omitted;
- redelivery did not duplicate customer, provider identity, lead, or advisor case.

## Secret gate

Do not put any of these values in Chat, Git, PR descriptions, issue comments, logs, or screenshots.

Before a non-empty webhook can use UAT/Production durable ingestion, the private runtime requires:

### Neon ingress credential

The PostgreSQL role `ccpun_line_ingress` must be changed from `NOLOGIN` to `LOGIN` and receive a strong generated password through a human-controlled Neon/SQL secret workflow. The resulting connection string must use that role only.

### Web runtime secrets

Vercel project: `ccpun-web` (`prj_dxwjITkd0av5QiJQv2snUlIASUWu`)

Required server-only variables:

- `CCPUN_LINE_INGEST_DATABASE_URL`
- `CCPUN_LINE_IDENTITY_HMAC_KEY_V1`
- `CCPUN_LINE_ENCRYPTION_KEY_V1`

Required non-secret lane guards:

- `CCPUN_LINE_NEON_PROJECT_ID`
- `CCPUN_LINE_NEON_BRANCH_ID`
- `CCPUN_LINE_NEON_DATABASE=neondb`

`LINE_CHANNEL_SECRET` remains required as before.

Do not add:

- `NEXT_PUBLIC_LINE*`
- `CCPUN_ADMIN_DATABASE_URL` to the web LINE path
- `CCPUN_SOCIAL_DATABASE_URL` to the web LINE path
- `LINE_CHANNEL_ACCESS_TOKEN` to the public raw-webhook service for this release.

### Secret format

`CCPUN_LINE_IDENTITY_HMAC_KEY_V1`:

- base64 text;
- decoded value at least 32 random bytes.

`CCPUN_LINE_ENCRYPTION_KEY_V1`:

- base64 text;
- decoded value exactly 32 random bytes.

The values must be generated/set outside Chat. Do not paste them into a conversation for validation.

## Preview/UAT deployment

After UAT-only secrets are installed:

1. Deploy the release branch to the `ccpun-web` Preview lane.
2. Confirm environment identity resolves to `web-uat` and exact UAT Neon metadata.
3. Send only a synthetic signed event to the Preview webhook.
4. Verify only safe response counts/status.
5. Read back only synthetic-row counts/booleans/status — no real customer content.
6. Repeat the synthetic event and verify it is counted as duplicate rather than inserted again.
7. Exercise synthetic unsend and verify purge/tombstone booleans.

## Production cutover

Only after CI + Preview + UAT are green:

1. Refresh `v4-production` and resolve concurrent changes without overwriting unrelated work.
2. Apply the Production migration transactionally.
3. Run Production readback; all guards must be true.
4. Enable the dedicated Production `ccpun_line_ingress` LOGIN credential and install Production server-only variables in `ccpun-web` without exposing values.
5. Merge the reviewed release PR.
6. Wait only for synchronous deployment completion/read-back; do not rely on background/manual follow-up.
7. Verify the live empty-event LINE connectivity request still returns HTTP 200.
8. Use the owner-controlled synthetic/live smoke account for one non-sensitive message; inspect only safe outcome/count metadata through tooling.
9. Confirm no raw message, LINE ID, or secret appears in Vercel/DB operational output.

If the dedicated DB credential or encryption keys are missing, the non-empty webhook intentionally fails closed with a generic 503 so LINE can redeliver after configuration is repaired. The signed empty-event verification request remains 200.

## Rollback/reconcile

The DB migration is additive and should not be destructively rolled back. If application cutover must be reverted:

- revert the application release to the previous webhook code;
- leave `private_line` schema/data intact;
- disable LOGIN/rotate the dedicated ingress credential if compromise is suspected;
- reconcile retry/redelivery through DB idempotency before re-enabling.

Never delete customer data or private schema as a routine deployment rollback.
