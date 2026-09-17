import { neon } from "@neondatabase/serverless";
import type { LinePrivateIngestEvent } from "../../../../lib/line/private-domain";

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

function inferredEnvironment(variables: Record<string, string | undefined>) {
  const explicit = variables.CCPUN_APP_ENV?.trim();
  if (explicit) return explicit;
  if (variables.VERCEL_PROJECT_ID?.trim() !== WEB_VERCEL_PROJECT_ID) return "unknown";
  if (variables.VERCEL_ENV?.trim() === "production") return "production";
  if (variables.VERCEL_ENV?.trim() === "preview") return "web-uat";
  return "unknown";
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
    unsend_target_digest: event.unsendTargetDigest,
    needs_human: event.needsHuman,
  };
}

export type LinePrivateIngestor = (event: LinePrivateIngestEvent) => Promise<LineIngestOutcome>;

export function createLinePrivateIngestor(
  variables: Record<string, string | undefined> = process.env,
): LinePrivateIngestor {
  const runtime = resolveLineIngestRuntime(variables);
  if (!runtime) throw new Error("LINE_PRIVATE_INGEST_UNAVAILABLE");

  const sql = neon(runtime.connectionString, {
    fetchOptions: { signal: AbortSignal.timeout(5_000) },
  });

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
    return outcome;
  };
}
