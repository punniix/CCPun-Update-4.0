import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { readFileSync, constants } from "node:fs";
import { createLineContentCrypto, createLinePrivateCrypto } from "../../lib/line/private-crypto";
import { OPS_FIELDS, OPS_FLAGS, opsAccess, selectOps, encryptOps } from "../../lib/admin/migrations/ops-transfer";

const require = createRequire(import.meta.url);
const recipient = require("../../scripts/operator/ops-migration-recipient.cjs");
const consumer = require("../../scripts/operator/ops-pack-consumer.cjs");
const pair = generateKeyPairSync("rsa", { modulusLength: 3072 });
const now = 10000;
const config = { enabled: true, ownerActorSha256: createHash("sha256").update("fake-owner@example.invalid").digest("hex"),
  recipientPublicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
  recipientFingerprint: recipient.hash(pair.publicKey.export({ type: "spki", format: "der" })), transferId: "ab".repeat(16),
  preparedAt: now - 3600, profileExpiresAt: now + 3600, targetSha: recipient.TARGET_SHA, lockSha256: recipient.LOCK };
const profile = { schemaVersion: 1, ...Object.fromEntries(Object.entries(config).filter(([key]) => !["enabled", "ownerActorSha256"].includes(key))) };
const variables: Record<string, string | undefined> = {
  AUTH_URL: "https://admin.ccpun.com", VERCEL_ENV: "production", VERCEL_PROJECT_ID: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
  VERCEL_GIT_COMMIT_REF: "v4-production", VERCEL_GIT_COMMIT_SHA: "cd".repeat(20), VERCEL_URL: "fake-ops-export.vercel.app",
  CRON_SECRET: "FAKE_CRON", CCPUN_LINE_CHANNEL_ACCESS_TOKEN: "FAKE_LINE_TOKEN", LINE_CHANNEL_SECRET: "FAKE_LINE_SECRET",
  CCPUN_LINE_IDENTITY_HMAC_KEY_V1: Buffer.alloc(32, 1).toString("base64"),
  CCPUN_LINE_ENCRYPTION_KEY_V1: Buffer.alloc(32, 2).toString("base64"), CCPUN_LINE_ENCRYPTION_KEY_V2: Buffer.alloc(32, 3).toString("base64"),
  CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION: "2", CCPUN_LINE_MEDIA_FETCH_ENABLED: "true", CCPUN_LINE_RICH_MENU_PROVIDER_ENABLED: "true",
  CCPUN_LOCAL_AI_ENCRYPTION_KEY_V1: Buffer.alloc(32, 4).toString("base64"), CCPUN_LOCAL_AI_ENCRYPTION_KEY_V2: Buffer.alloc(32, 5).toString("base64"),
  CCPUN_LOCAL_AI_ACTIVE_KEY_VERSION: "2", CCPUN_LOCAL_AI_N8N_TOKEN: "z".repeat(43), CCPUN_LOCAL_AI_ENABLED: "true",
  NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_OAUTH_CLIENT_ID: "123-fake.apps.googleusercontent.com",
  NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_PICKER_API_KEY: "FAKE_PICKER", NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_APP_ID: "12345",
  CCPUN_GOOGLE_DRIVE_ADMIN_ROOT_FOLDER_ID: "FAKE_ADMIN_ROOT_123", CCPUN_GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID: "FAKE_MEDIA_ROOT_123",
  CCPUN_MEDIA_LIBRARY_ENABLED: "1", AUTH_GOOGLE_SECRET: "FORBIDDEN_AUTH", CCPUN_GOOGLE_DATA_REFRESH_TOKEN: "FORBIDDEN_DATA",
};
const identity = { actor: "fake-owner@example.invalid", role: "owner", actorType: "human", authSource: "authjs" };
const request = (headers: Record<string, string> = { origin: "https://admin.ccpun.com", "sec-fetch-site": "same-origin" }) =>
  new Request("https://admin.ccpun.com/api/admin/migrations/ops-readiness/", { method: "POST", headers });
