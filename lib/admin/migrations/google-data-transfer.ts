import { constants, createCipheriv, createHash, createPublicKey, publicEncrypt, randomBytes } from "node:crypto";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "../auth-config";
import { CCPUN_VERCEL_PROJECT_IDS, resolveDeploymentIdentity } from "../../runtime/deployment-identity";
import type { GoogleDataMigrationConfig } from "./google-data-public-config";

if (typeof window !== "undefined") throw new Error("MIGRATION_SERVER_ONLY");

export const GOOGLE_DATA_FIELDS = [
  "CCPUN_GOOGLE_DATA_CLIENT_ID", "CCPUN_GOOGLE_DATA_CLIENT_SECRET",
  "CCPUN_GOOGLE_DATA_REFRESH_TOKEN", "CCPUN_GSC_SITE_URL", "CCPUN_GA4_PROPERTY_ID",
] as const;
export const MIGRATION_ORIGIN = "https://admin.ccpun.com";
export const TARGET_SHA = "a1f7a827fcbc56154edcfe35fa6bdcf1f8eccaca";
export const TARGET_LOCK = "96a9011823170ed2953e12b300d6ec039df81de9b548f0848af370a5bb8783cf";
export const MAX_TRANSFER_SECONDS = 900;
type Variables = Record<string, string | undefined>;
type Identity = { actor: string; role: string; actorType: string; authSource: string } | null;

function requireCondition(value: unknown): asserts value {
  if (!value) throw new Error("MIGRATION_DENIED");
}

function ownerDeployment(request: Request, identity: Identity, variables: Variables) {
  requireCondition(identity?.actorType === "human" && identity.authSource === "authjs"
    && identity.role === "owner" && typeof identity.actor === "string"
    && identity.actor.trim().length > 0);
  const url = new URL(request.url);
  requireCondition(url.origin === MIGRATION_ORIGIN && !url.search && !url.hash
    && isConfiguredAdminOrigin(request.url, variables.AUTH_URL));
  if (request.method === "POST") requireCondition(isSameOriginAdminMutation(request.url, request.headers.get("origin"))
    && request.headers.get("origin") === MIGRATION_ORIGIN
    && request.headers.get("sec-fetch-site") === "same-origin");
  requireCondition(request.method === "GET" || request.method === "POST");
  const deployment = resolveDeploymentIdentity(variables, "admin");
  const exporterSha = variables.VERCEL_GIT_COMMIT_SHA;
  const deploymentHost = variables.VERCEL_URL;
  requireCondition(deployment.valid && deployment.provider === "vercel" && deployment.role === "admin"
    && deployment.environment === "production-admin" && variables.VERCEL_ENV === "production"
    && deployment.projectId === CCPUN_VERCEL_PROJECT_IDS.admin
    && variables.VERCEL_GIT_COMMIT_REF === "v4-production" && deployment.gitRef === "v4-production"
    && typeof exporterSha === "string" && /^[a-f0-9]{40}$/.test(exporterSha)
    && deployment.gitSha === exporterSha && deployment.releaseId === exporterSha
    && typeof deploymentHost === "string" && /^[a-z0-9-]+\.vercel\.app$/.test(deploymentHost));
  return {
    ownerActorSha256: createHash("sha256").update(identity.actor.trim().toLowerCase()).digest("hex"),
    exporterSha, deploymentHost, sourceProjectId: CCPUN_VERCEL_PROJECT_IDS.admin, sourceRef: "v4-production",
  };
}

export function migrationOwnerMetadata(request: Request, identity: Identity, variables: Variables) {
  requireCondition(request.method === "GET");
  return ownerDeployment(request, identity, variables);
}

export function migrationAccess(
  request: Request, identity: Identity, config: GoogleDataMigrationConfig,
  variables: Variables, now = Math.floor(Date.now() / 1000),
) {
  requireCondition(config.enabled && /^[a-f0-9]{64}$/.test(config.ownerActorSha256));
  const { ownerActorSha256, exporterSha, deploymentHost } = ownerDeployment(request, identity, variables);
  requireCondition(ownerActorSha256 === config.ownerActorSha256);
  requireCondition(/^[a-f0-9]{32}$/.test(config.transferId) && /^[a-f0-9]{64}$/.test(config.recipientFingerprint)
    && Number.isSafeInteger(config.expiresAt) && config.expiresAt > now
    && config.expiresAt - now <= MAX_TRANSFER_SECONDS);
  const key = createPublicKey(config.recipientPublicKeyPem);
  requireCondition(key.asymmetricKeyType === "rsa" && key.asymmetricKeyDetails?.modulusLength === 3072);
  requireCondition(createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("hex")
    === config.recipientFingerprint);
  return {
    schemaVersion: 1, kind: "ccpun-google-data-migration", transferId: config.transferId,
    recipientFingerprint: config.recipientFingerprint, sourceProjectId: CCPUN_VERCEL_PROJECT_IDS.admin,
    sourceRef: "v4-production", exporterSha, deploymentHost,
    targetSha: TARGET_SHA, lockSha256: TARGET_LOCK, issuedAt: now, expiresAt: config.expiresAt,
  };
}

export function selectGoogleData(variables: Variables) {
  const values = Object.fromEntries(GOOGLE_DATA_FIELDS.map((name) => [name, variables[name]]));
  for (const value of Object.values(values)) requireCondition(typeof value === "string"
    && value === value.trim() && value.length >= 1 && value.length <= 16384 && !/[\x00-\x1f\x7f]/.test(value));
  requireCondition(/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(values.CCPUN_GOOGLE_DATA_CLIENT_ID!));
  requireCondition(/^\d{1,20}$/.test(values.CCPUN_GA4_PROPERTY_ID!));
  requireCondition(["sc-domain:ccpun.com", "https://ccpun.com/", "https://www.ccpun.com/"].includes(values.CCPUN_GSC_SITE_URL!));
  return values;
}

export function encryptGoogleData(
  metadata: ReturnType<typeof migrationAccess>, config: GoogleDataMigrationConfig, variables: Variables,
) {
  const plaintext = Buffer.from(JSON.stringify(selectGoogleData(variables)));
  const key = randomBytes(32), iv = randomBytes(12);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(JSON.stringify(metadata)));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return {
      metadata, wrappedKey: publicEncrypt({ key: config.recipientPublicKeyPem,
        padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key).toString("base64"),
      iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64"),
    };
  } finally { plaintext.fill(0); key.fill(0); }
}
