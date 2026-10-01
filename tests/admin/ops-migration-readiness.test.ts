import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createLineContentCrypto, createLinePrivateCrypto } from "../../lib/line/private-crypto";
import { migrationOwnerMetadata } from "../../lib/admin/migrations/google-data-transfer";

const dependency = createRequire(process.env.CCPUN_TEST_DEPENDENCY_ROOT
  ? process.env.CCPUN_TEST_DEPENDENCY_ROOT + "/package.json" : import.meta.url);
const ts = dependency("typescript");
type Variables = Record<string, string | undefined>;
type Aggregate = Record<string, unknown> & { state: string };
const source = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
function compile(value: string) {
  return ts.transpileModule(value, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
}
function getter(path: string, name: string) {
  // Exercise the actual existing configuration getters without their provider/DB modules.
  const text = source(path), start = text.indexOf("export function " + name + "(");
  assert.ok(start >= 0);
  const end = text.indexOf("\n}", start); assert.ok(end > start);
  const exported: Record<string, (variables: Variables) => Record<string, boolean>> = {};
  runInNewContext(compile(text.slice(start, end + 2)), { exports: exported, createLineContentCrypto, Boolean, URL });
  return exported[name];
}
const activation = getter("lib/admin/line/document-media.ts", "getLineProviderActivationReadiness");
const delivery = getter("lib/admin/line/provider.ts", "getLineSystemDeliveryProviderReadiness");
const media = getter("lib/admin/line/media-provider.ts", "getLineMediaProviderReadiness");
const env: Variables = {
  AUTH_URL: "https://admin.ccpun.com", VERCEL_ENV: "production",
  VERCEL_PROJECT_ID: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN", VERCEL_GIT_COMMIT_REF: "v4-production",
  VERCEL_GIT_COMMIT_SHA: "ab".repeat(20), VERCEL_URL: "fake-ops-readiness.vercel.app",
  CCPUN_LINE_ENCRYPTION_KEY_V1: Buffer.alloc(32, 1).toString("base64"),
  CCPUN_LINE_ENCRYPTION_KEY_V2: Buffer.alloc(32, 2).toString("base64"),
  CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION: "2", CCPUN_LINE_IDENTITY_HMAC_KEY_V1: "FAKE-HMAC-PRESENCE-ONLY",
  LINE_CHANNEL_SECRET: "FAKE-WEBHOOK-SECRET", CCPUN_LINE_CHANNEL_ACCESS_TOKEN: "FAKE-LINE-TOKEN",
  CCPUN_LINE_SYSTEM_DELIVERY_ENABLED: "true", CCPUN_LINE_RICH_MENU_PROVIDER_ENABLED: "true",
  CCPUN_LINE_MEDIA_FETCH_ENABLED: "true", CCPUN_LINE_OUTBOUND_ENABLED: "true",
  CCPUN_SOCIAL_OPERATIONS_ENABLED: "1", CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED: "0",
  CCPUN_META_ACCESS_TOKEN: "FAKE-META-TOKEN", CCPUN_SOCIAL_DATABASE_URL: "FAKE-PRIVATE-DATABASE",
  NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_OAUTH_CLIENT_ID: "FAKE-DRIVE-CLIENT",
  NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_PICKER_API_KEY: "FAKE-PICKER-KEY", NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_APP_ID: "123",
  CCPUN_GOOGLE_DRIVE_ADMIN_ROOT_FOLDER_ID: "FAKE_ROOT_ADMIN", CCPUN_GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID: "FAKE_ROOT_MEDIA",
  CCPUN_AGENT_OS_N8N_ENABLED: "true", CCPUN_AGENT_OS_N8N_TOKEN: "a".repeat(43),
  CCPUN_EXPORT_N8N_ENABLED: "true", CCPUN_EXPORT_N8N_TOKEN: "b".repeat(43),
  CCPUN_EXPORT_GOOGLE_SHEET_ENABLED: "true", CCPUN_N8N_EXPORT_WEBHOOK_TOKEN: "c".repeat(43),
  CCPUN_N8N_EXPORT_WEBHOOK_URL: "https://n8n.srv908107.hstgr.cloud/webhook/fake-test",
};
const documents = { state: "ready", pendingFetch: 1, pendingUpload: 2, failed: 3, revokeRequired: 4, reconciliationRequired: 5 };
const deliveries = { state: "ready", outboundQueued: 1, outboundLeased: 2, outboundRetryableFailed: 3, outboundDeadLetter: 4, outboundReconciliation: 5,
  campaignQueued: 0, campaignLeased: 0, campaignRetryableFailed: 0, campaignDeadLetter: 0, campaignReconciliation: 0 };
const rotation = { state: "ready", totalV1Count: 7, unsupportedVersionCount: 0, encryptedUnsentCount: 2 };

function mapper(variables: Variables, rows: Aggregate[] = [documents, deliveries, rotation]) {
  let calls = 0;
  const read = (index: number) => async () => { calls++; return rows[index]; };
  const exported: Record<string, (v?: Variables) => any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  runInNewContext(compile(source("lib/admin/migrations/ops-readiness.ts")), {
    exports: exported, process: { env: variables }, URL, Promise, Number,
    require: (name: string) => {
      if (name === "../../line/private-crypto") return { createLinePrivateCrypto };
      if (name === "../line/document-media") return { getLineProviderActivationReadiness: activation, readLineDocumentMediaHealth: read(0) };
      if (name === "../line/provider") return { getLineSystemDeliveryProviderReadiness: delivery };
      if (name === "../line/media-provider") return { getLineMediaProviderReadiness: media };
      if (name === "../line/business-intelligence") return { readLineDeliveryHealth: read(1) };
      if (name === "../line/key-rotation") return { readLineKeyRotationStatus: read(2) };
      if (name === "../social/operations") return { getSocialOperationsRuntimeStatus: () => ({ enabled: variables.CCPUN_SOCIAL_OPERATIONS_ENABLED === "1" }) };
      throw new Error("UNEXPECTED_IMPORT");
    },
    fetch: () => assert.fail("PROVIDER_CALL"), console: { log: () => assert.fail("LOGGING"), error: () => assert.fail("LOGGING") },
  });
  return { opsCapabilityMetadata: exported.opsCapabilityMetadata, readOpsReadiness: exported.readOpsReadiness, calls: () => calls };
}

test("fixed capability metadata projects booleans only and separates queue/read/write gates", () => {
  const value = mapper(env).opsCapabilityMetadata(env);
  for (const section of Object.values(value)) for (const v of Object.values(section as object)) assert.equal(typeof v, "boolean");
  assert.equal(value.line.ingressCryptoReady, false);
  assert.equal(value.line.activeV2, true); assert.equal(value.line.v2Configured, true); assert.equal(value.line.contentCryptoReady, true);
  assert.equal(value.social.queueEnabled, true); assert.equal(value.social.providerWritesEnabled, false);
  assert.equal(value.drive.interactiveConfigured, true); assert.equal(value.drive.persistentCredentialExpected, false);
  assert.equal(value.social.aggregateVerified, false); assert.equal(value.n8n.aggregateVerified, false);
  assert.ok(!JSON.stringify(value).includes("FAKE-"));
});

for (const value of [undefined, "", " ", "yes", "TRUE", "1", "truex"]) test(`malformed boolean switches stay off: ${String(value)}`, () => {
  const v = { ...env, CCPUN_LINE_SYSTEM_DELIVERY_ENABLED: value, CCPUN_LINE_MEDIA_FETCH_ENABLED: value,
    CCPUN_AGENT_OS_N8N_ENABLED: value, CCPUN_EXPORT_N8N_ENABLED: value, CCPUN_EXPORT_GOOGLE_SHEET_ENABLED: value };
  const result = mapper(v).opsCapabilityMetadata(v);
  assert.equal(result.line.systemDeliveryEnabled, false); assert.equal(result.line.mediaFetchEnabled, false);
  assert.equal(result.n8n.agentCallbacksEnabled, false); assert.equal(result.n8n.exportCallbacksEnabled, false); assert.equal(result.n8n.googleSheetTriggerEnabled, false);
});
test("empty/whitespace secrets and token43 boundary remain distinct from enabled flags", () => {
  for (const value of [undefined, "", " ", "x".repeat(42)]) {
    const v = { ...env, CCPUN_AGENT_OS_N8N_TOKEN: value, CCPUN_EXPORT_N8N_TOKEN: value, CCPUN_N8N_EXPORT_WEBHOOK_TOKEN: value };
    const result = mapper(v).opsCapabilityMetadata(v);
    assert.equal(result.n8n.agentCallbacksEnabled, true);
    assert.equal(result.n8n.agentTokenConfigured, false); assert.equal(result.n8n.exportTokenConfigured, false); assert.equal(result.n8n.webhookTokenConfigured, false);
  }
  const v = { ...env, LINE_CHANNEL_SECRET: " ", CCPUN_LINE_CHANNEL_ACCESS_TOKEN: "", CCPUN_META_ACCESS_TOKEN: " " };
  const result = mapper(v).opsCapabilityMetadata(v);
  assert.equal(result.line.webhookSecretPresent, false); assert.equal(result.line.channelTokenPresent, false); assert.equal(result.social.metaTokenPresent, false);
});
test("actual LINE getters reject malformed key/V2 and Drive configuration without crypto/provider operations", () => {
  const v = { ...env, CCPUN_LINE_ENCRYPTION_KEY_V2: "malformed", CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION: "invalid",
    NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_APP_ID: "invalid", CCPUN_GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID: "bad" };
  const value = mapper(v).opsCapabilityMetadata(v);
  assert.equal(value.line.encryptionV2Present, true); assert.equal(value.line.activeVersionValid, false);
  assert.equal(value.line.contentCryptoReady, false); assert.equal(value.line.v2Configured, false);
  assert.equal(value.drive.interactiveConfigured, false);
});
for (const url of [undefined, "", "not-url", "http://other.invalid/", "https://user:password@other.invalid/"]) test(`webhook invalid configuration produces only false: ${String(url)}`, () => {
  const v = { ...env, CCPUN_N8N_EXPORT_WEBHOOK_URL: url };
  assert.equal(mapper(v).opsCapabilityMetadata(v).n8n.webhookConfigured, false);
});
test("existing aggregate readers project exact safe counts, omit all raw records and leave Social/n8n unverified", async () => {
  const m = mapper(env, [{ ...documents, customerId: "FAKE-CUSTOMER", body: "FAKE-PRIVATE-BODY" }, deliveries, rotation]);
  const value = await m.readOpsReadiness(env);
  assert.equal(m.calls(), 3); assert.equal(value.lineDocumentCounts.available, true); assert.equal(value.lineDocumentCounts.counts.pendingFetch, 1);
  assert.equal(value.lineDeliveryCounts.counts.outboundLeased, 2); assert.equal(value.lineCryptoCounts.counts.encryptedUnsentCount, 2);
  assert.ok(!JSON.stringify(value).includes("FAKE-"));
  assert.equal(value.capability.social.aggregateVerified, false); assert.equal(value.capability.n8n.aggregateVerified, false);
});
for (const bad of [{ state: "unavailable" }, { ...documents, pendingFetch: -1 }, { ...documents, pendingFetch: NaN },
  { ...documents, pendingFetch: Number.MAX_SAFE_INTEGER + 1 }, { ...documents, pendingFetch: "0" }]) test("unavailable or invalid counts never become a fake zero", async () => {
  const result = (await mapper(env, [bad, deliveries, rotation]).readOpsReadiness(env)).lineDocumentCounts;
  assert.equal(result.available, false); assert.equal("counts" in result, false);
});
test("fixed env access never enumerates or reads unrelated credentials", () => {
  const forbidden = new Proxy(env, {
    ownKeys: () => assert.fail("ENV_ENUMERATION"),
    get: (target, key) => { assert.ok(typeof key === "string" && key in env || key === "CRON_SECRET"
      || typeof key === "string" && ["CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED", "CCPUN_LINE_CAMPAIGN_SEND_ENABLED", "CCPUN_LINE_TRANSCRIPT_ENABLED",
        "CCPUN_SOCIAL_PROVIDER_READS_ENABLED", "CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED", "CCPUN_META_GRAPH_VERSION", "CCPUN_META_GRANTED_SCOPES", "CCPUN_META_PAGE_ID", "CCPUN_LOCAL_AI_ENABLED", "CCPUN_LOCAL_AI_N8N_ENABLED", "CCPUN_LOCAL_AI_N8N_TOKEN", "CCPUN_LOCAL_AI_ENCRYPTION_KEY_V1", "CCPUN_LOCAL_AI_ENCRYPTION_KEY_V2", "CCPUN_LOCAL_AI_ACTIVE_KEY_VERSION", "CCPUN_MEDIA_LIBRARY_ENABLED"].includes(key));
      return target[key as string]; },
  });
  mapper(forbidden).opsCapabilityMetadata(forbidden);
});
test("actual owner-only GET HTML denies before any aggregate read and never renders secret/job fields", async () => {
  const m = mapper(env); let actor: { actor: string; actorType: string; role: string; authSource: string } | null = {
    actor: "fake-owner@example.invalid", actorType: "human", role: "owner", authSource: "authjs" };
  let variables = { ...env };
  const exported: Record<string, (r: Request) => Promise<Response>> = {};
  runInNewContext(compile(source("apps/admin/app/api/admin/migrations/ops-readiness/route.ts")), {
    exports: exported, Request, Response, process: { get env() { return variables; } },
    require: (name: string) => {
      if (name === "@/lib/admin/identity") return { getAdminIdentity: async () => actor };
      if (name === "@/lib/admin/migrations/google-data-transfer") return { migrationOwnerMetadata };
      if (name === "@/lib/admin/migrations/ops-readiness") return m;
      if (name === "@/lib/admin/migrations/ops-transfer") return {};
      if (name === "@/lib/admin/migrations/ops-transfer-public-config") return { opsTransferConfig: { enabled: false } };
      throw new Error("UNEXPECTED_IMPORT");
    },
  });
  const get = (url = "https://admin.ccpun.com/api/admin/migrations/ops-readiness/") => exported.GET(new Request(url));
  for (const identity of [null, { ...actor, role: "editor" }, { ...actor, actorType: "service" }, { ...actor, authSource: "other" }]) {
    actor = identity; assert.equal((await get()).status, 404); assert.equal(m.calls(), 0);
  }
  actor = { actor: "fake-owner@example.invalid", actorType: "human", role: "owner", authSource: "authjs" };
  for (const change of [{ VERCEL_ENV: "preview" }, { VERCEL_PROJECT_ID: "wrong" }, { VERCEL_GIT_COMMIT_REF: "wrong" },
    { VERCEL_GIT_COMMIT_SHA: "wrong" }, { CCPUN_GIT_SHA: "ff".repeat(20) }, { AUTH_URL: "https://other.invalid" }]) {
    variables = { ...env, ...change }; assert.equal((await get()).status, 404); assert.equal(m.calls(), 0);
  }
  variables = { ...env }; assert.equal((await get("https://other.invalid/")).status, 404); assert.equal(m.calls(), 0);
  const response = await get(), html = await response.text();
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("x-robots-tag")!, /noindex/); assert.match(response.headers.get("content-security-policy")!, /frame-ancestors 'none'/);
  assert.match(html, /id="ccpun-ops-migration-readiness"/); assert.ok(!html.includes("fake-owner")); assert.ok(!html.includes("FAKE-"));
  assert.equal(m.calls(), 3); assert.equal("POST" in exported, true);
});
