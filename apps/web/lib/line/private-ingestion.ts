import { createHash } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { after } from "next/server";
import { z } from "zod";
import type { LinePrivateIngestEvent } from "../../../../lib/line/private-domain";
import {
  createLineContentCrypto,
  createLinePrivateCrypto,
  type LineContentCrypto,
  type LineEncryptedValue,
} from "../../../../lib/line/private-crypto";
import {
  encodeLineSystemMessageIntent,
  isLineArticleDiscoveryJourney,
} from "../../../../lib/line/system-delivery";

const WEB_VERCEL_PROJECT_ID = "prj_dxwjITkd0av5QiJQv2snUlIASUWu";

export const LINE_INGEST_LANES = {
  uat: {
    environment: "web-uat",
    projectId: "young-term-47483330",
    branchId: "br-crimson-mouse-az7ajkv8",
    endpointId: "ep-mute-frost-aztvz394",
    hostSuffix: "c-3.ap-southeast-1.aws.neon.tech",
    database: "neondb",
    runtimeRole: "ccpun_line_ingress",
  },
  production: {
    environment: "production",
    projectId: "lively-bar-43618798",
    branchId: "br-long-resonance-b3ys5xrv",
    endpointId: "ep-broad-butterfly-b3ro7u8w",
    hostSuffix: "c-4.ap-southeast-1.aws.neon.tech",
    database: "neondb",
    runtimeRole: "ccpun_line_ingress",
  },
} as const;

type LineIngestLane = keyof typeof LINE_INGEST_LANES;
type LineIngestIdentity = (typeof LINE_INGEST_LANES)[LineIngestLane];

export type LineIngestRuntime = {
  lane: LineIngestLane;
  identity: LineIngestIdentity;
  connectionString: string;
};

export type LineIngestOutcome =
  | "accepted"
  | "duplicate_event"
  | "duplicate_message"
  | "unsend_applied"
  | "unsend_pending";

const rotationCandidateSchema = z.object({
  candidate_kind: z.enum(["identity_external_ref", "message_provider_id", "message_content"]),
  record_id: z.string().uuid(),
  source_key_version: z.coerce.number().int(),
  ciphertext_b64: z.string().min(1),
  nonce_b64: z.string().min(1),
  auth_tag_b64: z.string().min(1),
  purpose: z.enum(["line-user-id", "message-provider-id", "message-content"]),
});

function inferredEnvironment(variables: Record<string, string | undefined>) {
  const explicit = variables.CCPUN_APP_ENV?.trim();
  if (explicit) return explicit;
  if (variables.VERCEL_PROJECT_ID?.trim() !== WEB_VERCEL_PROJECT_ID) return "unknown";
  if (variables.VERCEL_ENV?.trim() === "production") return "production";
  if (variables.VERCEL_ENV?.trim() === "preview") return "web-uat";
  return "unknown";
}

function lazyRotationCrypto(
  variables: Record<string, string | undefined>,
): LineContentCrypto | null {
  if (variables.CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED?.trim() !== "true") return null;
  try {
    const crypto = createLineContentCrypto(variables);
    if (crypto.keyVersion !== 2 || !crypto.hasKeyVersion(1) || !crypto.hasKeyVersion(2)) return null;
    return crypto;
  } catch {
    return null;
  }
}

