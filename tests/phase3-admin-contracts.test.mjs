import assert from 'node:assert/strict';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import { assertPhase3AdminContracts, phase3AdminEntries } from '../qa/phase3-admin-contracts-proof.mjs';

const read = file => readFileSync(file, 'utf8');
const digest = source => createHash('sha256').update(source).digest('hex');
const proof = JSON.parse(read('qa/phase3-admin-contracts.json'));
const policies = [
  { file: phase3AdminEntries[0], fn: 'isN8nAgentOsRequestAuthorized', flag: 'CCPUN_AGENT_OS_N8N_ENABLED', token: 'CCPUN_AGENT_OS_N8N_TOKEN' },
  { file: phase3AdminEntries[1], fn: 'isN8nExportRequestAuthorized', flag: 'CCPUN_EXPORT_N8N_ENABLED', token: 'CCPUN_EXPORT_N8N_TOKEN' },
];

function observe(policy, fixture, original) {
  const trace = [];
  const sentinel = fixture.error ?? new Error('synthetic boundary denial');
  const crypto = {
    createHash(algorithm) {
      trace.push(['algorithm', algorithm]);
      if (fixture.throwAt === 'crypto:createHash') throw sentinel;
      const hash = createHash(algorithm);
      const wrapper = {
        update(value) {
          trace.push(['update', value]);
          if (fixture.throwAt === 'crypto:update') throw sentinel;
          hash.update(value); return wrapper;
        },
        digest() {
          if (fixture.throwAt === 'crypto:digest') throw sentinel;
          const result = hash.digest(); trace.push(['digest-bytes', result.length]); return result;
        },
      };
      return wrapper;
    },
    timingSafeEqual(left, right) {
      trace.push(['compare-bytes', left.length, right.length]);
      if (fixture.throwAt === 'crypto:compare') throw sentinel;
      return timingSafeEqual(left, right);
    },
  };
  const loaded = loadFixtureModule(policy.file, {
    sources: original ? new Map(Object.entries(proof.originalSources)) : new Map(),
    mocks: new Map([['node:crypto', crypto]]),
  });
  const env = new Proxy(fixture.env ?? { [policy.flag]: fixture.flag, [policy.token]: fixture.token }, {
    get(target, key) {
      trace.push(['env', key]);
      if (fixture.throwAt === key) throw sentinel;
      return target[key];
    },
  });
  const request = { headers: { get(key) {
    trace.push(['header', key]);
    if (fixture.throwAt === 'header') throw sentinel;
    return fixture.header;
  } } };
  try { return { value: loaded[policy.fn](request, env), trace }; }
  catch (error) { return { error: { name: error.name, message: error.message }, errorRef: error, trace }; }
}

test('both actual auth callers preserve original policy, header order and fixed-digest crypto outcomes', () => {
  const token = 'synthetic-' + 'x'.repeat(64);
  const cases = [
    { flag: undefined, token, header: 'Bearer ' + token },
    { flag: 'false', token, header: 'Bearer ' + token },
    { flag: 'TRUE', token, header: 'Bearer ' + token },
    { flag: ' true ', token, header: 'Bearer ' + token },
    { flag: 'true', token: undefined, header: 'Bearer ' + token },
    { flag: 'true', token: '', header: 'Bearer ' + token },
    { flag: 'true', token: 'x'.repeat(42), header: 'Bearer ' + 'x'.repeat(42) },
    { flag: 'true', token: 'x'.repeat(43), header: 'Bearer ' + 'x'.repeat(43) },
    { flag: 'true', token: '  ' + token + '  ', header: '  Bearer   ' + token + '  ' },
    { flag: 'true', token, header: undefined },
    { flag: 'true', token, header: null },
    { flag: 'true', token, header: '' },
    { flag: 'true', token, header: 'bearer ' + token },
    { flag: 'true', token, header: 'Bearer' },
    { flag: 'true', token, header: 'Bearer ' },
    { flag: 'true', token, header: 'Bearer ' + token },
    { flag: 'true', token, header: 'Bearer ' + token + 'different' },
    { flag: 'true', token: 'ทดสอบ'.repeat(12), header: 'Bearer ' + 'ทดสอบ'.repeat(12) },
    { flag: 'true', token: '😀'.repeat(21) + 'A', header: 'Bearer ' + '😀'.repeat(21) + 'A' },
    { flag: 'true', token: '\u00a0' + token + '\u00a0', header: '\u00a0Bearer ' + token + '\u00a0' },
    { flag: 'true', token: 'x'.repeat(100_000), header: 'Bearer ' + 'x'.repeat(100_000) },
    { flag: 'true', token, header: 123 },
  ];
  for (const policy of policies) {
    for (const fixture of cases) {
      const before = observe(policy, fixture, true);
      const after = observe(policy, fixture, false);
      assert.deepEqual(after, before, policy.fn);
      for (const record of after.trace.filter(item => item[0] === 'algorithm')) assert.equal(record[1], 'sha256');
      for (const record of after.trace.filter(item => item[0] === 'digest-bytes')) assert.equal(record[1], 32);
      for (const record of after.trace.filter(item => item[0] === 'compare-bytes')) assert.deepEqual(record.slice(1), [32, 32]);
    }
    assert.equal(observe(policy, { flag: 'true', token, header: 'Bearer ' + token }, false).value, true);
    assert.equal(observe(policy, { flag: 'true', token, header: 'Bearer ' + token + 'wrong' }, false).value, false);
    assert.equal(observe(policy, { flag: 'false', token, header: null }, false).trace.some(item => item[0] === 'header'), false);
    assert.equal(observe(policy, { flag: 'true', token: undefined, header: null }, false).trace.some(item => item[0] === 'header'), true);
  }
});

