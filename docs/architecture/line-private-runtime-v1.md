# CCPun LINE Private Runtime v1

Status: Phase 2 durable-ingestion foundation. UAT schema migrated and verified on 2026-09-17. Production remains unchanged until the release passes CI/Preview and the required private runtime secrets are installed.

## Purpose

The public LINE webhook remains a narrow, signed ingress endpoint. Customer Confidential Data is normalized only into allowlisted fields and crosses directly into the private Neon operational plane. It never goes through cloud AI, MCP, n8n AI nodes, generic analytics, logs, traces, or client-side code. A separate approved Private Local-AI Enclave may receive an AES-256-GCM envelope and decrypt it only inside the VPS worker memory under `docs/architecture/local-ai-enclave-20260919.md`.

```text
LINE
  -> apps/web /api/line/webhook/
  -> exact raw-body HMAC verification
  -> allowlisted normalization
  -> keyed lookup digests + authenticated encryption
  -> dedicated Neon role: ccpun_line_ingress
  -> private_line.ingest_line_event(jsonb)
  -> private_line.*
```

The public web runtime does not use `CCPUN_ADMIN_DATABASE_URL` or `CCPUN_SOCIAL_DATABASE_URL` for LINE ingestion.

## Trust boundaries

### Public webhook

The webhook may:

- verify `x-line-signature` against the exact raw request body;
- parse a JSON envelope up to 1 MiB;
- normalize supported event fields;
- compute deterministic HMAC-SHA-256 lookup digests with a private key;
- encrypt reversible private fields with AES-256-GCM;
- invoke exactly one reviewed database function;
- return aggregate counts/status only.

It must not:

- log raw webhook bodies, LINE identities, message content, files, or customer identifiers;
- fetch arbitrary URLs or LINE message content;
- reference `LINE_CHANNEL_ACCESS_TOKEN`;
- use broad Admin/Social Neon credentials;
- call a cloud AI SDK, MCP, n8n, analytics, or a client-visible endpoint with private payloads. The only AI exception is the isolated local worker contract; n8n never carries its private payload.

### Neon ingress role

`ccpun_line_ingress` is intentionally created as `NOLOGIN`. Enabling LOGIN and setting its password is a deployment-secret step, not part of a migration and must never place the password in Git or Chat.

The role has:

- `CONNECT` on `neondb`;
- `USAGE` on `private_line`;
- `EXECUTE` on `private_line.ingest_line_event(jsonb)`.

It has no direct table DML grants in `private_line` and no access grants to `ccpun_admin`, `ccpun_social`, or `neon_auth`.

The function is `SECURITY DEFINER` with a fixed `search_path = pg_catalog, private_line`. The private schema is revoked from `PUBLIC`.

## Identity and encryption

CCPun internal UUIDs are domain identities. LINE IDs are provider identities only.

At the application boundary:

- LINE user ID -> keyed HMAC digest for lookup + AES-256-GCM ciphertext for later authorized use;
- `webhookEventId` -> keyed HMAC digest only;
- provider message ID -> keyed HMAC digest for idempotency + AES-256-GCM ciphertext for the later private file-fetch service;
- text message -> AES-256-GCM ciphertext;
- file/image/audio/video binary -> never fetched by the public webhook.

Encryption values include `key_version`. v1 uses two independent secrets:

- `CCPUN_LINE_IDENTITY_HMAC_KEY_V1` — base64, at least 32 decoded bytes;
- `CCPUN_LINE_ENCRYPTION_KEY_V1` — base64, exactly 32 decoded bytes.

Future key rotation must add a new version and deterministic private migration/read-back path; do not overwrite old key material until all ciphertext/lookup rows are migrated and verified.

## Private domain

`private_line` currently owns:

- `customer`
- `provider_identity`
- `conversation`
- `webhook_event`
- `message`
- `document`
- `lead`
- `advisor_case`
- `safe_journey_state`
- `message_tombstone`
- `schema_migration`
- `system_identity`

Raw webhook JSON is not canonical storage.

## Idempotency and redelivery

Idempotency is database-owned, not in-memory:

- `webhook_event.event_digest` is the primary key;
- `message.provider_message_digest` is unique;
- customer/provider identity lookup is serialized with an advisory transaction lock;
- one active human-handoff lead/case is reused for redelivery rather than duplicated.

A partial batch may count malformed/unsupported events without discarding otherwise valid events. A durable database failure returns 503 so LINE can redeliver; already committed events remain safe because the database owns uniqueness.

## Unsend

Unsend is a privacy operation, not a display-only flag.

`ingest_line_event`:

1. creates/updates a digest-only tombstone;
2. purges encrypted message content and encrypted provider-message ID when the message exists;
3. sets the message to `unsent` and removes human-handoff use of that message;
4. marks related document metadata `revoke_required` and clears the external file reference when present;
5. retains a tombstone with no raw content.

If an unsend webhook arrives before a redelivered original message, the tombstone is created first. The later message is inserted directly as `unsent` with ciphertext omitted, preventing resurrection.

## SafeForAI contract

The only LINE-derived structure allowed to cross a future AI boundary is the exact allowlist:

```ts
{
  journey: string;
  stage: string;
  material_received: boolean;
  needs_human: boolean;
  content_id?: string;
}
```

Unknown keys are rejected. Identity, messages, documents, health values, and financial values are not redacted into this object; they are structurally excluded.

## Lane identity

UAT:

- project `young-term-47483330`
- branch `br-crimson-mouse-az7ajkv8`
- endpoint `ep-mute-frost-aztvz394`
- database `neondb`

Production:

- project `lively-bar-43618798`
- branch `br-long-resonance-b3ys5xrv`
- endpoint `ep-broad-butterfly-b3ro7u8w`
- database `neondb`

The web runtime validates those identifiers, the exact Neon hostname, database, role, SSL mode, Vercel project, environment, and Production branch before creating a database client.

## Scope intentionally deferred

This release does not add:

- LINE Channel Access Token to `ccpun-web`;
- file-content fetch from LINE;
- Google Drive uploads/customer-folder mutation;
- outbound LINE messaging;
- Admin Inbox reads/replies;
- Rich Menu/Quick Reply state transitions;
- AI knowledge answers.

Those layers build on this private boundary. File fetch and outbound messaging belong in the private Admin/service side, not in the raw public webhook path.
