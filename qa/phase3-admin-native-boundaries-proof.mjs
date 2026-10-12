import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

const baseline = "308673804f8e565acef100fdc669740fdda964ab";
const originalHashes = {
  "apps/admin/app/api/internal/line/bridge-health/route.ts": "f0b7701b32cb2300f99e84ebba2f83203866887869ecc8f5dcc0d985a8507416",
  "apps/admin/app/api/internal/line/ingest-event/route.ts": "d3efa61b0d34ac1a22be7484bdedab96bf3b67bdf57c2a11416d95c0f18a4896",
  "lib/admin/line/web-service-auth.ts": "05de4c9b8539f84b5360c552646d95cb6123df1a2b16273965176444ae478629",
  "lib/admin/line/web-service-identity.ts": "dd5bf55503a4a28b4cbff8bc47c6c85814a1d2143d7d91381c2f2ad1ae0354c3",
  "lib/admin/environment.ts": "9beb717b5ba3cceac622599ea99e319aa0beeda3abc767046b3990eaf650e1e2",
  "lib/admin/host-routing.ts": "0ce80660f482ac57666f7f28193719ff1b4cc6f265b6fd602c50797f8844dcda",
  "apps/admin/proxy.ts": "c4288da7e1688860aeab91b84ff89c9a002fbd58cf1c2982eefd9e3117bd0e79",
  "lib/admin/social/runtime.ts": "96fdc4aa2bbaaa950dd6f22932b163fcf8c22f72863c2b2fd80420a1dc392fbd",
  "lib/admin/line/private-ingestion.ts": "840878a3d9885b0fc7b0f4834b03d0a18742e1c216b84504598175e550e77d49",
  "lib/admin/migrations/google-data-transfer.ts": "5cd3e26120122582d95bad031706812248a956243afb456ad023b2190fab2a00",
  "lib/admin/operations/foundation.ts": "77ead84133d8d971009df045ff2bb8c83dbe575e188261288f5e77275ff54b9e",
  "lib/admin/seo-intelligence/foundation.ts": "b4b71a0aabcd148658d738ad81abfe614e98416ce4498b253dddba0608b86053",
  "lib/admin/operations/deployment-read-model.ts": "2709f26b904ed5481061d6e5065c16d6cdb563a752517bb0c626de81276bc5e7",
  "lib/admin/operations/article-schedule-contract.ts": "e5dc664e40313fd5fd1b35b9f891ca6087f38e522e46bad563f68063b6870bc8"
};
const currentHashes = {
  "apps/admin/app/api/internal/line/bridge-health/route.ts": "a9d4e5f35c509a2573fd16f26d7b110bee29a022b76869f0f375ca179e22a36f",
  "apps/admin/app/api/internal/line/ingest-event/route.ts": "a4d2f629009f8c17a0892e24f09b6bf86ec34f28fb33a7225cc4f192a84f9e65",
  "lib/admin/line/web-service-auth.ts": null,
  "lib/admin/line/web-service-identity.ts": null,
  "lib/admin/environment.ts": "c6070628a06b0c2b16cbf4b76b6ae58ed51189156f92e1986ceb436e4713869b",
  "lib/admin/host-routing.ts": "d51321ba5ef0061f503e8661b4f8c2d5b8102796b006920096885bffcbf728ab",
  "apps/admin/proxy.ts": "f423de344e00e1219ddb5e2699b4cadf5e6fa8b5d42ce403e371084b3081a7fc",
  "lib/admin/social/runtime.ts": "876ebdfb186af7f23d176c53139505ce846b9907fbd953fb77064fe1e562ee74",
  "lib/admin/line/private-ingestion.ts": "6aa21d9a0fd1c1d62fc7dd5ce0a9a0b3660c3ab19e54bec1c03704e71ab722d7",
  "lib/admin/migrations/google-data-transfer.ts": "476566d3d3092ae17b1dddc76b51cf8131c74f90dae14bf7ffbb51fb838ae789",
  "lib/admin/operations/foundation.ts": "e15f973b4044a224d6a452f69f0a719e777504287198cff1916e7c0b80221e41",
  "lib/admin/seo-intelligence/foundation.ts": "dde8360a4e711fae0e765df2b1ca4528cdc216e48c6a7b595299012e1034bd8e",
  "lib/admin/operations/deployment-read-model.ts": "daea36d68f0cc8a6cd1e9f0756977c284a63d4d4ac050a4a8fb580455fd58bb0",
  "lib/admin/operations/article-schedule-contract.ts": "c0e2bb7d7e15924523a81000e0e7d3e2bc3bdba1d29070d8e00381fea826b392"
};
const outputEvidence = {
  "file": "tests/phase3-admin-native-boundaries.test.mjs",
  "sha256": "eab38acf59f60eed4ec15d28247251f737ef6d2c88c038ef5438e4c90605a7e0"
};
export const phase3AdminNativeEntries = Object.freeze(Object.keys(originalHashes));
const sha = value => createHash('sha256').update(value).digest('hex');

// Explicit current source admissions for retired transport/policy. No old-source reader substitution.
export function assertPhase3AdminNativeBoundaries(file, originalDigest, {
  proof = JSON.parse(readFileSync(new URL('./phase3-admin-native-boundaries.json', import.meta.url), 'utf8')),
  read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8'),
  exists = path => existsSync(new URL('../' + path, import.meta.url)),
} = {}) {
  assert(phase3AdminNativeEntries.includes(file), 'unlisted native retirement admission');
  assert.equal(proof.baseline, baseline);
  assert.deepEqual(proof.originalHashes, originalHashes);
  assert.equal(originalDigest, originalHashes[file]);
  assert.deepEqual(Object.keys(proof.baselineSources), phase3AdminNativeEntries);
  assert.deepEqual(proof.currentHashes, currentHashes, 'reviewed current seals cannot be resealed');
  for (const path of phase3AdminNativeEntries) {
    assert.equal(sha(proof.baselineSources[path]), originalHashes[path], 'own original source identity');
    if (currentHashes[path] === null) assert.equal(exists(path), false, 'retired verifier must be absent');
    else assert.equal(sha(read(path)), currentHashes[path], path);
  }
  const privatePath = 'lib/admin/line/private-ingestion.ts';
  const privateBody = source => source.slice(source.indexOf('function privateEventPayload('));
  assert.equal(privateBody(read(privatePath)), privateBody(proof.baselineSources[privatePath]), 'all native HMAC/SQL/encryption/write bodies remain exact');
  for (const path of phase3AdminNativeEntries.slice(0, 2)) {
    const source = read(path);
    assert(!/web-service|private-ingestion|encrypted-ingest|process\.env|request\./.test(source));
    assert(source.includes('status: 404, headers'));
  }
  const scheduler = 'lib/admin/operations/article-schedule-contract.ts';
  const schemaTail = text => text.slice(text.indexOf('export const scheduleStatusSchema'));
  assert.equal(schemaTail(read(scheduler)), schemaTail(proof.baselineSources[scheduler]), 'all schedule schemas, view/errors/idempotency constants remain exact');
  assert.deepEqual(proof.outputEvidence, outputEvidence, 'registered output assertion seal');
  assert.equal(sha(read(outputEvidence.file)), outputEvidence.sha256);
  return true;
}
