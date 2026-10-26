import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isWebsiteV5ReviewedSuccessor, websiteV5PhaseASources, websiteV5PredecessorDigest, websiteV5ReviewedSuccessors } from '../qa/website-v5-phase-a-proof.mjs';

const file = 'features/money-story/MoneyStory.module.css';
const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const predecessorDigest = '40b39bf243365a0888163b8a3b7dfc2d53f8a37fb92e5802f8fc12e167917a61';

test('C5 exact CSS successor retains every prior dark/legacy declaration and rejects unreviewed drift', () => {
  assert.equal(websiteV5PhaseASources[file].before, predecessorDigest);
  const prior = '47ae0b38b01009cc2a401813ba7b132796c621582f7f5cb53f44dfe12b1f67ca';
  assert.equal(websiteV5PhaseASources[file].after, prior, 'first C5 successor remains frozen');
  assert.equal(websiteV5ReviewedSuccessors[file].before, prior, 'disabled-control correction chains from the reviewed first C5 CSS');
  const disabledRule = ':global(html:not([data-theme="light"])) .root :is(.startActions .primary,.undoButton):disabled { opacity:.85; }\n';
  assert.equal(source.split(disabledRule).length, 2, 'only the exact two-control dark disabled opacity is added');
  assert.equal(sha(source.replace(disabledRule, '')), prior, 'removing exactly the approved disabled rule reconstructs the first C5 successor');
  const marker = '\n/* C5:';
  assert.equal(source.split(marker).length, 2, 'one additive theme/readability block');
  assert.equal(sha(source.slice(0, source.indexOf(marker))), predecessorDigest, 'original CSS bytes remain exact');
  assert.equal(websiteV5PredecessorDigest(file, source), predecessorDigest);
  assert.equal(isWebsiteV5ReviewedSuccessor(file, source), true);
  for (const mutated of [
    source.replace('background:var(--v5-card-alt)', 'background:#000'),
    source.replace('rgba(37,24,24,.72)', 'rgba(37,24,24,.70)'),
    source.replace('.root { --ms-type-caption:14px; }', '.root { --ms-type-caption:12px; }'),
    source.replace('disabled { opacity:.85; }', 'disabled { opacity:.80; }'),
    source + source.slice(source.indexOf(marker)),
  ]) {
    assert.notEqual(mutated, source);
    assert.equal(isWebsiteV5ReviewedSuccessor(file, mutated), false);
    assert.notEqual(websiteV5PredecessorDigest(file, mutated), predecessorDigest);
  }
  assert.equal(isWebsiteV5ReviewedSuccessor('features/money-story/engine.ts', source), false);
});