test('auth caller failures rethrow the same boundary error object and keep independent flags and tokens', () => {
  for (const policy of policies) {
    for (const throwAt of [policy.flag, policy.token, 'header', 'crypto:createHash', 'crypto:update', 'crypto:digest', 'crypto:compare']) {
      const error = new Error('synthetic getter rejection');
      const fixture = { flag: 'true', token: 's'.repeat(64), header: 'Bearer ' + 's'.repeat(64), throwAt, error };
      const before = observe(policy, fixture, true), after = observe(policy, fixture, false);
      assert.equal(before.errorRef, error);
      assert.equal(after.errorRef, error);
      assert.deepEqual(after, before);
    }
    const other = policies.find(candidate => candidate !== policy);
    for (const env of [
      { [other.flag]: 'true', [other.token]: 's'.repeat(64) },
      { [policy.flag]: 'true', [other.token]: 's'.repeat(64) },
      { [policy.flag]: 'false', [policy.token]: 's'.repeat(64), [other.flag]: 'true', [other.token]: 's'.repeat(64) },
    ]) {
      const fixture = { env, header: 'Bearer ' + 's'.repeat(64) };
      assert.deepEqual(observe(policy, fixture, false), observe(policy, fixture, true));
      assert.equal(observe(policy, fixture, false).value, false);
    }
  }
});