export function resolveLineIngestRuntime(
  variables: Record<string, string | undefined> = process.env,
): LineIngestRuntime | null {
  const environment = inferredEnvironment(variables);
  const lane: LineIngestLane | null = environment === "production"
    ? "production"
    : environment === "web-uat"
      ? "uat"
      : null;
  if (!lane) return null;

  const identity = LINE_INGEST_LANES[lane];
  const connectionString = variables.CCPUN_LINE_INGEST_DATABASE_URL?.trim();
  if (!connectionString) return null;
  if (variables.CCPUN_LINE_NEON_PROJECT_ID?.trim() !== identity.projectId) return null;
  if (variables.CCPUN_LINE_NEON_BRANCH_ID?.trim() !== identity.branchId) return null;
  if (variables.CCPUN_LINE_NEON_DATABASE?.trim() !== identity.database) return null;

  const vercelEnvironment = variables.VERCEL_ENV?.trim();
  const vercelProjectId = variables.VERCEL_PROJECT_ID?.trim();
  const gitBranch = variables.VERCEL_GIT_COMMIT_REF?.trim();
  if (lane === "production") {
    if (vercelEnvironment !== "production" || vercelProjectId !== WEB_VERCEL_PROJECT_ID || gitBranch !== "v4-production") {
      return null;
    }
  } else if (vercelEnvironment || vercelProjectId) {
    if (vercelEnvironment !== "preview" || vercelProjectId !== WEB_VERCEL_PROJECT_ID) return null;
  }

  try {
    const url = new URL(connectionString);
    const allowedHosts = new Set([
      `${identity.endpointId}.${identity.hostSuffix}`,
      `${identity.endpointId}-pooler.${identity.hostSuffix}`,
    ]);
    if (url.protocol !== "postgresql:" || !allowedHosts.has(url.hostname) || url.port || url.hash) return null;
    if (decodeURIComponent(url.username) !== identity.runtimeRole || !url.password) return null;
    if (decodeURIComponent(url.pathname.slice(1)) !== identity.database) return null;
    if (url.searchParams.get("sslmode") !== "require") return null;
    return { lane, identity, connectionString };
  } catch {
    return null;
  }
}

function privateEventPayload(event: LinePrivateIngestEvent) {
  return {
    event_digest: event.eventDigest,
    event_type: event.eventType,
    occurred_at: event.occurredAt,
    is_redelivery: event.isRedelivery,
    source_type: event.sourceType,
    identity: event.identity
      ? {
          lookup_digest: event.identity.lookupDigest,
          ciphertext_b64: event.identity.encryptedExternalRef.ciphertextB64,
          nonce_b64: event.identity.encryptedExternalRef.nonceB64,
          auth_tag_b64: event.identity.encryptedExternalRef.authTagB64,
          key_version: event.identity.encryptedExternalRef.keyVersion,
        }
      : null,
    message: event.message
      ? {
          provider_message_digest: event.message.providerMessageDigest,
          provider_message_ciphertext_b64: event.message.encryptedProviderMessageId.ciphertextB64,
          provider_message_nonce_b64: event.message.encryptedProviderMessageId.nonceB64,
          provider_message_auth_tag_b64: event.message.encryptedProviderMessageId.authTagB64,
          provider_message_key_version: event.message.encryptedProviderMessageId.keyVersion,
          message_type: event.message.messageType,
          content: event.message.encryptedContent
            ? {
                ciphertext_b64: event.message.encryptedContent.ciphertextB64,
                nonce_b64: event.message.encryptedContent.nonceB64,
                auth_tag_b64: event.message.encryptedContent.authTagB64,
                key_version: event.message.encryptedContent.keyVersion,
              }
            : null,
          material_received: event.message.materialReceived,
        }
      : null,
    postback: event.postback
      ? {
          journey: event.postback.journey,
          stage: event.postback.stage,
          needs_human: event.postback.needsHuman,
        }
      : null,
    unsend_target_digest: event.unsendTargetDigest,
    needs_human: event.needsHuman,
  };
}

type LineIngressSqlClient = NeonQueryFunction<false, false>;

const systemOutboundRowSchema = z.object({
  outcome: z.enum(["queued", "duplicate", "identity_missing"]),
  outbound_id: z.string().uuid().nullable(),
});

function sha256Hex(...parts: string[]) {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part).update("\0");
  return hash.digest("hex");
}

function resolveSystemDeliveryDispatchUrl(
  runtime: LineIngestRuntime,
  variables: Record<string, string | undefined>,
) {
  if (variables.CCPUN_LINE_SYSTEM_DELIVERY_ENABLED?.trim() !== "true") return null;

  const configured = variables.CCPUN_LINE_SYSTEM_DELIVERY_ADMIN_URL?.trim();
  const raw = configured || (runtime.lane === "production"
    ? "https://admin.ccpun.com/api/internal/line/system-delivery/dispatch/"
    : "");
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.search
      || url.hash
      || url.pathname !== "/api/internal/line/system-delivery/dispatch/"
    ) return null;
    if (runtime.lane === "production" && url.hostname !== "admin.ccpun.com") return null;
    if (runtime.lane === "uat" && !url.hostname.endsWith(".vercel.app")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function dispatchSystemOutboundBestEffort(
  endpoint: string,
  outboundId: string,
  dispatchToken: string,
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outboundId, dispatchToken }),
      });
      if (response.ok || response.status === 202 || response.status === 409) return;
      if (response.status !== 503) return;
    } catch {
      // A queued system message remains durable for later reconciliation.
    }
  }
}

