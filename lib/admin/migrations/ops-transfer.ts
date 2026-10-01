import { constants, createCipheriv, createHash, createPublicKey, publicEncrypt, randomBytes } from "node:crypto";
import { migrationOwnerPost } from "./google-data-transfer";
import type { OpsTransferConfig } from "./ops-transfer-public-config";

if (typeof window !== "undefined") throw new Error("OPS_TRANSFER_SERVER_ONLY");
export const OPS_FIELDS = {
  cronAuth: ["CRON_SECRET"],
  localAiCrypto: ["CCPUN_LOCAL_AI_ENCRYPTION_KEY_V1", "CCPUN_LOCAL_AI_ACTIVE_KEY_VERSION"],
  localAiCallbacks: ["CCPUN_LOCAL_AI_N8N_TOKEN"],
  socialWorker: ["CCPUN_SOCIAL_DATABASE_URL", "CCPUN_META_ACCESS_TOKEN", "CCPUN_META_GRAPH_VERSION", "CCPUN_META_GRANTED_SCOPES", "CCPUN_META_PAGE_ID"],
  agentCallbacks: ["CCPUN_AGENT_OS_N8N_TOKEN"], exportCallbacks: ["CCPUN_EXPORT_N8N_TOKEN"],
  googleSheetTrigger: ["CCPUN_N8N_EXPORT_WEBHOOK_URL", "CCPUN_N8N_EXPORT_WEBHOOK_TOKEN"],
  lineCrypto: ["CCPUN_LINE_IDENTITY_HMAC_KEY_V1", "CCPUN_LINE_ENCRYPTION_KEY_V1", "CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION"],
  lineIngress: ["LINE_CHANNEL_SECRET"], lineRichMenu: ["CCPUN_LINE_CHANNEL_ACCESS_TOKEN"],
  driveInteractive: ["NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_OAUTH_CLIENT_ID", "NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_PICKER_API_KEY", "NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_APP_ID", "CCPUN_GOOGLE_DRIVE_ADMIN_ROOT_FOLDER_ID", "CCPUN_GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID"],
} as const;
export const OPS_FLAGS = {
  CCPUN_LOCAL_AI_ENABLED: "true", CCPUN_LOCAL_AI_N8N_ENABLED: "true",
  CCPUN_SOCIAL_OPERATIONS_ENABLED: "1", CCPUN_SOCIAL_PROVIDER_READS_ENABLED: "1",
  CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED: "1", CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED: "1",
  CCPUN_AGENT_OS_N8N_ENABLED: "true", CCPUN_EXPORT_N8N_ENABLED: "true", CCPUN_EXPORT_GOOGLE_SHEET_ENABLED: "true",
  CCPUN_LINE_MEDIA_FETCH_ENABLED: "true", CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED: "true",
  CCPUN_LINE_SYSTEM_DELIVERY_ENABLED: "true", CCPUN_LINE_RICH_MENU_PROVIDER_ENABLED: "true",
  CCPUN_LINE_OUTBOUND_ENABLED: "true", CCPUN_LINE_CAMPAIGN_SEND_ENABLED: "true",
  CCPUN_LINE_TRANSCRIPT_ENABLED: "true", CCPUN_MEDIA_LIBRARY_ENABLED: "1",
} as const;
type Variables = Record<string, string | undefined>;
type Identity = Parameters<typeof migrationOwnerPost>[1];
function demand(value: unknown): asserts value { if (!value) throw new Error("OPS_TRANSFER_DENIED"); }
function text(value: unknown): asserts value is string {
  demand(typeof value === "string" && value === value.trim() && value.length > 0
    && value.length <= 16384 && !/[\x00-\x1f\x7f]/.test(value));
}
export function selectOps(variables: Variables) {
  const sections: Record<string, Record<string, string>> = {};
  for (const [name, fields] of Object.entries(OPS_FIELDS)) {
    const names: readonly string[] = ["lineCrypto", "localAiCrypto"].includes(name) && variables[name === "lineCrypto" ? "CCPUN_LINE_ENCRYPTION_KEY_V2" : "CCPUN_LOCAL_AI_ENCRYPTION_KEY_V2"]
      ? [...fields, name === "lineCrypto" ? "CCPUN_LINE_ENCRYPTION_KEY_V2" : "CCPUN_LOCAL_AI_ENCRYPTION_KEY_V2"] : fields;
    const values = names.map(key => [key, variables[key]] as const);
    if (!values.some(([, value]) => value !== undefined && value !== "")) continue;
    for (const [, value] of values) text(value);
    sections[name] = Object.fromEntries(values) as Record<string, string>;
  }
  const activation: Record<string, boolean> = {};
  for (const [key, enabled] of Object.entries(OPS_FLAGS)) {
    // Preserve the application's exact existing boolean interpretation, including absent = off.
    activation[key] = variables[key]?.trim() === enabled;
  }
  demand(Object.keys(sections).length > 0);
  if (sections.lineIngress || sections.lineRichMenu) demand(sections.lineCrypto);
  if (sections.lineCrypto) demand(["1", "2"].includes(sections.lineCrypto.CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION)
    && (sections.lineCrypto.CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION !== "2" || sections.lineCrypto.CCPUN_LINE_ENCRYPTION_KEY_V2));
  return { sections, activation };
}
export function opsAccess(request: Request, identity: Identity, variables: Variables, config: OpsTransferConfig, now: number) {
  const owner = migrationOwnerPost(request, identity, variables);
  demand(config.enabled && /^[a-f0-9]{64}$/.test(config.ownerActorSha256)
    && owner.ownerActorSha256 === config.ownerActorSha256);
  demand(/^[a-f0-9]{32}$/.test(config.transferId) && /^[a-f0-9]{64}$/.test(config.recipientFingerprint)
    && /^[a-f0-9]{40}$/.test(config.targetSha) && /^[a-f0-9]{64}$/.test(config.lockSha256));
  demand(Number.isSafeInteger(now) && Number.isSafeInteger(config.preparedAt) && Number.isSafeInteger(config.profileExpiresAt)
    && config.preparedAt <= now && now < config.profileExpiresAt && config.profileExpiresAt - config.preparedAt <= 86400);
  const key = createPublicKey(config.recipientPublicKeyPem);
  demand(key.asymmetricKeyType === "rsa" && key.asymmetricKeyDetails?.modulusLength === 3072
    && createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("hex") === config.recipientFingerprint);
  return { schemaVersion: 1, kind: "ccpun-ops-migration", transferId: config.transferId,
    recipientFingerprint: config.recipientFingerprint, sourceProjectId: owner.sourceProjectId,
    sourceRef: owner.sourceRef, exporterSha: owner.exporterSha, deploymentHost: owner.deploymentHost,
    targetSha: config.targetSha, lockSha256: config.lockSha256, issuedAt: now,
    expiresAt: Math.min(now + 900, config.profileExpiresAt) };
}
export function encryptOps(metadata: ReturnType<typeof opsAccess>, config: OpsTransferConfig, variables: Variables) {
  const plaintext = Buffer.from(JSON.stringify(selectOps(variables)));
  demand(plaintext.length <= 60000);
  const key = randomBytes(32), iv = randomBytes(12);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(JSON.stringify(metadata)));
    return { metadata, wrappedKey: publicEncrypt({ key: config.recipientPublicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key).toString("base64"),
      iv: iv.toString("base64"), ciphertext: Buffer.concat([cipher.update(plaintext), cipher.final()]).toString("base64"),
      tag: cipher.getAuthTag().toString("base64") };
  } finally { plaintext.fill(0); key.fill(0); }
}