test('frozen Drive fixtures remain exact while the reviewed byte-verification security delta adds only disposal', () => {
  const drive = phase3AdminEntries[2], fixture = 'tests/admin/google-drive-fixtures.ts';
  const currentSource = read(drive);
  assert.equal(proof.currentHashes[drive], '380f5eea690f1a63c5c7be03715995f6073090d0dc41f9808ad1c2e69b878aae');
  assertPhase3AdminContracts(drive, proof.originalHashes[drive]);
  const before = loadFixtureModule(fixture, { sources: new Map([[fixture, 'import { GOOGLE_DRIVE_FOLDER_MIME_TYPE } from "../../lib/admin/media/google-drive-foundation";\n' + proof.driveFixtureBody]]) });
  const after = loadFixtureModule(drive);
  const fixtures = loadFixtureModule(fixture);
  const fixtureNames = ['SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID', 'SYNTHETIC_GOOGLE_DRIVE_FILE_ID', 'SYNTHETIC_GOOGLE_DRIVE_ITEMS'];
  for (const name of fixtureNames) {
    assert.deepEqual(fixtures[name], before[name]);
    assert.equal(Object.hasOwn(after, name), false);
  }
  assert.equal(Object.isFrozen(fixtures.SYNTHETIC_GOOGLE_DRIVE_ITEMS), true);
  // Whole-body immutability is intentionally retired for the approved security repair.
  // Keep the original19 runtime exports and permit only the required cross-module disposal.
  assert.deepEqual(Object.keys(after).sort(), ["GOOGLE_DRIVE_FILE_SCOPE", "GOOGLE_DRIVE_FOLDER_MIME_TYPE", "GOOGLE_DRIVE_SHORTCUT_MIME_TYPE", "GOOGLE_DRIVE_INTERACTIVE_AUTH_MAX_TTL_MS", "MAX_GOOGLE_DRIVE_PROJECTION_BODY_BYTES", "MAX_GOOGLE_DRIVE_BINARY_BYTES", "googleDriveFileIdSchema", "googleDriveRootBoundarySchema", "googleDriveInteractiveAuthorizationSchema", "googleDriveSelectedFileRequestSchema", "googleDriveSelectedFileProjectionSchema", "parseGoogleDriveApprovedRootFolderIds", "validateGoogleDriveProjectionHttpRequest", "evaluateGoogleDriveInteractiveAuthorization", "googleDriveNormalizedItemSchema", "fetchGoogleDriveBoundaryEvidence", "fetchGoogleDriveSelectedFileProjection", "fetchGoogleDriveSelectedFileBinary", "evaluateGoogleDriveRootBoundary", "disposeGoogleDriveSelectedFileBinary"].sort());
  assert(!currentSource.includes('google-drive-fixtures'));
  const runtimeConsumers = spawnSync('git', ['grep', '-l', '-E', 'SYNTHETIC_GOOGLE_DRIVE|google-drive-fixtures', '--', 'lib', 'apps', 'features', 'workers'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert([0, 1].includes(runtimeConsumers.status));
  assert.equal(runtimeConsumers.stdout, '');
});

test('current composition admission rejects wrong baseline, extra scope and resealed body/owner/fixture/evidence drift', () => {
  for (const file of phase3AdminEntries) assert.equal(assertPhase3AdminContracts(file, proof.originalHashes[file]), true);
  assert.throws(() => assertPhase3AdminContracts('unknown.ts', '0'.repeat(64)));
  assert.throws(() => assertPhase3AdminContracts(phase3AdminEntries[0], '0'.repeat(64)));
  const wrongBaseline = structuredClone(proof); wrongBaseline.baseline = 'a'.repeat(40);
  assert.throws(() => assertPhase3AdminContracts(phase3AdminEntries[0], proof.originalHashes[phase3AdminEntries[0]], { proof: wrongBaseline }));
  const extra = structuredClone(proof); extra.currentHashes['unlisted.ts'] = '0'.repeat(64);
  assert.throws(() => assertPhase3AdminContracts(phase3AdminEntries[0], proof.originalHashes[phase3AdminEntries[0]], { proof: extra }));
  for (const [file, transform] of [
    [phase3AdminEntries[0], value => value.replace('CCPUN_AGENT_OS_N8N_ENABLED', 'CCPUN_EXPORT_N8N_ENABLED')],
    ['lib/admin/agent-os/constant-time-bearer.ts', value => value.replace('timingSafeEqual(expectedDigest, suppliedDigest)', 'true')],
    [phase3AdminEntries[2], value => value + '\nexport const extraBoundary = true;\n'],
    ['tests/admin/google-drive-fixtures.ts', value => value.replace('type GoogleDriveNormalizedItem', 'GoogleDriveNormalizedItem')],
  ]) {
    const source = transform(read(file)); assert.notEqual(source, read(file));
    for (const reseal of [false, true]) {
      const modified = structuredClone(proof);
      if (reseal) modified.currentHashes[file] = digest(source);
      assert.throws(() => assertPhase3AdminContracts(phase3AdminEntries[0], proof.originalHashes[phase3AdminEntries[0]], {
        proof: modified, read: path => path === file ? source : read(path),
      }));
    }
  }
  const changedFixtures = structuredClone(proof);
  changedFixtures.driveFixtureBody += "\n";
  const fixturePath = 'tests/admin/google-drive-fixtures.ts';
  const fixtureSource = read(fixturePath) + "\n";
  changedFixtures.currentHashes[fixturePath] = digest(fixtureSource);
  assert.throws(() => assertPhase3AdminContracts(phase3AdminEntries[0], proof.originalHashes[phase3AdminEntries[0]], {
    proof: changedFixtures, read: path => path === fixturePath ? fixtureSource : read(path),
  }), 'frozen synthetic fixtures cannot be resealed alongside a body change');
  const wrongOriginal = structuredClone(proof); wrongOriginal.originalSources[phase3AdminEntries[0]] += '\n';
  assert.throws(() => assertPhase3AdminContracts(phase3AdminEntries[0], proof.originalHashes[phase3AdminEntries[0]], { proof: wrongOriginal }));
  const removedAssertion = read(proof.outputEvidence.file).replace('assert.equal(record[1], 32)', 'void record');
  assert.notEqual(removedAssertion, read(proof.outputEvidence.file));
  for (const reseal of [false, true]) {
    const modified = structuredClone(proof);
    if (reseal) modified.outputEvidence.sha256 = digest(removedAssertion);
    assert.throws(() => assertPhase3AdminContracts(phase3AdminEntries[0], proof.originalHashes[phase3AdminEntries[0]], {
      proof: modified, read: path => path === proof.outputEvidence.file ? removedAssertion : read(path),
    }));
  }
});
