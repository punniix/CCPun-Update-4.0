import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  LinePrivateKeyUnavailableError,
  createLineContentCrypto,
  createLinePrivateCrypto,
} from "../../lib/line/private-crypto";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const key1 = Buffer.alloc(32, 11).toString("base64");
const key2 = Buffer.alloc(32, 22).toString("base64");
const hmac = Buffer.alloc(32, 33).toString("base64");

function sourceBody(sql: string) {
  return sql.split("-- checksum-source-begin\n", 2)[1]?.split("-- checksum-source-end", 1)[0] ?? "";
}

test("V1 ciphertext remains decryptable under the original AAD contract", () => {
  const v1 = createLineContentCrypto({
    CCPUN_LINE_ENCRYPTION_KEY_V1: key1,
    CCPUN_LINE_ENCRYPTION_KEY_V2: key2,
  });
  const encrypted = v1.encrypt("legacy-value", "message-content");
  assert.equal(encrypted.keyVersion, 1);
  const dual = createLineContentCrypto({
    CCPUN_LINE_ENCRYPTION_KEY_V1: key1,
    CCPUN_LINE_ENCRYPTION_KEY_V2: key2,
    CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION: "2",
  });
  assert.equal(dual.decrypt(encrypted, "message-content"), "legacy-value");
});

test("V2 encryption is explicit and decrypts only with exact stored version key", () => {
  const crypto = createLineContentCrypto({
    CCPUN_LINE_ENCRYPTION_KEY_V1: key1,
    CCPUN_LINE_ENCRYPTION_KEY_V2: key2,
    CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION: "2",
  });
  const encrypted = crypto.encrypt("rotated-value", "line-user-id");
  assert.equal(encrypted.keyVersion, 2);
  assert.equal(crypto.decrypt(encrypted, "line-user-id"), "rotated-value");

  const adminV2Only = createLineContentCrypto({
    CCPUN_LINE_ENCRYPTION_KEY_V2: key2,
    CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION: "2",
  });
  assert.equal(adminV2Only.decrypt(encrypted, "line-user-id"), "rotated-value");
});

test("active version defaults to V1 and invalid/missing active keys fail closed", () => {
  assert.equal(createLineContentCrypto({ CCPUN_LINE_ENCRYPTION_KEY_V1: key1 }).keyVersion, 1);
  assert.throws(
    () => createLineContentCrypto({
      CCPUN_LINE_ENCRYPTION_KEY_V2: key2,
      CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION: "1",
    }),
    /LINE_PRIVATE_CRYPTO_UNAVAILABLE/,
  );
  assert.throws(
    () => createLineContentCrypto({
      CCPUN_LINE_ENCRYPTION_KEY_V1: key1,
      CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION: "2",
    }),
    /LINE_PRIVATE_CRYPTO_UNAVAILABLE/,
  );
  assert.throws(
    () => createLineContentCrypto({
      CCPUN_LINE_ENCRYPTION_KEY_V1: key1,
      CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION: "3",
    }),
    /LINE_PRIVATE_ACTIVE_KEY_VERSION_INVALID/,
  );
});

test("missing old key raises a stable version-specific error without guessing", () => {
  const v1 = createLineContentCrypto({ CCPUN_LINE_ENCRYPTION_KEY_V1: key1 });
  const encrypted = v1.encrypt("legacy-value", "message-content");
  const v2Only = createLineContentCrypto({
    CCPUN_LINE_ENCRYPTION_KEY_V2: key2,
    CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION: "2",
  });
  assert.throws(
    () => v2Only.decrypt(encrypted, "message-content"),
    (error: unknown) => error instanceof LinePrivateKeyUnavailableError && error.keyVersion === 1,
  );
});

test("identity lookup digest is stable across encryption-key rotation", () => {
  const v1 = createLinePrivateCrypto({
    CCPUN_LINE_IDENTITY_HMAC_KEY_V1: hmac,
    CCPUN_LINE_ENCRYPTION_KEY_V1: key1,
  });
  const v2 = createLinePrivateCrypto({
    CCPUN_LINE_IDENTITY_HMAC_KEY_V1: hmac,
    CCPUN_LINE_ENCRYPTION_KEY_V2: key2,
    CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION: "2",
  });
  assert.equal(v1.lookupDigest("synthetic-line-id", "line-user-id"), v2.lookupDigest("synthetic-line-id", "line-user-id"));
});

test("UAT and Production key-rotation migrations share one checksum-locked body", () => {
  const uat = read("db/migrations/20260918_line_key_rotation_v2_uat.sql");
  const production = read("db/migrations/20260918_line_key_rotation_v2_production.sql");
  const uatBody = sourceBody(uat);
  const productionBody = sourceBody(production);
  assert.equal(uatBody, productionBody);
  const checksum = createHash("sha256").update(uatBody).digest("hex");
  assert.equal(checksum, "3884446394a191afdfbde544f4b6e887fd996732d6705956ac7fc0efda7fc21d");
  assert.match(uat, new RegExp(`sha256:${checksum}`));
  assert.match(production, new RegExp(`sha256:${checksum}`));
});

test("rotation SQL is identity-bounded, CAS-like, and never rotates unsent/purged content", () => {
  const sql = read("db/migrations/20260918_line_key_rotation_v2_production.sql");
  assert.match(sql, /external_ref_digest=p_identity_digest/);
  assert.match(sql, /LEAST\(GREATEST\(COALESCE\(p_limit,12\),1\),24\)/);
  assert.match(sql, /pi\.key_version=1/);
  assert.match(sql, /m\.provider_message_key_version=1/);
  assert.match(sql, /m\.content_key_version=1/);
  assert.match(sql, /m\.status<>'unsent'/);
  assert.match(sql, /message_tombstone/);
  const apply = sql.match(/CREATE OR REPLACE FUNCTION private_line\.ingress_apply_line_key_rotation[\s\S]*?\$ingress_apply_line_key_rotation\$;/);
  assert.ok(apply);
  assert.doesNotMatch(apply[0], /UPDATE private_line\.outbound_message/);
  assert.doesNotMatch(apply[0], /UPDATE private_line\.advisor_private_note/);
});