const manifest = { schemaVersion: 1, ...consumer.FIXED, gitSha: config.targetSha, lockSha256: config.lockSha256,
  releaseId: "ccpun-native-admin-production-build-bc76ef4f-20261001", capabilityProfile: "full", schedulerBackend: "disabled",
  productionReady: false, platform: "linux", architecture: "x64" };
const expected = { gitSha: config.targetSha, lockSha256: config.lockSha256, releaseId: manifest.releaseId, exportWebhookUrl: null };

test("one fixed Ops roundtrip preserves original historical keys, selected flags and target binding without unrelated data", () => {
  // These private-path operations use an in-memory fake filesystem only.
  const operator = dirname(fileURLToPath(new URL("../../scripts/operator/ops-migration-recipient.cjs", import.meta.url)));
  const files = new Map<string, Buffer>([
    [operator + "/ops-migration-recipient.cjs", readFileSync(operator + "/ops-migration-recipient.cjs")],
    [operator + "/ops-pack-consumer.cjs", readFileSync(operator + "/ops-pack-consumer.cjs")],
    ["/private-ops-transfer/recipient.json", Buffer.from(JSON.stringify(profile))],
    ["/private-ops-transfer/recipient.pem", Buffer.from(pair.privateKey.export({ type: "pkcs8", format: "pem" }))],
    ["/operator/ccpun-native-admin-manifest.json", Buffer.from(JSON.stringify(manifest))],
  ]);
  const directories = new Set(["/private-ops-transfer", "/stage-ops-transfer", "/operator", operator]);
  const handles = new Map<number, { path: string; offset: number }>(); let nextFd = 1, directorySyncs = 0;
  const status = (path: string) => {
    if (!directories.has(path) && !files.has(path)) throw Object.assign(new Error("FAKE_ABSENT"), { code: "ENOENT" });
    const directory = directories.has(path);
    return { isFile: () => !directory, isDirectory: () => directory, isSymbolicLink: () => false,
      uid: 0, gid: 0, mode: directory ? 0o700 : 0o600, nlink: 1, size: files.get(path)?.length ?? 0,
      dev: 1, ino: path.length, mtimeMs: 1, ctimeMs: 1 };
  };
  const io = {
    lstatSync: status,
    openSync(path: string, flags: number) {
      if (flags & constants.O_CREAT) {
        if (files.has(path)) throw Object.assign(new Error("FAKE_EXISTS"), { code: "EEXIST" });
        files.set(path, Buffer.alloc(0));
      } else status(path);
      const fd = nextFd++; handles.set(fd, { path, offset: 0 }); return fd;
    },
    fstatSync(fd: number) { return status(handles.get(fd)!.path); },
    readSync(fd: number, buffer: Buffer, offset: number, length: number) {
      const h = handles.get(fd)!, data = files.get(h.path)!;
      const count = Math.min(length, data.length - h.offset); data.copy(buffer, offset, h.offset, h.offset + count);
      h.offset += count; return count;
    },
    writeFileSync(fd: number, data: Buffer | string) { files.set(handles.get(fd)!.path, Buffer.from(data)); },
    fsyncSync(fd: number) { if (directories.has(handles.get(fd)!.path)) directorySyncs++; },
    closeSync(fd: number) { handles.delete(fd); },
  };
  assert.throws(() => recipient.loadConsumer({ ...io, lstatSync: (path: string) => ({ ...status(path), mode: path === operator ? 0o777 : status(path).mode }) }));
  assert.throws(() => recipient.loadConsumer({ ...io, lstatSync: (path: string) => ({ ...status(path), isSymbolicLink: () => path.endsWith("ops-pack-consumer.cjs") }) }));
  const publicOriginal = files.get(operator + "/ops-pack-consumer.cjs")!;
  files.set(operator + "/ops-pack-consumer.cjs", Buffer.from("INVALID_PUBLIC_SOURCE"));
  assert.throws(() => recipient.loadConsumer(io));
  files.set(operator + "/ops-pack-consumer.cjs", publicOriginal);
  let pairedOpens = 0;
  const checked = recipient.loadConsumer({ ...io, openSync(path: string, flags: number) {
    if (path === operator + "/ops-pack-consumer.cjs") pairedOpens++;
    return io.openSync(path, flags);
  } });
  assert.equal(pairedOpens, 1); assert.equal(checked.CONSTRUCTOR, undefined);
  assert.deepEqual(Object.keys(OPS_FIELDS).sort(), [...recipient.CAPABILITIES].sort());
  assert.deepEqual(Object.keys(OPS_FLAGS).sort(), Object.keys(consumer.FLAG_GROUPS).sort());
  const allowed = new Set([...Object.values(OPS_FIELDS).flat(), "CCPUN_LINE_IDENTITY_HMAC_KEY_V1", "CCPUN_LINE_ENCRYPTION_KEY_V1", "CCPUN_LINE_ENCRYPTION_KEY_V2", "CCPUN_LOCAL_AI_ENCRYPTION_KEY_V2", ...Object.keys(OPS_FLAGS)]);
  const fixed = new Proxy(variables, { ownKeys: () => assert.fail("ENV_ENUMERATION"), get: (target, key) => {
    assert.ok(typeof key === "string" && allowed.has(key)); return target[key]; } });
  const selection = selectOps(fixed);
  assert.ok(!JSON.stringify(selection).includes("FORBIDDEN"));
  const metadata = opsAccess(request(), identity, variables, config, now);
  assert.equal(metadata.expiresAt - metadata.issuedAt, 900);
  const envelope = encryptOps(metadata, config, variables), serialized = JSON.stringify(envelope);
  assert.ok(!serialized.includes("FAKE_LINE"));
  const proof = { cipherSha256: recipient.hash(serialized), exporterSha: metadata.exporterSha, deploymentHost: metadata.deploymentHost,
    sourceProjectId: metadata.sourceProjectId, sourceRef: metadata.sourceRef, canonicalOrigin: "https://admin.ccpun.com",
    ownerAuthenticated: true, tlsVerified: true, recipientFingerprint: config.recipientFingerprint };
  const pack = recipient.decrypt(serialized, proof, profile, pair.privateKey.export({ type: "pkcs8", format: "pem" }), now + 1);
  assert.deepEqual(pack.sections, selection.sections);
  assert.throws(() => recipient.consume(serialized, proof, now + 1,
    { ...io, lstatSync: (path: string) => ({ ...status(path), uid: path === "/operator" ? 1 : 0 }) }));
  const staged = recipient.consume(serialized, proof, now + 1, io);
  assert.equal(staged.accepted, true); assert.equal(staged.productionReady, false); assert.equal(directorySyncs, 3);
  assert.deepEqual(JSON.parse(files.get("/stage-ops-transfer/drive-public-build-config.json")!.toString()),
    Object.fromEntries(OPS_FIELDS.driveInteractive.slice(0, 3).map(name => [name, variables[name]])));
  assert.throws(() => recipient.consume(serialized, proof, now + 1, io));
  assert.equal(handles.size, 0);
  for (const json of ['{"schemaVersion":1,"schemaVersion":1}', '{"key":1,"\\u006bey":2}', '{"nested":{"x":1,"x":2}}'])
    assert.throws(() => consumer.parseJson(json));
  assert.deepEqual(consumer.parseJson('{"left":{"x":1},"right":{"x":2},"values":["x","x"]}'),
    { left: { x: 1 }, right: { x: 2 }, values: ["x", "x"] });
  assert.throws(() => recipient.validateEnvelope(serialized, { ...proof, cipherSha256: "0".repeat(64) }, profile, now));
  assert.throws(() => recipient.validateEnvelope(JSON.stringify({ ...envelope, wrappedKey: "invalid!" }),
    { ...proof, cipherSha256: recipient.hash(JSON.stringify({ ...envelope, wrappedKey: "invalid!" })) }, profile, now));
  recipient.validateProfile({ ...profile, profileExpiresAt: config.preparedAt + 86400 });
  assert.throws(() => recipient.validateProfile({ ...profile, profileExpiresAt: config.preparedAt + 86401 }));
  assert.throws(() => recipient.validateProfile({ ...profile, unexpected: true }));
  assert.throws(() => recipient.readOwned("/private-ops-transfer/recipient.json", 16384,
    { ...io, lstatSync: (path: string) => ({ ...status(path), uid: 1 }) }));
  let stats = 0;
  assert.throws(() => recipient.readOwned("/private-ops-transfer/recipient.json", 16384,
    { ...io, fstatSync: (fd: number) => ({ ...io.fstatSync(fd), ino: ++stats }) }));
  const env = consumer.prepare(pack, manifest, expected, Object.keys(pack.sections));
  assert.equal(env.CCPUN_LINE_ENCRYPTION_KEY_V1, variables.CCPUN_LINE_ENCRYPTION_KEY_V1);
  assert.equal(env.CCPUN_LINE_ENCRYPTION_KEY_V2, variables.CCPUN_LINE_ENCRYPTION_KEY_V2);
  assert.equal(env.CCPUN_LOCAL_AI_ENCRYPTION_KEY_V2, variables.CCPUN_LOCAL_AI_ENCRYPTION_KEY_V2);
  assert.equal(env.CCPUN_LINE_MEDIA_FETCH_ENABLED, "true"); assert.equal(env.CCPUN_LINE_OUTBOUND_ENABLED, "false");
  assert.equal(env.CCPUN_ARTICLE_SCHEDULING_ENABLED, "0"); assert.equal(env.CCPUN_NATIVE_WORKFLOW_ENABLED, "0");
  assert.equal(consumer.prepare(pack, manifest, expected, []).CCPUN_LINE_MEDIA_FETCH_ENABLED, "false");
  for (const mutation of [{ ...pack, gitSha: "ff".repeat(20) }, { ...pack, sections: { ...pack.sections, auth: {} } },
    { ...pack, activation: { ...pack.activation, CCPUN_LINE_OUTBOUND_ENABLED: "true" } },
    { ...pack, sections: { ...pack.sections, lineCrypto: { ...pack.sections.lineCrypto, CCPUN_LINE_ENCRYPTION_KEY_V2: undefined } } }]) {
    assert.throws(() => consumer.prepare(mutation, manifest, expected, Object.keys(mutation.sections)));
  }
  assert.throws(() => recipient.decrypt(serialized, proof, profile, pair.privateKey, metadata.expiresAt));
  assert.throws(() => recipient.decrypt(serialized, { ...proof, ownerAuthenticated: false }, profile, pair.privateKey, now));
  const changed = JSON.stringify({ ...envelope, tag: Buffer.alloc(16).toString("base64") });
  assert.throws(() => recipient.decrypt(changed, { ...proof, cipherSha256: recipient.hash(changed) }, profile, pair.privateKey, now));
  for (const headers of [{} as Record<string, string>, { origin: "null", "sec-fetch-site": "same-origin" }, { origin: "https://admin.ccpun.com", "sec-fetch-site": "cross-site" }])
    assert.throws(() => opsAccess(request(headers), identity, variables, config, now));
  for (const actor of [null, { ...identity, authSource: "header" }, { ...identity, role: "editor" }, { ...identity, actor: "other@example.invalid" }])
    assert.throws(() => opsAccess(request(), actor, variables, config, now));
  for (const setting of [{ ...config, enabled: false }, { ...config, profileExpiresAt: config.preparedAt + 86401 }, { ...config, profileExpiresAt: now }])
    assert.throws(() => opsAccess(request(), identity, variables, setting, now));
  const contentOnly = { ...variables, CCPUN_LINE_ENCRYPTION_KEY_V1: undefined,
    CCPUN_LINE_IDENTITY_HMAC_KEY_V1: undefined, LINE_CHANNEL_SECRET: undefined };
  const v2Selection = selectOps(contentOnly);
  assert.deepEqual(Object.keys(v2Selection.sections.lineCrypto).sort(),
    ["CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION", "CCPUN_LINE_ENCRYPTION_KEY_V2"].sort());
  const v2Pack = recipient.pack(v2Selection);
  const v2Env = consumer.prepare(v2Pack, manifest, expected, Object.keys(v2Pack.sections));
  assert.equal(v2Env.CCPUN_LINE_ENCRYPTION_KEY_V2, variables.CCPUN_LINE_ENCRYPTION_KEY_V2);
  assert.equal(v2Env.CCPUN_LINE_MEDIA_FETCH_ENABLED, "true");
  assert.equal("CCPUN_LINE_ENCRYPTION_KEY_V1" in v2Env, false);
  assert.equal("CCPUN_LINE_IDENTITY_HMAC_KEY_V1" in v2Env, false);
  assert.equal("LINE_CHANNEL_SECRET" in v2Env, false);
  const v2Crypto = createLineContentCrypto(contentOnly);
  assert.equal(v2Crypto.decrypt(v2Crypto.encrypt("FAKE_PROVIDER_ID", "message-provider-id"), "message-provider-id"), "FAKE_PROVIDER_ID");
  assert.throws(() => createLinePrivateCrypto(contentOnly));
  const withOriginalV1 = selectOps({ ...contentOnly, CCPUN_LINE_ENCRYPTION_KEY_V1: variables.CCPUN_LINE_ENCRYPTION_KEY_V1 });
  assert.equal(withOriginalV1.sections.lineCrypto.CCPUN_LINE_ENCRYPTION_KEY_V1, variables.CCPUN_LINE_ENCRYPTION_KEY_V1);
  const historicalV1 = createLineContentCrypto({ ...variables, CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION: "1" })
    .encrypt("FAKE_HISTORICAL_RECORD", "line-user-id");
  const retainedPack = recipient.pack(withOriginalV1);
  const retainedEnv = consumer.prepare(retainedPack, manifest, expected, Object.keys(retainedPack.sections));
  assert.equal(createLineContentCrypto(retainedEnv).decrypt(historicalV1, "line-user-id"), "FAKE_HISTORICAL_RECORD");
  const v1Only = selectOps({ ...contentOnly, CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION: "1",
    CCPUN_LINE_ENCRYPTION_KEY_V1: variables.CCPUN_LINE_ENCRYPTION_KEY_V1, CCPUN_LINE_ENCRYPTION_KEY_V2: undefined });
  assert.equal(recipient.pack(v1Only).sections.lineCrypto.CCPUN_LINE_ENCRYPTION_KEY_V1, variables.CCPUN_LINE_ENCRYPTION_KEY_V1);
  assert.throws(() => selectOps({ ...contentOnly, CCPUN_LINE_ENCRYPTION_KEY_V2: undefined }));
  assert.throws(() => selectOps({ ...contentOnly, LINE_CHANNEL_SECRET: "FAKE_INGRESS_WITHOUT_HMAC" }));
  const invalidIngress = { ...v2Pack, sections: { ...v2Pack.sections, lineIngress: { LINE_CHANNEL_SECRET: "FAKE_INGRESS_WITHOUT_HMAC" } } };
  assert.throws(() => recipient.pack({ sections: invalidIngress.sections, activation: invalidIngress.activation }));
  assert.throws(() => consumer.prepare(invalidIngress, manifest, expected, Object.keys(invalidIngress.sections)));
  const ownerSource = readFileSync(new URL("../../lib/admin/migrations/google-data-transfer.ts", import.meta.url), "utf8");
  assert.match(ownerSource, /request.method === "POST"/); assert.ok(!ownerSource.includes("new Request"));
});
