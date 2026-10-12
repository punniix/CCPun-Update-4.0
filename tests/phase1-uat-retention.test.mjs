import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { productionBaselineBytes } from '../qa/phase1-source-proof.mjs';
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
    if (phase2AdminEntries.includes(file)) assert.equal(assertPhase2AdminComposition(file, digest), true, file);
    else if (file === phase2FoundationPath) assert.equal(assertPhase2FoundationSource(file, digest), true, file);
    else assert.equal(sha(productionBaselineBytes(file)), digest, file);
  }
});