test("rotation functions are ingress-only and aggregate status is Admin-only", () => {
  const sql = read("db/migrations/20260918_line_key_rotation_v2_production.sql");
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.ingress_read_line_key_rotation_candidates\(text,integer\) FROM PUBLIC/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.ingress_read_line_key_rotation_candidates\(text,integer\) FROM ccpun_admin_runtime/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private_line\.ingress_read_line_key_rotation_candidates\(text,integer\) TO ccpun_line_ingress/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private_line\.ingress_apply_line_key_rotation\(jsonb\) TO ccpun_line_ingress/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private_line\.admin_read_line_key_rotation_status\(\) TO ccpun_admin_runtime/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.admin_read_line_key_rotation_status\(\) FROM ccpun_line_ingress/);
  assert.doesNotMatch(sql, /GRANT (?:SELECT|INSERT|UPDATE|DELETE) ON (?:TABLE )?private_line\.(?:provider_identity|message|outbound_message|advisor_private_note)(?:\s|;|,)/);
});

test("aggregate rotation status exposes counts only, never ciphertext or identifiers", () => {
  const sql = read("db/migrations/20260918_line_key_rotation_v2_production.sql");
  const match = sql.match(/CREATE OR REPLACE FUNCTION private_line\.admin_read_line_key_rotation_status\(\)[\s\S]*?\$admin_read_line_key_rotation_status\$;/);
  assert.ok(match);
  const returns = match[0].split("LANGUAGE sql", 1)[0];
  assert.doesNotMatch(returns, /record_id|identity_id|lead_id|message_id|ciphertext|nonce|auth_tag|external_ref/);
  assert.match(returns, /total_v1_count bigint/);
  assert.match(returns, /all_v1_zero boolean/);
});

test("web lazy rotation is explicit, V2-only, bounded, best-effort, and never logs private material", () => {
  const source = read("lib/admin/line/private-ingestion.ts");
  assert.match(source, /CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED/);
  assert.match(source, /crypto\.keyVersion !== 2/);
  assert.match(source, /hasKeyVersion\(1\)/);
  assert.match(source, /hasKeyVersion\(2\)/);
  assert.match(source, /ingress_read_line_key_rotation_candidates/);
  assert.match(source, /\[identityDigest, 12\]/);
  assert.match(source, /ingress_apply_line_key_rotation/);
  assert.match(source, /outcome === "accepted"/);
  assert.doesNotMatch(source, /console\.|logger|JSON\.stringify\(candidate\)/);
});

test("Admin mixed-version transcript and private notes degrade per item when V1 is unavailable", () => {
  const control = read("lib/admin/line/control-plane.ts");
  const notes = read("lib/admin/line/advisor-workflow.ts");
  assert.match(control, /legacy_key_unavailable/);
  assert.match(control, /isLinePrivateKeyUnavailableError/);
  assert.match(notes, /legacy_key_unavailable/);
  assert.match(notes, /isLinePrivateKeyUnavailableError/);
});

test("provider paths checkpoint missing keys before any LINE network request and block retry claims", () => {
  const provider = read("lib/admin/line/provider.ts");
  const migration = read("db/migrations/20260918_line_key_rotation_v2_production.sql");
  const decryptCatch = provider.indexOf("isLinePrivateKeyUnavailableError");
  const fetchCall = provider.indexOf("fetchImpl(LINE_PUSH_URL");
  assert.ok(decryptCatch >= 0 && fetchCall > decryptCatch);
  assert.match(provider, /errorClass = keyUnavailable[\s\S]*?"key_unavailable"/);
  assert.match(migration, /COALESCE\(om\.last_error_class,''\) NOT IN \('key_unavailable','unsupported_key_version'\)/);
  assert.match(migration, /COALESCE\(d\.last_error_class,''\) NOT IN \('key_unavailable','unsupported_key_version'\)/);
});

test("rotation source contains no secret values, generic scan endpoint, or provider writes", () => {
  const combined = [
    read("lib/line/private-crypto.ts"),
    read("lib/admin/line/private-ingestion.ts"),
    read("db/migrations/20260918_line_key_rotation_v2_production.sql"),
  ].join("\n");
  assert.doesNotMatch(combined, /https:\/\/api\.line\.me/);
  assert.doesNotMatch(combined, /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|ghp_[A-Za-z0-9]+|sk_live_|AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(combined, /\/api\/.*rotate/i);
});


test("System Health exposes only aggregate rotation state and keeps V1 retirement guarded", () => {
  const helper = read("lib/admin/line/key-rotation.ts");
  const health = read("apps/admin/app/(control-plane)/operations/health/page.tsx");
  assert.match(helper, /admin_read_line_key_rotation_status/);
  assert.doesNotMatch(helper, /customer_id|lead_id|record_id|ciphertext_b64|nonce_b64|auth_tag_b64/);
  assert.match(health, /ความพร้อมของการเข้ารหัส LINE/);
  assert.match(health, /ข้อมูลรุ่นเก่าที่ยังเหลือ/);
  assert.match(health, /ยังไม่ควรถอด/);
  assert.match(health, /ไม่แสดงข้อความ ชื่อลูกค้า หรือค่ากุญแจเข้ารหัส/);
  assert.doesNotMatch(health, /LINE Encryption Rotation|V1 remaining|ciphertext หรือ plaintext/);
});
