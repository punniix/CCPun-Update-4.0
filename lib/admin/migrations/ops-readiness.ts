import { getLineProviderActivationReadiness, readLineDocumentMediaHealth } from "../line/document-media";
import { getLineMediaProviderReadiness } from "../line/media-provider";
import { getLineSystemDeliveryProviderReadiness } from "../line/provider";
import { readLineDeliveryHealth } from "../line/business-intelligence";
import { readLineKeyRotationStatus } from "../line/key-rotation";
import { getSocialOperationsRuntimeStatus } from "../social/operations";

if (typeof window !== "undefined") throw new Error("OPS_MIGRATION_SERVER_ONLY");
type Variables = Record<string, string | undefined>;
const text = (value: string | undefined) => value?.trim() ?? "";
const present = (value: string | undefined) => Boolean(text(value));

export function opsCapabilityMetadata(variables: Variables = process.env) {
  const activation = getLineProviderActivationReadiness(variables);
  const delivery = getLineSystemDeliveryProviderReadiness(variables);
  const media = getLineMediaProviderReadiness(variables);
  const activeVersion = text(variables.CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION);
  let webhookConfigured = false;
  try {
    const url = new URL(text(variables.CCPUN_N8N_EXPORT_WEBHOOK_URL));
    webhookConfigured = url.protocol === "https:" && !url.username && !url.password;
  } catch { /* Missing or malformed configuration is not ready. */ }
  return {
    localAi: {
      enabled: text(variables.CCPUN_LOCAL_AI_ENABLED) === "true",
      callbacksEnabled: text(variables.CCPUN_LOCAL_AI_N8N_ENABLED) === "true",
      tokenConfigured: text(variables.CCPUN_LOCAL_AI_N8N_TOKEN).length >= 43,
      encryptionV1Present: present(variables.CCPUN_LOCAL_AI_ENCRYPTION_KEY_V1),
      encryptionV2Present: present(variables.CCPUN_LOCAL_AI_ENCRYPTION_KEY_V2),
      activeVersionValid: !text(variables.CCPUN_LOCAL_AI_ACTIVE_KEY_VERSION) || ["1", "2"].includes(text(variables.CCPUN_LOCAL_AI_ACTIVE_KEY_VERSION)),
      activeV2: text(variables.CCPUN_LOCAL_AI_ACTIVE_KEY_VERSION) === "2",
      aggregateVerified: false,
    },
    line: {
      webhookSecretPresent: present(variables.LINE_CHANNEL_SECRET),
      channelTokenPresent: activation.channelTokenPresent,
      identityHmacV1Present: present(variables.CCPUN_LINE_IDENTITY_HMAC_KEY_V1),
      encryptionV1Present: present(variables.CCPUN_LINE_ENCRYPTION_KEY_V1),
      encryptionV2Present: present(variables.CCPUN_LINE_ENCRYPTION_KEY_V2),
      activeVersionValid: !activeVersion || activeVersion === "1" || activeVersion === "2",
      activeV2: activation.activeV2, v2Configured: activation.v2Configured,
      contentCryptoReady: delivery.cryptoReady, systemDeliveryEnabled: delivery.enabled,
      outboundEnabled: activation.outboundWriteGateEnabled, richMenuEnabled: activation.richMenuWriteGateEnabled,
      mediaFetchEnabled: media.fetchEnabled,
      lazyRotationEnabled: text(variables.CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED) === "true",
      campaignEnabled: text(variables.CCPUN_LINE_CAMPAIGN_SEND_ENABLED) === "true",
      transcriptEnabled: text(variables.CCPUN_LINE_TRANSCRIPT_ENABLED) === "true",
    },
    drive: {
      mediaLibraryEnabled: text(variables.CCPUN_MEDIA_LIBRARY_ENABLED) === "1",
      oauthClientConfigured: activation.driveOAuthClientConfigured,
      pickerConfigured: activation.drivePickerConfigured, rootsConfigured: activation.driveRootsConfigured,
      interactiveConfigured: activation.driveInteractiveConfigReady,
      persistentCredentialExpected: false,
    },
    social: {
      queueEnabled: getSocialOperationsRuntimeStatus().enabled,
      databasePresent: present(variables.CCPUN_SOCIAL_DATABASE_URL),
      providerReadsEnabled: text(variables.CCPUN_SOCIAL_PROVIDER_READS_ENABLED) === "1",
      providerWritesEnabled: text(variables.CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED) === "1",
      analyticsEnabled: text(variables.CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED) === "1",
      metaTokenPresent: present(variables.CCPUN_META_ACCESS_TOKEN),
      metaVersionPresent: present(variables.CCPUN_META_GRAPH_VERSION),
      metaScopesPresent: present(variables.CCPUN_META_GRANTED_SCOPES),
      metaPagePresent: present(variables.CCPUN_META_PAGE_ID),
      aggregateVerified: false,
    },
    n8n: {
      agentCallbacksEnabled: text(variables.CCPUN_AGENT_OS_N8N_ENABLED) === "true",
      agentTokenConfigured: text(variables.CCPUN_AGENT_OS_N8N_TOKEN).length >= 43,
      exportCallbacksEnabled: text(variables.CCPUN_EXPORT_N8N_ENABLED) === "true",
      exportTokenConfigured: text(variables.CCPUN_EXPORT_N8N_TOKEN).length >= 43,
      googleSheetTriggerEnabled: text(variables.CCPUN_EXPORT_GOOGLE_SHEET_ENABLED) === "true",
      webhookConfigured, webhookTokenConfigured: text(variables.CCPUN_N8N_EXPORT_WEBHOOK_TOKEN).length >= 43,
      aggregateVerified: false,
    },
    cron: { secretPresent: present(variables.CRON_SECRET) },
  };
}

function counts(row: { state: string }, names: readonly string[]) {
  if (row.state !== "ready") return { available: false };
  const source = row as unknown as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const name of names) {
    const value = source[name];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return { available: false };
    result[name] = value;
  }
  return { available: true, counts: result };
}

export async function readOpsReadiness(variables: Variables = process.env) {
  const capability = opsCapabilityMetadata(variables);
  const [documents, delivery, rotation] = await Promise.all([
    readLineDocumentMediaHealth(variables), readLineDeliveryHealth(variables), readLineKeyRotationStatus(variables),
  ]);
  return {
    capability,
    lineDocumentCounts: counts(documents, ["pendingFetch", "pendingUpload", "failed", "revokeRequired", "reconciliationRequired"]),
    lineDeliveryCounts: counts(delivery, ["outboundQueued", "outboundLeased", "outboundRetryableFailed", "outboundDeadLetter", "outboundReconciliation", "campaignQueued", "campaignLeased", "campaignRetryableFailed", "campaignDeadLetter", "campaignReconciliation"]),
    lineCryptoCounts: counts(rotation, ["totalV1Count", "unsupportedVersionCount", "encryptedUnsentCount"]),
  };
}
