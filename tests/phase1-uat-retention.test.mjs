import { assertPhase3AdminNativeBoundaries, phase3AdminNativeEntries } from '../qa/phase3-admin-native-boundaries-proof.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { productionBaselineBytes } from '../qa/phase1-source-proof.mjs';
import { assertPhase3AdminContracts, phase3AdminEntries } from '../qa/phase3-admin-contracts-proof.mjs';
import { assertPhase2AdminComposition, phase2AdminEntries } from '../qa/phase2-admin-modularity-proof.mjs';
import { assertPhase2FoundationSource, phase2FoundationPath } from '../qa/phase2-css-source-contract.mjs';
const proof = JSON.parse(readFileSync('qa/phase1-source-ownership.json', 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');

test('own UAT 1f baseline retains every root alias and all P1/private/provider/tracking sources outside exact canonical extraction', () => {
  assert.equal(proof.baseline, '1f19562560e5e2de47cf643a4dbe7f27a9a91348');
  assert.equal(Object.keys(proof.compositions).length, 21);
  assert.equal(Object.keys(proof.owners).length, 22);
  assert.equal(proof.rootAliasCount, 73);
  for (const file of Object.keys(proof.compositions)) assert.ok(file.startsWith('apps/admin/app/'), 'no legacy root or Web entry adoption');
  const root = Object.keys(proof.protected).filter(file => file.startsWith('app/'));
  assert.equal(root.length, 99);
  for (const file of root) assert.equal(sha(readFileSync(file)), proof.protected[file], file + ': root source must stay byte exact');
  assert.equal(Object.keys(proof.protected).length, 764);
  for (const [file, digest] of Object.entries(proof.protected)) {
    if (file === 'scripts/build-provider.mjs') {
      assert.equal(digest, '2368b223e7fb9d8ccbae5f9c44340621346307363766e1a7fe2f8bce0cdc96f9', 'own frozen legacy builder identity');
      assert.equal(existsSync(file), false, 'duplicate legacy dispatcher is retired');
      const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
      assert.equal(scripts['build:hostinger'], 'npm run build --workspace @ccpun/web');
      assert.equal(JSON.parse(readFileSync('apps/web/package.json', 'utf8')).scripts.build, 'node scripts/build-provider.mjs');
      assert.equal(sha(readFileSync('apps/web/scripts/build-provider.mjs')), '35f61f91cbc11bcd463ba1d05d3fa91c5873cbdb7ffc81e53fd1bb44986d3c8e', 'unchanged actual canonical Web builder');
      assert.equal(sha(readFileSync('apps/admin/scripts/build-provider.mjs')), 'e69bcb852a0b4c3dc78c5f06eb96bed78014d74a8c899d05c0c96702069abdd3', 'own native SWC builder unchanged');
      assert.equal(scripts['test:hostinger'], 'node --test tests/hostinger-shadow-config.test.mjs');
      assert.equal(sha(readFileSync('tests/hostinger-shadow-config.test.mjs')), '361a2e85907145b763e6b2611e3a4092957f6f2c76ae8af23da1c2664a96ef32', 'registered real npm workspace cwd and exit0/7 assertions');
    } else if (phase3AdminNativeEntries.includes(file)) assert.equal(assertPhase3AdminNativeBoundaries(file, digest), true, file);
    else if (phase3AdminEntries.includes(file)) assert.equal(assertPhase3AdminContracts(file, digest), true, file);
    else if (phase2AdminEntries.includes(file)) assert.equal(assertPhase2AdminComposition(file, digest), true, file);
    else if (file === phase2FoundationPath) assert.equal(assertPhase2FoundationSource(file, digest), true, file);
    else assert.equal(sha(productionBaselineBytes(file)), digest, file);
  }
});
