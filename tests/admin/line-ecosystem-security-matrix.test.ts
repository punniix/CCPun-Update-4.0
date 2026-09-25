import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { sanitizeEventParams } from "../../lib/analytics";
import { parseLineSafeForAIState } from "../../lib/line/safe-for-ai";
import { parseSafeKnowledgeRequest } from "../../lib/line/safe-knowledge";

const root=path.resolve(import.meta.dirname,"../..");
const read=(file:string)=>readFileSync(path.join(root,file),"utf8");

const privateRuntimeSources=[
  "apps/web/lib/line/webhook-handler.ts",
  "apps/web/lib/line/webhook-ingress.ts",
  "apps/web/lib/line/private-ingestion.ts",
  "apps/web/lib/line/public-event-bridge.ts",
  "lib/admin/line/private-ingestion.ts",
  "lib/admin/line/web-service-auth.ts",
  "apps/admin/app/api/internal/line/ingest-event/route.ts",
  "apps/web/lib/line/safe-knowledge-runtime.ts",
  "apps/web/lib/line/safe-knowledge-metrics.ts",
  "lib/line/private-domain.ts",
  "lib/line/private-crypto.ts",
  "lib/line/safe-for-ai.ts",
  "lib/line/safe-knowledge.ts",
  "lib/line/system-delivery.ts",
  "lib/admin/line/control-plane.ts",
  "lib/admin/line/provider.ts",
  "apps/admin/app/api/internal/line/system-delivery/dispatch/route.ts",
  "lib/admin/line/document-media.ts",
].map(read).join("\n");

