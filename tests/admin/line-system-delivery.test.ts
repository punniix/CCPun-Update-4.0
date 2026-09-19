import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  encodeLineSystemMessageIntent,
  isLineArticleDiscoveryJourney,
  parseLineSystemMessageIntent,
} from "../../lib/line/system-delivery";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

function sourceBody(source: string) {
  return source.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0] ?? "";
}

test("system delivery intent is fixed to the three discovery journeys", () => {
  for (const journey of [
    "motor_quote_review",
    "life_health_policy_review",
    "investment_before_you_act",
  ] as const) {
    assert.equal(isLineArticleDiscoveryJourney(journey), true);
    assert.deepEqual(
      parseLineSystemMessageIntent(encodeLineSystemMessageIntent(journey)),
      { kind: "article_discovery", journey },
    );
  }
  assert.equal(isLineArticleDiscoveryJourney("human_handoff"), false);
  assert.equal(parseLineSystemMessageIntent('{"kind":"article_discovery","journey":"human_handoff"}'), null);
  assert.equal(parseLineSystemMessageIntent('{"kind":"raw_message","journey":"motor_quote_review"}'), null);
});

test("system delivery migration is UAT/Production parity and checksum locked", () => {
  const uat = read("db/migrations/20260919_line_system_delivery_v1_uat.sql");
  const production = read("db/migrations/20260919_line_system_delivery_v1_production.sql");
  const uatBody = sourceBody(uat);
  const productionBody = sourceBody(production);
  assert.equal(uatBody, productionBody);
  const checksum = createHash("sha256").update(uatBody).digest("hex");
  assert.equal(checksum, "a3f22b3c32bf72bd7a55c30ce7e9324fc173f018f6a244515962958063f5ab7d");
  assert.match(uat, new RegExp(checksum));
  assert.match(production, new RegExp(checksum));
});

test("system delivery reuses outbound queue without creating discovery leads", () => {
  const sql = sourceBody(read("db/migrations/20260919_line_system_delivery_v1_production.sql"));
  assert.match(sql, /ALTER COLUMN lead_id DROP NOT NULL/);
  assert.match(sql, /message_kind='system_notice'/);
  assert.match(sql, /lead_id IS NULL/);
  assert.match(sql, /advisor_case_id IS NULL/);
  assert.match(sql, /dispatch_token_digest IS NOT NULL/);
  assert.match(sql, /outbound_message_system_delivery_contract/);
  assert.doesNotMatch(sql, /INSERT INTO private_line\.lead\b/);
  assert.doesNotMatch(sql, /INSERT INTO private_line\.advisor_case\b/);
});

test("system delivery functions preserve ingress/admin privilege separation", () => {
  const sql = sourceBody(read("db/migrations/20260919_line_system_delivery_v1_production.sql"));
  assert.match(sql, /ingress_enqueue_line_system_outbound/);
  assert.match(sql, /admin_claim_line_system_outbound/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private_line\.ingress_enqueue_line_system_outbound\(jsonb\)[\s\S]*TO ccpun_line_ingress/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.ingress_enqueue_line_system_outbound\(jsonb\)[\s\S]*FROM PUBLIC,ccpun_admin_runtime/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private_line\.admin_claim_line_system_outbound\(jsonb\)[\s\S]*TO ccpun_admin_runtime/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.admin_claim_line_system_outbound\(jsonb\)[\s\S]*FROM PUBLIC,ccpun_line_ingress/);
  assert.match(sql, /content_unavailable'\) THEN 'retryable'/);
});

test("Web ingress queues only safe encrypted intent and dispatches by one-time capability", () => {
  const source = read("apps/web/lib/line/private-ingestion.ts");
  assert.match(source, /CCPUN_LINE_SYSTEM_DELIVERY_ENABLED/);
  assert.match(source, /encodeLineSystemMessageIntent/);
  assert.match(source, /line-system-message-content/);
  assert.match(source, /lookupDigest\([\s\S]*"system-dispatch"/);
  assert.match(source, /dispatch_token_digest: dispatchTokenDigest/);
  assert.match(source, /ingress_enqueue_line_system_outbound/);
  assert.match(source, /after\(async \(\) =>/);
  assert.match(source, /admin\.ccpun\.com\/api\/internal\/line\/system-delivery\/dispatch/);
  assert.doesNotMatch(source, /CCPUN_LINE_CHANNEL_ACCESS_TOKEN/);
  assert.doesNotMatch(source, /line_user_id|customer_name|policy_number|income|diagnosis/);
});

test("Admin system dispatch endpoint is capability-only, bounded and hidden", () => {
  const route = read("apps/admin/app/api/internal/line/system-delivery/dispatch/route.ts");
  assert.match(route, /outboundId: z\.string\(\)\.uuid\(\)/);
  assert.match(route, /dispatchToken: z\.string\(\)\.regex/);
  assert.match(route, /sendLineSystemOutboundByCapability/);
  assert.match(route, /payload-too-large/);
  assert.match(route, /export function GET\(\)/);
  assert.match(route, /status: 404/);
  assert.doesNotMatch(route, /getAdminIdentity|CCPUN_LINE_CHANNEL_ACCESS_TOKEN|console\./);
});

test("System provider has a separate gate and sends only generated Flex content", () => {
  const provider = read("lib/admin/line/provider.ts");
  assert.match(provider, /CCPUN_LINE_SYSTEM_DELIVERY_ENABLED/);
  assert.match(provider, /claimLineSystemOutbound/);
  assert.match(provider, /line-system-message-content/);
  assert.match(provider, /parseLineSystemMessageIntent/);
  assert.match(provider, /buildPublishedLineArticleFlexMessage/);
  assert.match(provider, /messages: \[message\]/);
  assert.match(provider, /X-Line-Retry-Key/);
  assert.doesNotMatch(provider, /dispatchToken.*console|recipient.*console|intentText.*console/);
});
