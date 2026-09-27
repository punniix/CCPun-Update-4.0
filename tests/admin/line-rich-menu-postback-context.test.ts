import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { parseLinePostbackContext } from "../../lib/line/ecosystem";
import { normalizeLinePrivateEvent } from "../../lib/line/private-domain";
import { createLinePrivateCrypto } from "../../lib/line/private-crypto";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

function sourceBody(source: string) {
  return source.split("-- checksum-source-begin\n")[1]?.split("\n-- checksum-source-end")[0] ?? "";
}

function syntheticCrypto() {
  return createLinePrivateCrypto({
    CCPUN_LINE_IDENTITY_HMAC_KEY_V1: Buffer.alloc(32, 7).toString("base64"),
    CCPUN_LINE_ENCRYPTION_KEY_V1: Buffer.alloc(32, 9).toString("base64"),
  });
}

test("Rich Menu postback parser accepts only locked CCPun contexts", () => {
  assert.deepEqual(
    parseLinePostbackContext("journey=motor_quote_review&stage=entry"),
    { journey: "motor_quote_review", stage: "entry", needsHuman: false },
  );
  assert.deepEqual(
    parseLinePostbackContext("journey=human_handoff&stage=waiting_for_advisor"),
    { journey: "human_handoff", stage: "waiting_for_advisor", needsHuman: true },
  );
  assert.deepEqual(
    parseLinePostbackContext("journey=investment_before_you_act&stage=before_switch"),
    { journey: "investment_before_you_act", stage: "before_switch", needsHuman: false },
  );
  assert.equal(parseLinePostbackContext("journey=admin&stage=anything"), null);
  assert.equal(parseLinePostbackContext("PRIVATE_POSTBACK_DATA"), null);
});

test("private LINE normalizer keeps approved context but never retains raw postback data", () => {
  const crypto = syntheticCrypto();
  const known = normalizeLinePrivateEvent({
    webhookEventId: "01POSTBACKKNOWN000000000001",
    type: "postback",
    timestamp: 1789662600000,
    source: { type: "user", userId: "U_SYNTHETIC" },
    postback: { data: "journey=motor_quote_review&stage=entry" },
  }, crypto);
  assert.equal(known.kind, "accepted");
  if (known.kind !== "accepted") return;
  assert.equal(known.event.eventType, "postback");
  assert.deepEqual(known.event.postback, {
    journey: "motor_quote_review",
    stage: "entry",
    needsHuman: false,
  });
  assert.equal(known.event.needsHuman, false);

  const rawUnknown = "PRIVATE_POSTBACK_DATA_MUST_NOT_PERSIST";
  const unknown = normalizeLinePrivateEvent({
    webhookEventId: "01POSTBACKUNKNOWN0000000001",
    type: "postback",
    timestamp: 1789662600000,
    source: { type: "user", userId: "U_SYNTHETIC" },
    postback: { data: rawUnknown },
  }, crypto);
  assert.equal(unknown.kind, "accepted");
  if (unknown.kind !== "accepted") return;
  assert.equal(unknown.event.postback, null);
  assert.doesNotMatch(JSON.stringify(unknown.event), new RegExp(rawUnknown));
});

test("human Rich Menu postback becomes an explicit human request", () => {
  const result = normalizeLinePrivateEvent({
    webhookEventId: "01POSTBACKHUMAN00000000001",
    type: "postback",
    timestamp: 1789662600000,
    source: { type: "user", userId: "U_SYNTHETIC" },
    postback: { data: "journey=human_handoff&stage=waiting_for_advisor" },
  }, syntheticCrypto());
  assert.equal(result.kind, "accepted");
  if (result.kind !== "accepted") return;
  assert.equal(result.event.needsHuman, true);
  assert.equal(result.event.postback?.journey, "human_handoff");
});

test("postback context migration is UAT/Production parity and checksum locked", () => {
  const uat = read("db/migrations/20260918_line_postback_context_v1_uat.sql");
  const production = read("db/migrations/20260918_line_postback_context_v1_production.sql");
  const uatBody = sourceBody(uat);
  const productionBody = sourceBody(production);
  assert.equal(uatBody, productionBody);
  const checksum = createHash("sha256").update(uatBody).digest("hex");
  assert.equal(checksum, "e3f015b5d8cba805d9856333bfedffa1a33cd7f6a87892f69e634fe1f7a6f5ca");
  assert.match(uat, new RegExp(checksum));
  assert.match(production, new RegExp(checksum));
});

test("postback context functions stay ingress-only and accept only approved menu/quick-reply pairs", () => {
  const sql = sourceBody(read("db/migrations/20260918_line_postback_context_v1_production.sql"));
  assert.match(sql, /ingress_apply_line_postback_context/);
  assert.match(sql, /ingress_apply_line_message_context/);
  assert.match(sql, /private_line\.rich_menu_item/);
  assert.match(sql, /private_line\.quick_reply_template/);
  assert.match(sql, /unapproved LINE postback context/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private_line\.ingress_apply_line_postback_context\(jsonb\) TO ccpun_line_ingress/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private_line\.ingress_apply_line_message_context\(jsonb\) TO ccpun_line_ingress/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.ingress_apply_line_postback_context\(jsonb\) FROM PUBLIC,ccpun_admin_runtime/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.ingress_apply_line_message_context\(jsonb\) FROM PUBLIC,ccpun_admin_runtime/);
});

test("web ingestion enriches context after durable ingest without failing webhook persistence", () => {
  const source = read("apps/web/lib/line/private-ingestion.ts");
  assert.match(source, /ingress_apply_line_postback_context/);
  assert.match(source, /ingress_apply_line_message_context/);
  assert.match(source, /applyLineJourneyContextBestEffort/);
  assert.match(source, /Additive context enrichment must never make durable webhook ingestion fail/);
  assert.doesNotMatch(source, /console\.(?:log|info|warn|error|debug)/);
});
