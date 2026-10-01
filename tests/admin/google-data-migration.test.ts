import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, createPublicKey, generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";
import { encryptGoogleData, migrationAccess, migrationOwnerMetadata, selectGoogleData } from "../../lib/admin/migrations/google-data-transfer";
import type { GoogleDataMigrationConfig } from "../../lib/admin/migrations/google-data-public-config";
import { googleDataMigrationConfig } from "../../lib/admin/migrations/google-data-public-config";
import { constants, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as transfer from "../../lib/admin/migrations/google-data-transfer";

const recipient = createRequire(import.meta.url)("../../scripts/operator/google-data-migration-recipient.cjs");
const NOW = 1906542000;
const pair = generateKeyPairSync("rsa", { modulusLength: 3072 });
const wrongPair = generateKeyPairSync("rsa", { modulusLength: 3072 });
const pem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
const profile = { schemaVersion: 1, transferId: "ab".repeat(16), recipientPublicKeyPem: pem,
  recipientFingerprint: createHash("sha256").update(pair.publicKey.export({ type: "spki", format: "der" })).digest("hex") };
const fakeOwner = "fake-owner@example.invalid";
const config: GoogleDataMigrationConfig = { enabled: true, ownerActorSha256: createHash("sha256").update(fakeOwner).digest("hex"),
  ...profile, expiresAt: NOW + 600 };
const identity = { actor: fakeOwner, role: "owner", actorType: "human", authSource: "authjs" };
const vars = {
  AUTH_URL: "https://admin.ccpun.com", VERCEL_ENV: "production",
  VERCEL_PROJECT_ID: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN", VERCEL_GIT_COMMIT_REF: "v4-production",
  VERCEL_GIT_COMMIT_SHA: "ba".repeat(20), VERCEL_URL: "ccpun-fake-fixture.vercel.app",
  CCPUN_GOOGLE_DATA_CLIENT_ID: "fake-fixture.apps.googleusercontent.com",
  CCPUN_GOOGLE_DATA_CLIENT_SECRET: "FAKE-SECRET-NOT-A-CREDENTIAL",
  CCPUN_GOOGLE_DATA_REFRESH_TOKEN: "FAKE-REFRESH-NOT-A-CREDENTIAL",
  CCPUN_GSC_SITE_URL: "sc-domain:ccpun.com", CCPUN_GA4_PROPERTY_ID: "123456789",
  AUTH_GOOGLE_SECRET: "FAKE-UNRELATED-MUST-NOT-TRANSFER",
};
function request(origin = "https://admin.ccpun.com", method = "POST", site = "same-origin") {
  return new Request("https://admin.ccpun.com/api/admin/migrations/google-data/", {
    method, headers: { origin, "sec-fetch-site": site },
  });
}
const metadata = migrationAccess(request(), identity, config, vars, NOW);
function fixture() {
  const envelope = encryptGoogleData(metadata, config, vars);
  const serialized = JSON.stringify(envelope);
  const proof = { cipherSha256: recipient.hash(serialized), exporterSha: vars.VERCEL_GIT_COMMIT_SHA,
    deploymentHost: vars.VERCEL_URL, sourceProjectId: vars.VERCEL_PROJECT_ID, sourceRef: "v4-production",
    canonicalOrigin: "https://admin.ccpun.com", ownerAuthenticated: true, tlsVerified: true,
    recipientFingerprint: profile.recipientFingerprint };
  return { envelope, serialized, proof };
}
const privateKey = pair.privateKey.export({ type: "pkcs8", format: "pem" });

test("explicit disabled export always denies even with complete reviewed public pins", () => {
  assert.throws(() => migrationAccess(request(), identity, { ...googleDataMigrationConfig, enabled: false }, vars, NOW));
  assert.throws(() => migrationAccess(request(), identity, { ...config, enabled: false }, vars, NOW));
});
test("release public pins are canonical and explicit activation requires a finite deadline", () => {
  const release: GoogleDataMigrationConfig = googleDataMigrationConfig;
  assert.equal(typeof release.enabled, "boolean");
  assert.ok(Number.isSafeInteger(release.expiresAt) && release.expiresAt >= 0);
  if (release.enabled || release.recipientPublicKeyPem) {
    assert.match(release.ownerActorSha256, /^[a-f0-9]{64}$/);
    assert.match(release.transferId, /^[a-f0-9]{32}$/);
    assert.match(release.recipientFingerprint, /^[a-f0-9]{64}$/);
    const key = createPublicKey(release.recipientPublicKeyPem);
    assert.equal(key.asymmetricKeyType, "rsa");
    assert.equal(key.asymmetricKeyDetails?.modulusLength, 3072);
    assert.equal(key.export({ type: "spki", format: "pem" }).toString(), release.recipientPublicKeyPem);
    assert.equal(createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("hex"), release.recipientFingerprint);
  }
  if (release.enabled) assert.ok(release.expiresAt > 0);
});
for (const [name, change] of Object.entries({
  missing: null, editor: { ...identity, role: "editor" }, machine: { ...identity, actorType: "service" },
  otherOwner: { ...identity, actor: "other@example.invalid" }, otherAuth: { ...identity, authSource: "other" },
})) test(`owner boundary rejects ${name}`, () => assert.throws(() => migrationAccess(request(), change, config, vars, NOW)));
for (const [name, req] of Object.entries({ crossOrigin: request("https://other.invalid"),
  absentOrigin: request(""), crossSite: request("https://admin.ccpun.com", "POST", "cross-site"),
  alias: new Request("https://alias.vercel.app/api/admin/migrations/google-data/"),
  query: new Request("https://admin.ccpun.com/api/admin/migrations/google-data/?key=evil"),
})) test(`origin boundary rejects ${name}`, () => assert.throws(() => migrationAccess(req, identity, config, vars, NOW)));
for (const [name, change] of Object.entries({ web: { VERCEL_PROJECT_ID: "prj_dxwjITkd0av5QiJQv2snUlIASUWu" },
  preview: { VERCEL_ENV: "preview" }, branch: { VERCEL_GIT_COMMIT_REF: "other" },
  spoofSha: { CCPUN_GIT_SHA: "aa".repeat(20) }, spoofRelease: { CCPUN_RELEASE_ID: "fake" },
  wrongAuthOrigin: { AUTH_URL: "https://other.invalid" }, native: { CCPUN_DEPLOYMENT_PROVIDER: "hostinger" },
})) test(`deployment boundary rejects ${name}`, () => assert.throws(() => migrationAccess(request(), identity, config, { ...vars, ...change }, NOW)));
for (const [name, change] of Object.entries({ disabled: { enabled: false }, expired: { expiresAt: NOW },
  longWindow: { expiresAt: NOW + 901 }, wrongFingerprint: { recipientFingerprint: "aa".repeat(32) },
  wrongNonce: { transferId: "x" }, emptyOwner: { ownerActorSha256: "" },
  wrongOwnerHash: { ownerActorSha256: "aa".repeat(32) },
})) test(`public profile rejects ${name}`, () => assert.throws(() => migrationAccess(request(), identity, { ...config, ...change }, vars, NOW)));
test("GET uses owner boundary without requiring POST Origin", () => assert.equal(migrationAccess(request("", "GET"), identity, config, vars, NOW).exporterSha, vars.VERCEL_GIT_COMMIT_SHA));
test("exact actor digest normalizes trim/lowercase without public email pin", () => {
  assert.equal(migrationAccess(request(), { ...identity, actor: "  FAKE-OWNER@EXAMPLE.INVALID  " }, config, vars, NOW).exporterSha, vars.VERCEL_GIT_COMMIT_SHA);
  assert.equal("ownerActor" in config, false);
  assert.equal("ownerActor" in googleDataMigrationConfig, false);
});
test("metadata discovery is GET-only and independent of disabled export/key/time pins", () => {
  const result = migrationOwnerMetadata(request("", "GET"), { ...identity, actor: "  FAKE-OWNER@EXAMPLE.INVALID  " }, vars);
  assert.deepEqual(Object.keys(result).sort(), ["deploymentHost", "exporterSha", "ownerActorSha256", "sourceProjectId", "sourceRef"]);
  assert.equal(result.ownerActorSha256, config.ownerActorSha256);
  assert.ok(!JSON.stringify(result).includes(fakeOwner));
  assert.throws(() => migrationAccess(request(), identity, { ...googleDataMigrationConfig, enabled: false }, vars, NOW));
  assert.throws(() => migrationOwnerMetadata(request(), identity, vars));
  assert.throws(() => migrationOwnerMetadata(request("", "GET"), { ...identity, actor: " " }, vars));
});
test("roundtrip stages dedicated five-field pack and distinct actual exporter SHA", () => {
  const { serialized, proof } = fixture();
  assert.ok(!serialized.includes(vars.CCPUN_GOOGLE_DATA_CLIENT_SECRET));
  assert.ok(!serialized.includes(vars.CCPUN_GOOGLE_DATA_REFRESH_TOKEN));
  assert.ok(!serialized.includes(vars.AUTH_GOOGLE_SECRET));
  const result = recipient.decrypt(serialized, proof, profile, privateKey, NOW);
  assert.equal(result.gitSha, metadata.targetSha);
  assert.notEqual(metadata.exporterSha, metadata.targetSha);
  assert.deepEqual(result.sections.googleData, { ...selectGoogleData(vars), reuseLoginOAuthClient: false });
});
for (const [name, change] of Object.entries({ owner: { ownerAuthenticated: false }, tls: { tlsVerified: false },
  sha: { exporterSha: "ff".repeat(20) }, project: { sourceProjectId: "other" },
  deployment: { deploymentHost: "other.vercel.app" }, hash: { cipherSha256: "00".repeat(32) },
  recipient: { recipientFingerprint: "00".repeat(32) }, origin: { canonicalOrigin: "https://other.invalid" },
})) test(`independent capture rejects ${name}`, () => {
  const { serialized, proof } = fixture();
  assert.throws(() => recipient.decrypt(serialized, { ...proof, ...change }, profile, privateKey, NOW));
});
for (const name of ["ciphertext", "tag", "iv", "wrappedKey"] as const) test(`authenticated crypto rejects altered ${name}`, () => {
  const { envelope, proof } = fixture(); const bytes = Buffer.from(envelope[name], "base64"); bytes[0] ^= 1;
  const serialized = JSON.stringify({ ...envelope, [name]: bytes.toString("base64") });
  assert.throws(() => recipient.decrypt(serialized, { ...proof, cipherSha256: recipient.hash(serialized) }, profile, privateKey, NOW));
});
test("crypto rejects wrong private key, expiry, future issuance, additional envelope field", () => {
  const { serialized, proof, envelope } = fixture();
  assert.throws(() => recipient.decrypt(serialized, proof, profile, wrongPair.privateKey.export({ type: "pkcs8", format: "pem" }), NOW));
  assert.throws(() => recipient.decrypt(serialized, proof, profile, privateKey, NOW + 600));
  assert.throws(() => recipient.decrypt(serialized, proof, profile, privateKey, NOW - 1));
  const extra = JSON.stringify({ ...envelope, destination: "/evil" });
  assert.throws(() => recipient.decrypt(extra, { ...proof, cipherSha256: recipient.hash(extra) }, profile, privateKey, NOW));
});
test("fixed schema rejects missing/extra/control chars/unapproved resources", () => {
  const values = selectGoogleData(vars);
  const { CCPUN_GOOGLE_DATA_REFRESH_TOKEN: _omitted, ...missing } = values;
  assert.ok(_omitted);
  for (const changed of [missing, { ...values, AUTH_SECRET: "FAKE" }, { ...values, CCPUN_GOOGLE_DATA_CLIENT_SECRET: "bad\n" },
    { ...values, CCPUN_GSC_SITE_URL: "sc-domain:other.invalid" }, { ...values, CCPUN_GA4_PROPERTY_ID: "G-123" }]) {
    assert.throws(() => recipient.pack(changed));
  }
});

// In-memory filesystem only: no actual private key/credential file, provider or network.
function fakeFs() {
  const files = new Map<string, Buffer>([["/private/recipient.json", Buffer.from(JSON.stringify(profile))], ["/private/recipient.pem", Buffer.from(privateKey)]]);
  const fds = new Map<number, string>(); let next = 1;
  function stat(name: string) {
    const dir = name === "/private" || name === "/stage";
    if (!dir && !files.has(name)) throw Object.assign(new Error("absent"), { code: "ENOENT" });
    return { isDirectory: () => dir, isFile: () => !dir, isSymbolicLink: () => false,
      uid: 0, gid: 0, mode: dir ? 0o40700 : 0o100600, nlink: 1, size: files.get(name)?.length ?? 0,
      ino: name.length, dev: 1, mtimeMs: 1, ctimeMs: 1 };
  }
  const opened: string[] = [];
  const positions = new Map<number, number>();
  const io = {
    lstatSync: stat, fstatSync: (fd: number) => stat(fds.get(fd)!),
    openSync: (name: string, flags: number) => {
      opened.push(name);
      if (flags & constants.O_EXCL) { if (files.has(name)) throw new Error("EEXIST"); files.set(name, Buffer.alloc(0)); }
      else assert.ok(files.has(name));
      const fd = next++; fds.set(fd, name); positions.set(fd, 0); return fd;
    },
    readSync: (fd: number, buffer: Buffer, offset: number, length: number) => {
      const bytes = files.get(fds.get(fd)!)!, position = positions.get(fd)!;
      const count = bytes.copy(buffer, offset, position, position + length); positions.set(fd, position + count); return count;
    },
    writeFileSync: (fd: number, bytes: Buffer | string) => files.set(fds.get(fd)!, Buffer.from(bytes)),
    fsyncSync: () => {}, closeSync: (fd: number) => { fds.delete(fd); },
  };
  return { io, files, opened };
}
test("actual consumer durable EXCL claim denies replay and never opens existing packs", () => {
  const { serialized, proof } = fixture(), disk = fakeFs();
  assert.equal(recipient.consume(serialized, proof, NOW, disk.io).accepted, true);
  assert.equal(disk.files.has("/private/accepted.json"), true);
  assert.equal(disk.files.has("/stage/production-admin-ops-pack.json"), true);
  assert.throws(() => recipient.consume(serialized, proof, NOW, disk.io));
  const occupied = fakeFs(); occupied.files.set("/stage/production-admin-ops-pack.json", Buffer.from("DO-NOT-OPEN"));
  assert.throws(() => recipient.consume(serialized, proof, NOW, occupied.io));
  assert.deepEqual(occupied.opened, []);
});
test("untrusted hash denies before key read, nonce claim or stage", () => {
  const { serialized, proof } = fixture(), disk = fakeFs();
  assert.throws(() => recipient.consume(serialized, { ...proof, cipherSha256: "00".repeat(32) }, NOW, disk.io));
  assert.ok(!disk.opened.includes("/private/recipient.pem"));
  assert.equal(disk.files.has("/private/accepted.json"), false);
  assert.equal(disk.files.has("/stage/production-admin-ops-pack.json"), false);
});
test("receiver rejects unsafe metadata, growth and changes during bounded private read", () => {
  for (const changed of [{ uid: 1 }, { gid: 1 }, { nlink: 2 }, { mode: 0o104600 }, { size: 999999 }]) {
    const disk = fakeFs(), original = disk.io.lstatSync;
    disk.io.lstatSync = (name: string) => ({ ...original(name), ...changed });
    assert.throws(() => recipient.readOwned("/private/recipient.pem", 16384, disk.io));
    assert.deepEqual(disk.opened, []);
  }
  const growing = fakeFs(), originalRead = growing.io.readSync;
  growing.io.readSync = (fd, buffer, offset, length) => {
    growing.files.set("/private/recipient.pem", Buffer.alloc(20000, 65));
    return originalRead(fd, buffer, offset, length);
  };
  assert.throws(() => recipient.readOwned("/private/recipient.pem", 16384, growing.io));
  const changed = fakeFs(), originalStat = changed.io.fstatSync; let count = 0;
  changed.io.fstatSync = (fd: number) => ({ ...originalStat(fd), ctimeMs: ++count === 1 ? 1 : 2 });
  assert.throws(() => recipient.readOwned("/private/recipient.pem", 16384, changed.io));
});
test("route performs owner/origin guard before encryption, bounded body, no secret logging", () => {
  const route = readFileSync(new URL("../../apps/admin/app/api/admin/migrations/google-data/route.ts", import.meta.url), "utf8");
  assert.ok(route.indexOf("migrationAccess(request, await getAdminIdentity()") < route.indexOf("JSON.stringify(encryptGoogleData("));
  assert.match(route, /size > 256/); assert.match(route, /confirm=\$\{metadata\.transferId\}/);
  assert.match(route, /private, no-store/); assert.match(route, /frame-ancestors 'none'/);
  assert.doesNotMatch(route, /console\.|fetch\(|CCPUN_GOOGLE_DATA_CLIENT_SECRET|CCPUN_GOOGLE_DATA_REFRESH_TOKEN/);
});

test("actual route GET/POST native form only returns ciphertext; guards deny oversized/origin/editor requests", async () => {
  // Use declared TypeScript's transpiler, sandboxed fake env/auth/config, real route and real crypto.
  const dependencyRequire = createRequire(process.env.CCPUN_TEST_DEPENDENCY_ROOT
    ? process.env.CCPUN_TEST_DEPENDENCY_ROOT + "/package.json" : import.meta.url);
  const ts = dependencyRequire("typescript");
  const source = readFileSync(new URL("../../apps/admin/app/api/admin/migrations/google-data/route.ts", import.meta.url), "utf8");
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let actor: typeof identity | null = identity;
  const publicConfig = { ...config, expiresAt: Math.floor(Date.now() / 1000) + 600 };
  const exported: Record<string, (request: Request) => Promise<Response>> = {};
  runInNewContext(javascript, { exports: exported, require: (name: string) => {
    if (name === "node:crypto") return createRequire(import.meta.url)(name);
    if (name === "@/lib/admin/identity") return { getAdminIdentity: async () => actor };
    if (name === "@/lib/admin/migrations/google-data-public-config") return { googleDataMigrationConfig: publicConfig };
    if (name === "@/lib/admin/migrations/google-data-transfer") return transfer;
    throw new Error("UNEXPECTED_IMPORT");
  }, process: { env: vars }, Response, Request, Buffer });
  const get = await exported.GET(request("", "GET"));
  assert.equal(get.status, 200); assert.match(await get.text(), /<form method="post">/);
  const post = (body = `confirm=${config.transferId}`, origin = "https://admin.ccpun.com") => new Request(request().url, {
    method: "POST", headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/x-www-form-urlencoded" }, body,
  });
  const response = await exported.POST(post());
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
  const html = await response.text();
  assert.match(html, /id="google-data-migration-envelope"/);
  assert.ok(!html.includes(vars.CCPUN_GOOGLE_DATA_CLIENT_SECRET));
  assert.ok(!html.includes(vars.CCPUN_GOOGLE_DATA_REFRESH_TOKEN));
  const envelope = /<pre id="google-data-migration-envelope">(.+)<\/pre>/.exec(html)![1];
  const digest = /id="google-data-migration-envelope-sha">([a-f0-9]{64})/.exec(html)![1];
  assert.equal(recipient.hash(envelope), digest);
  assert.equal((await exported.POST(post("x".repeat(257)))).status, 404);
  assert.equal((await exported.POST(post(undefined, "https://other.invalid"))).status, 404);
  actor = { ...identity, role: "editor" };
  assert.equal((await exported.POST(post())).status, 404);
  publicConfig.enabled = false;
  assert.equal((await exported.GET(request("", "GET"))).status, 404);
  assert.equal((await exported.POST(post())).status, 404);
});

test("actual identity HTML discovers only hash/public provenance and never reads GoogleData or export config", async () => {
  const dependencyRequire = createRequire(process.env.CCPUN_TEST_DEPENDENCY_ROOT
    ? process.env.CCPUN_TEST_DEPENDENCY_ROOT + "/package.json" : import.meta.url);
  const ts = dependencyRequire("typescript");
  const source = readFileSync(new URL("../../apps/admin/app/api/admin/migrations/google-data/identity/route.ts", import.meta.url), "utf8");
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let actor: typeof identity | null = identity;
  let publicVariables: Record<string, string | undefined> = { ...vars };
  const forbiddenReads: string[] = [];
  const guardedVariables = new Proxy({}, { get: (_target, key) => {
    if (typeof key !== "string") throw new Error("UNEXPECTED_ENV_KEY");
    if (key.startsWith("CCPUN_GOOGLE_DATA_") || key === "CCPUN_GSC_SITE_URL" || key === "CCPUN_GA4_PROPERTY_ID") {
      forbiddenReads.push(key); throw new Error("PRIVATE_ENV_READ");
    }
    return publicVariables[key];
  }, ownKeys: () => { throw new Error("ENV_ENUMERATION"); } });
  const exported: Record<string, (request: Request) => Promise<Response>> = {};
  runInNewContext(javascript, { exports: exported, require: (name: string) => {
    if (name === "@/lib/admin/identity") return { getAdminIdentity: async () => actor };
    if (name === "@/lib/admin/migrations/google-data-transfer") return transfer;
    throw new Error("UNEXPECTED_IMPORT");
  }, process: { env: guardedVariables }, Response, Request });
  const get = (url = "https://admin.ccpun.com/api/admin/migrations/google-data/identity/", method = "GET") => exported.GET(new Request(url, { method }));
  const response = await get(), html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.match(response.headers.get("content-security-policy")!, /frame-ancestors 'none'/);
  assert.match(html, new RegExp(`id="google-data-migration-owner-sha256">${config.ownerActorSha256}`));
  assert.ok(!html.includes(fakeOwner)); assert.ok(!html.includes(vars.CCPUN_GOOGLE_DATA_CLIENT_SECRET));
  assert.ok(!html.includes(vars.CCPUN_GOOGLE_DATA_REFRESH_TOKEN));
  assert.doesNotMatch(html, /<form|google-data-migration-envelope/);
  assert.equal("POST" in exported, false);
  for (const change of [null, { ...identity, role: "editor" }, { ...identity, actorType: "service" },
    { ...identity, authSource: "other" }, { ...identity, actor: " " }]) {
    actor = change; assert.equal((await get()).status, 404);
  }
  actor = identity;
  for (const change of [{ VERCEL_ENV: "preview" }, { VERCEL_PROJECT_ID: "prj_dxwjITkd0av5QiJQv2snUlIASUWu" },
    { VERCEL_GIT_COMMIT_REF: "other" }, { VERCEL_GIT_COMMIT_SHA: "not-sha" },
    { CCPUN_GIT_SHA: "aa".repeat(20) }, { CCPUN_RELEASE_ID: "fake" },
    { AUTH_URL: "https://other.invalid" }, { CCPUN_DEPLOYMENT_PROVIDER: "hostinger" }]) {
    publicVariables = { ...vars, ...change }; assert.equal((await get()).status, 404);
  }
  publicVariables = { ...vars };
  assert.equal((await get("https://other.invalid/api/admin/migrations/google-data/identity/")).status, 404);
  assert.equal((await get("https://admin.ccpun.com/api/admin/migrations/google-data/identity/?x=1")).status, 404);
  assert.equal((await get(undefined, "POST")).status, 404);
  assert.deepEqual(forbiddenReads, []);
  assert.doesNotMatch(source, /console\.|fetch\(|google-data-public-config|encryptGoogleData|selectGoogleData/);
});
