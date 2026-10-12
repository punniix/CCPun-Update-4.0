import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const phase3AdminEntries = Object.freeze([
  "lib/admin/agent-os/service-auth.ts",
  "lib/admin/agent-os/export-service-auth.ts",
  "lib/admin/media/google-drive-foundation.ts"
]);
const baseline = "a3e212360f01f14c99ec5dad075804514df74b6b";
const originalHashes = {
  "lib/admin/agent-os/service-auth.ts": "2af0cba04816f1630e70b62e6c091102c30194cd841b2e8b15c43c005b0ecdf7",
  "lib/admin/agent-os/export-service-auth.ts": "a20b419ceb94f23fae2f69a95213035f7c15483408abc911236a3fc1d4e7d4b6",
  "lib/admin/media/google-drive-foundation.ts": "0dcccfef9bf68014941d4a4906b1378984879921d0e00774d39acf63f9ff1a6e"
};
const authTemplates = {
  "lib/admin/agent-os/service-auth.ts": "import { constantTimeBearerMatches } from \"./constant-time-bearer\";\n\nexport function isN8nAgentOsRequestAuthorized(\n  request: Request,\n  variables: Record<string, string | undefined> = process.env,\n) {\n  if (variables.CCPUN_AGENT_OS_N8N_ENABLED?.trim() !== \"true\") return false;\n  const expected = variables.CCPUN_AGENT_OS_N8N_TOKEN?.trim();\n  const authorization = request.headers.get(\"authorization\")?.trim();\n  if (!expected || expected.length < 43 || !authorization?.startsWith(\"Bearer \")) return false;\n\n  const supplied = authorization.slice(7).trim();\n  return constantTimeBearerMatches(expected, supplied);\n}\n",
  "lib/admin/agent-os/export-service-auth.ts": "import { constantTimeBearerMatches } from \"./constant-time-bearer\";\n\nexport function isN8nExportRequestAuthorized(\n  request: Request,\n  variables: Record<string, string | undefined> = process.env,\n) {\n  if (variables.CCPUN_EXPORT_N8N_ENABLED?.trim() !== \"true\") return false;\n  const expected = variables.CCPUN_EXPORT_N8N_TOKEN?.trim();\n  const header = request.headers.get(\"authorization\")?.trim();\n  if (!expected || expected.length < 43 || !header?.startsWith(\"Bearer \")) return false;\n  const supplied = header.slice(7).trim();\n  return constantTimeBearerMatches(expected, supplied);\n}\n"
};
const helperPath = 'lib/admin/agent-os/constant-time-bearer.ts';
const helperTemplate = "import { createHash, timingSafeEqual } from \"node:crypto\";\n\n// Callers retain their own flag/token/header policy; only fixed-size comparison is shared.\nexport function constantTimeBearerMatches(expected: string, supplied: string) {\n  const expectedDigest = createHash(\"sha256\").update(expected).digest();\n  const suppliedDigest = createHash(\"sha256\").update(supplied).digest();\n  return timingSafeEqual(expectedDigest, suppliedDigest);\n}\n";
const fixturePath = 'tests/admin/google-drive-fixtures.ts';
const fixturePrefix = "import { GOOGLE_DRIVE_FOLDER_MIME_TYPE, type GoogleDriveNormalizedItem } from \"../../lib/admin/media/google-drive-foundation\";\n\n";
const outputEvidenceHash = 'eb900ef660f75b557b1af4040e8ccfa3157f071fcbab6f9bd22e588ddb5c47f9';
const digest = source => createHash('sha256').update(source).digest('hex');

// Validate admitted CURRENT entries and their owners, never substitute old source
// for a security reader. All other frozen protections remain ordinary digests.
export function assertPhase3AdminContracts(file, expectedOriginalDigest, {
  proof = JSON.parse(readFileSync(new URL('./phase3-admin-contracts.json', import.meta.url), 'utf8')),
  read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8'),
} = {}) {
  assert(phase3AdminEntries.includes(file), 'unlisted Phase 3 admission');
  assert.equal(proof.baseline, baseline);
  assert.deepEqual(proof.originalHashes, originalHashes);
  assert.equal(expectedOriginalDigest, originalHashes[file]);
  assert.deepEqual(Object.keys(proof.originalSources), phase3AdminEntries.slice(0, 2));
  assert.deepEqual(Object.keys(proof.currentHashes), [...phase3AdminEntries, helperPath, fixturePath]);
  for (const [path, hash] of Object.entries(proof.currentHashes)) assert.equal(digest(read(path)), hash, path);
  for (const path of phase3AdminEntries.slice(0, 2)) {
    assert.equal(digest(proof.originalSources[path]), originalHashes[path]);
    assert.equal(read(path), authTemplates[path], 'exact independent caller policies/evaluation order');
  }
  assert.equal(read(helperPath), helperTemplate, 'exact shared fixed SHA-256/timing-safe comparison');
  const drive = phase3AdminEntries[2];
  assert.equal(proof.driveFixtureSeparator, '\n', 'only the fixture boundary separator is moved');
  assert.equal(digest(read(drive) + proof.driveFixtureSeparator + proof.driveFixtureBody), originalHashes[drive], 'all production Drive bodies unchanged');
  assert.equal(read(fixturePath), fixturePrefix + proof.driveFixtureBody, 'exact three synthetic constants, public constant and type-only item import');
  assert(!read(drive).includes('SYNTHETIC_GOOGLE_DRIVE'));
  assert.equal(proof.outputEvidence.file, 'tests/phase3-admin-contracts.test.mjs');
  assert.equal(proof.outputEvidence.sha256, outputEvidenceHash, 'reviewed output assertions cannot be resealed');
  assert.equal(digest(read(proof.outputEvidence.file)), proof.outputEvidence.sha256, 'registered actual-output evidence seal');
  return true;
}