async function enqueueLineDiscoverySystemOutboundBestEffort(
  sql: LineIngressSqlClient,
  runtime: LineIngestRuntime,
  event: LinePrivateIngestEvent,
  outcome: LineIngestOutcome,
  variables: Record<string, string | undefined>,
) {
  if (
    variables.CCPUN_LINE_SYSTEM_DELIVERY_ENABLED?.trim() !== "true"
    || event.eventType !== "postback"
    || !event.identity
    || !event.postback
    || event.postback.needsHuman
    || event.postback.stage !== "entry"
    || !isLineArticleDiscoveryJourney(event.postback.journey)
    || (outcome !== "accepted" && outcome !== "duplicate_event")
  ) return;

  const endpoint = resolveSystemDeliveryDispatchUrl(runtime, variables);
  if (!endpoint) return;

  try {
    const privateCrypto = createLinePrivateCrypto(variables);
    const contentCrypto = createLineContentCrypto(variables);
    const journey = event.postback.journey;
    const dispatchToken = privateCrypto.lookupDigest(
      `${event.eventDigest}:${journey}`,
      "system-dispatch",
    );
    const encrypted = contentCrypto.encrypt(
      encodeLineSystemMessageIntent(journey),
      "line-system-message-content",
    );
    const idempotencyDigest = sha256Hex("ccpun-line-system-outbound-v1", event.eventDigest, journey);
    const dispatchTokenDigest = createHash("sha256").update(dispatchToken).digest("hex");

    const rows = z.array(systemOutboundRowSchema).parse(await sql.query(
      "SELECT outcome,outbound_id::text FROM private_line.ingress_enqueue_line_system_outbound($1::jsonb)",
      [JSON.stringify({
        identity_digest: event.identity.lookupDigest,
        journey,
        idempotency_digest: idempotencyDigest,
        dispatch_token_digest: dispatchTokenDigest,
        content_ciphertext_b64: encrypted.ciphertextB64,
        content_nonce_b64: encrypted.nonceB64,
        content_auth_tag_b64: encrypted.authTagB64,
        content_key_version: encrypted.keyVersion,
        created_by_digest: sha256Hex("ccpun-line-system-actor-v1", event.eventDigest),
      })],
    ));
    const queued = rows[0];
    if (!queued?.outbound_id || queued.outcome === "identity_missing") return;

    after(async () => {
      await dispatchSystemOutboundBestEffort(endpoint, queued.outbound_id!, dispatchToken);
    });
  } catch {
    // System discovery is additive. Durable webhook ingestion and journey context
    // remain authoritative even when the optional delivery path is unavailable.
  }
}

function lineRuntimeHealthPayload(
  variables: Record<string, string | undefined>,
) {
  try {
    const crypto = createLineContentCrypto(variables);
    const lazyRotationEnabled =
      variables.CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED?.trim() === "true" &&
      crypto.keyVersion === 2 &&
      crypto.hasKeyVersion(1) &&
      crypto.hasKeyVersion(2);
    return {
      active_version: crypto.keyVersion,
      v1_key_present: crypto.hasKeyVersion(1),
      v2_key_present: crypto.hasKeyVersion(2),
      lazy_rotation_enabled: lazyRotationEnabled,
    };
  } catch {
    return null;
  }
}

async function recordLineRuntimeHealthBestEffort(
  sql: LineIngressSqlClient,
  variables: Record<string, string | undefined>,
) {
  const payload = lineRuntimeHealthPayload(variables);
  if (!payload) return;
  try {
    await sql.query(
      "SELECT outcome FROM private_line.ingress_record_line_runtime_health($1::jsonb)",
      [JSON.stringify(payload)],
    );
  } catch {
    // The status function is additive and may not exist during a rolling deploy.
    // Ingestion must remain available; System Health simply stays stale until the next accepted event.
  }
}

