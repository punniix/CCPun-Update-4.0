import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { cookieBannerOwner, cookieBannerPredecessorSha, cookieBannerImmediateSha, cookieBannerTimingPredecessor } from '../qa/v5-cookie-banner-timing-proof.mjs';
import { assertProductionCmsOwner, productionCmsDisplaySource, cmsSha } from '../qa/production-cms-source-proof.mjs';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
const source = readFileSync(cookieBannerOwner, 'utf8');

test('C9 admits the complete immediate successor and reconstructs the unchanged frozen predecessor', () => {
  assert.equal(cmsSha(source), cookieBannerImmediateSha);
  const predecessor = cookieBannerTimingPredecessor(cookieBannerOwner, source);
  assert.equal(cmsSha(predecessor), cookieBannerPredecessorSha);
  assert.match(predecessor, /setTimeout\(\(\) => setVisible\(true\), 800\)/);
  assertProductionCmsOwner(cookieBannerOwner, source);
  assert.equal(cookieBannerTimingPredecessor('unowned.tsx', source), source);
  const projected = productionCmsDisplaySource(cookieBannerOwner, source);
  assert.match(projected, /if \(getConsentData\(\) === null\) \{\n      \/\/ eslint-disable-next-line react-hooks\/set-state-in-effect[^\n]*\n      setVisible\(true\);\n    \}/);
  assert.doesNotMatch(projected, /setTimeout|clearTimeout/, 'projection must retain the actual immediate runtime source');
});

test('C9 rejects unrelated mutation, duplicate timing blocks, append drift and storage/event/focus changes', () => {
  for (const mutant of [
    source + '\n// unreviewed drift\n',
    source.replace('      setVisible(true);', '      setVisible(true);\n      setVisible(true);'),
    source.replace('getConsentData() === null', 'getConsentData() !== null'),
    source.replace('saveConsent(', 'void ('),
    source.replace("detail: 'accepted'", "detail: 'rejected'"),
    source.replace('dialog.focus();', 'dialog.blur();'),
    source.replace('essential: true,', 'essential: false,'),
  ]) {
    assert.notEqual(mutant, source);
    assert.equal(cookieBannerTimingPredecessor(cookieBannerOwner, mutant), mutant, 'unknown full source is never normalized');
    assert.throws(() => assertProductionCmsOwner(cookieBannerOwner, mutant));
    assert.throws(() => productionCmsDisplaySource(cookieBannerOwner, mutant));
  }
});

test('the initial mount effect shows a new-user notice synchronously, without a cleanup timer; saved consent stays hidden', () => {
  for (const consent of [null, { analytics: false }, { analytics: true }]) {
    const effects = [], changes = [];
    const Component = loadFixtureModule(cookieBannerOwner, { mocks: new Map([
      ['react', { useState: value => [value, next => changes.push(next)], useRef: () => ({ current: null }), useEffect: effect => effects.push(effect) }],
      ['@/components/ui/PublicCopyProvider', { usePublicCopy: () => () => '' }],
      ['@/lib/cookie-consent', { getConsentData: () => consent, saveConsent: () => assert.fail('mount cannot save consent') }],
    ]) }).default;
    assert.equal(Component(), null, 'initial render remains hidden until the mount effect');
    assert.equal(effects[0](), undefined, 'no timer cleanup is returned');
    assert.deepEqual(changes, consent === null ? [true] : []);
  }
});