test("security matrix: cloud AI raw customer access = 0",()=>{
  const safe=parseLineSafeForAIState({
    journey:"motor_quote_review",
    stage:"waiting_for_advisor",
    material_received:true,
    needs_human:true,
    content_id:"motor_types",
  });
  assert.ok(safe);
  for(const key of [
    "customer_id","lead_id","line_user_id","name","phone","email","message","text",
    "document","file","income","assets","debt","health","medical","policy_number",
  ]){
    assert.equal(parseLineSafeForAIState({...safe,[key]:"forbidden"}),null,key);
  }
  assert.equal(parseSafeKnowledgeRequest({
    question_id:"motor_2plus_vs_3plus",
    journey:"motor_quote_review",
    stage:"entry",
    message:"raw customer text",
  }),null);
  assert.doesNotMatch(privateRuntimeSources, /(?:from|require\()\s*["'](?:openai|@anthropic-ai|ai(?:\/|["']))/i);
  assert.doesNotMatch(privateRuntimeSources, /generateText|streamText|chat\.completions|responses\.create/i);
});

test("security matrix: MCP raw customer access = 0",()=>{
  assert.doesNotMatch(privateRuntimeSources, /@modelcontextprotocol|mcp__|plugin:\/\/|tool_call/i);
  const safeSource=read("lib/line/safe-for-ai.ts");
  assert.doesNotMatch(safeSource,/ciphertext|nonce|auth_tag|external_ref|provider_message|customer_code|phone|email|name/i);
});

test("security matrix: n8n AI customer access = 0 for private LINE runtime",()=>{
  assert.doesNotMatch(privateRuntimeSources,/\bn8n\b|N8N_/i);
  const architecture=read("docs/architecture/line-private-runtime-v1.md");
  assert.match(architecture,/never goes through cloud AI, MCP, n8n AI nodes/i);
  assert.match(architecture,/call a cloud AI SDK, MCP, n8n, analytics, or a client-visible endpoint with private payloads/i);
  const enclave=read("docs/architecture/local-ai-enclave-20260919.md");
  assert.match(enclave,/n8n remains an orchestration consumer around the enclave, not the inference transport/i);
  assert.match(enclave,/must not connect to Ollama, receive ciphertext or hold the encryption key/i);
});

test("security matrix: generic analytics PII = 0",()=>{
  const marker={
    name:"Alice",
    email:"alice@example.invalid",
    phone:"0812345678",
    income:90000,
    assets:5000000,
    debt:120000,
    health:"private",
    policy_number:"P123",
    amount_minor:999999,
    revenue_attributed:"yes",
    line_user_id:"U_PRIVATE",
    message:"raw",
    tool_name:"ci_planning",
    step_number:2,
  };
  const sanitized=sanitizeEventParams(marker);
  assert.deepEqual(sanitized,{tool_name:"ci_planning",step_number:2});
  const analytics=read("lib/analytics.ts");
  assert.doesNotMatch(analytics,/amount_minor|lead_revenue|revenue_attributed|line_user_id|policy_number/i);
});

test("security matrix: PII logs = 0 on private LINE paths",()=>{
  assert.doesNotMatch(privateRuntimeSources,/console\.(?:log|info|warn|error|debug)|logger\.(?:info|warn|error|debug)/i);
  const webhook=read("apps/web/lib/line/webhook-handler.ts");
  assert.match(webhook,/no private content or identifiers are reflected here/);
});

test("security matrix: public DB access = 0 and runtime roles have no raw table grants",()=>{
  const migrations=[
    "db/migrations/20260917_private_line_runtime_v1_production.sql",
    "db/migrations/20260918_line_document_media_activation_v1_production.sql",
    "db/migrations/20260918_line_delivery_activation_v1_production.sql",
    "db/migrations/20260918_line_content_intelligence_v2_production.sql",
    "db/migrations/20260918_line_privacy_retention_v2_production.sql",
    "db/migrations/20260919_line_system_delivery_v1_production.sql",
  ].map(read).join("\n");
  assert.match(migrations,/REVOKE ALL ON SCHEMA private_line FROM PUBLIC/);
  assert.match(migrations,/REVOKE ALL ON ALL TABLES IN SCHEMA private_line FROM PUBLIC/);
  assert.match(migrations,/REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA private_line FROM ccpun_line_ingress/);
  assert.doesNotMatch(migrations,/GRANT (?:SELECT|INSERT|UPDATE|DELETE) ON (?:TABLE )?private_line\.[A-Za-z0-9_]+ TO ccpun_line_ingress/i);
  const webPackage=read("apps/web/package.json");
  const webIngress=read("apps/web/lib/line/private-ingestion.ts");
  assert.doesNotMatch(webPackage,/@neondatabase\/serverless/);
  assert.doesNotMatch(webIngress,/CCPUN_(?:ADMIN|LINE_INGEST)_DATABASE_URL|private_line\.|@neondatabase\/serverless/);
  assert.match(webIngress,/VERCEL_OIDC_TOKEN/);
});

test("security matrix: public Drive customer files = 0",()=>{
  const provider=read("lib/admin/line/customer-drive-provider.ts");
  assert.match(provider,/permission\.type === "user" && permission\.role === "owner"/);
  assert.match(provider,/unsafe_permissions/);
  assert.match(provider,/GOOGLE_DRIVE_FILE_SCOPE/);
  assert.doesNotMatch(provider,/type:\s*["']anyone["']|role:\s*["']reader["']|permissions\.create|anyoneWithLink/i);
  const foundation=read("lib/admin/media/google-drive-foundation.ts");
  assert.match(foundation,/refreshTokenPersistence: z\.literal\("forbidden"\)/);
  assert.match(foundation,/tokenPersistence: z\.literal\("memory-only"\)/);
});

test("security matrix: client-side secret = 0",()=>{
  const clientFacing=[
    read("lib/line/ecosystem.ts"),
    read("lib/line/safe-for-ai.ts"),
    read("lib/line/safe-knowledge.ts"),
    read("apps/admin/app/(control-plane)/analytics/conversions/page.tsx"),
    read("features/admin/line/PrivacyRequestManager.tsx"),
  ].join("\n");
  assert.doesNotMatch(clientFacing,/LINE_CHANNEL_SECRET|CCPUN_LINE_CHANNEL_ACCESS_TOKEN|CCPUN_LINE_ENCRYPTION_KEY|CCPUN_LINE_IDENTITY_HMAC_KEY|CCPUN_ADMIN_DATABASE_URL|CCPUN_LINE_INGEST_DATABASE_URL/);
  assert.doesNotMatch(clientFacing,/NEXT_PUBLIC_(?:LINE|CCPUN_LINE|ADMIN_DATABASE|DATABASE_URL)/);
});

test("security matrix: duplicate webhook = 0 at durable ingress contract",()=>{
  const base=read("db/migrations/20260917_private_line_runtime_v1_production.sql");
  assert.match(base,/event_digest text PRIMARY KEY/);
  assert.match(base,/provider_message_digest text NOT NULL UNIQUE/);
  assert.match(base,/ON CONFLICT \(event_digest\) DO NOTHING/);
  assert.match(base,/ON CONFLICT \(provider_message_digest\) DO NOTHING/);
  assert.match(base,/RETURN QUERY SELECT 'duplicate_event'::text/);
  assert.match(base,/RETURN QUERY SELECT 'duplicate_message'::text/);
});

test("security matrix: duplicate docs from retry = 0",()=>{
  const base=read("db/migrations/20260917_private_line_runtime_v1_production.sql");
  const media=read("db/migrations/20260918_line_document_media_activation_v1_production.sql");
  const drive=read("lib/admin/line/customer-drive-provider.ts");
  assert.match(base,/message_id uuid NOT NULL UNIQUE REFERENCES private_line\.message/);
  assert.match(base,/ON CONFLICT \(message_id\) DO NOTHING/);
  assert.match(media,/upload_idempotency_digest text UNIQUE/);
  assert.match(media,/ON CONFLICT\(document_id\) DO UPDATE/);
  assert.match(drive,/ccpunDocumentDigest/);
  assert.match(drive,/status: "already_stored"/);
  assert.match(drive,/if \(matches\.length > 1\) return \{ ok: false, status: "reconciliation_required" \}/);
});

test("security matrix: provider writes remain human-gated in Production configuration",()=>{
  const rich=read("lib/admin/line/rich-menu-provider.ts");
  const outbound=read("lib/admin/line/provider.ts");
  const media=read("lib/admin/line/media-provider.ts");
  assert.match(rich,/CCPUN_LINE_RICH_MENU_PROVIDER_ENABLED/);
  assert.match(rich,/CCPUN_LINE_CHANNEL_ACCESS_TOKEN/);
  assert.match(outbound,/outboundEnabled/);
  assert.match(outbound,/CCPUN_LINE_SYSTEM_DELIVERY_ENABLED/);
  assert.match(outbound,/claimLineSystemOutbound/);
  assert.match(media,/CCPUN_LINE_MEDIA_FETCH_ENABLED/);
  assert.match(media,/CCPUN_LINE_CHANNEL_ACCESS_TOKEN/);
});