async function rotateCurrentIdentityBestEffort(
  sql: LineIngressSqlClient,
  identityDigest: string,
  crypto: LineContentCrypto,
) {
  let candidates: z.infer<typeof rotationCandidateSchema>[];
  try {
    candidates = z.array(rotationCandidateSchema).parse(await sql.query(
      `SELECT candidate_kind,record_id::text,source_key_version,ciphertext_b64,nonce_b64,auth_tag_b64,purpose
       FROM private_line.ingress_read_line_key_rotation_candidates($1::text,$2::integer)`,
      [identityDigest, 12],
    ));
  } catch {
    return;
  }

  for (const candidate of candidates) {
    if (candidate.source_key_version !== 1) continue;
    try {
      const current: LineEncryptedValue = {
        keyVersion: 1,
        ciphertextB64: candidate.ciphertext_b64,
        nonceB64: candidate.nonce_b64,
        authTagB64: candidate.auth_tag_b64,
      };
      const plaintext = crypto.decrypt(current, candidate.purpose);
      const rotated = crypto.encrypt(plaintext, candidate.purpose);
      if (rotated.keyVersion !== 2) continue;

      await sql.query(
        "SELECT outcome FROM private_line.ingress_apply_line_key_rotation($1::jsonb)",
        [JSON.stringify({
          identity_digest: identityDigest,
          candidate_kind: candidate.candidate_kind,
          record_id: candidate.record_id,
          source_key_version: 1,
          target_key_version: 2,
          ciphertext_b64: rotated.ciphertextB64,
          nonce_b64: rotated.nonceB64,
          auth_tag_b64: rotated.authTagB64,
        })],
      );
    } catch {
      // Rotation is deliberately best-effort. Durable ingestion already succeeded,
      // and no private value is logged or reflected if one candidate cannot rotate.
    }
  }
}

export type LinePrivateIngestor = (event: LinePrivateIngestEvent) => Promise<LineIngestOutcome>;

async function applyLineJourneyContextBestEffort(
  sql: LineIngressSqlClient,
  event: LinePrivateIngestEvent,
  outcome: LineIngestOutcome,
) {
  if (!event.identity) return;

  if (
    event.eventType === "postback"
    && event.postback
    && (outcome === "accepted" || outcome === "duplicate_event")
  ) {
    try {
      await sql.query(
        "SELECT outcome FROM private_line.ingress_apply_line_postback_context($1::jsonb)",
        [JSON.stringify({
          identity_digest: event.identity.lookupDigest,
          journey: event.postback.journey,
          stage: event.postback.stage,
          needs_human: event.postback.needsHuman,
        })],
      );
    } catch {
      // Additive context enrichment must never make durable webhook ingestion fail.
      // A duplicate LINE redelivery can safely try the idempotent context step again.
    }
  }

  if (
    event.eventType === "message"
    && (outcome === "accepted" || outcome === "duplicate_event" || outcome === "duplicate_message")
  ) {
    try {
      await sql.query(
        "SELECT outcome FROM private_line.ingress_apply_line_message_context($1::jsonb)",
        [JSON.stringify({ identity_digest: event.identity.lookupDigest })],
      );
    } catch {
      // The message is already durable. Context enrichment is intentionally best-effort.
    }
  }
}

export function createLinePrivateIngestor(
  variables: Record<string, string | undefined> = process.env,
): LinePrivateIngestor {
  const runtime = resolveLineIngestRuntime(variables);
  if (!runtime) throw new Error("LINE_PRIVATE_INGEST_UNAVAILABLE");

  const sql = neon(runtime.connectionString, {
    fetchOptions: { signal: AbortSignal.timeout(5_000) },
  });
  const rotationCrypto = lazyRotationCrypto(variables);

  return async (event) => {
    const rows = await sql.query(
      "SELECT outcome FROM private_line.ingest_line_event($1::jsonb)",
      [JSON.stringify(privateEventPayload(event))],
    ) as Array<{ outcome?: unknown }>;
    const outcome = rows[0]?.outcome;
    if (
      outcome !== "accepted" &&
      outcome !== "duplicate_event" &&
      outcome !== "duplicate_message" &&
      outcome !== "unsend_applied" &&
      outcome !== "unsend_pending"
    ) {
      throw new Error("LINE_PRIVATE_INGEST_INVALID_RESULT");
    }

    await recordLineRuntimeHealthBestEffort(sql, variables);
    await applyLineJourneyContextBestEffort(sql, event, outcome);
    await enqueueLineDiscoverySystemOutboundBestEffort(sql, runtime, event, outcome, variables);

    if (outcome === "accepted" && event.identity && rotationCrypto) {
      await rotateCurrentIdentityBestEffort(sql, event.identity.lookupDigest, rotationCrypto);
    }

    return outcome;
  };
}
