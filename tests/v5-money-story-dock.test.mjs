import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import { moneyStoryDockSources, moneyStoryDockPredecessor } from '../qa/v5-money-story-dock-proof.mjs';
import { assertProductionCmsOwner } from '../qa/production-cms-source-proof.mjs';
const gameFile = 'features/money-story/components/MoneyStoryGame.tsx';
const dockFile = 'components/layout/v5/V5ChatDock.tsx';
const sha = value => createHash('sha256').update(value).digest('hex');
test('C12 exact game/dock inverses retain old sources and reject mutations', () => {
  assert.equal(moneyStoryDockSources[gameFile].before, '96e97b9614a779569cd0da7aafdd839d3379e9d652858551ec29bce7306a4e4c');
  for (const file of [gameFile, dockFile]) {
    const source = readFileSync(file, 'utf8');
    assert.equal(sha(moneyStoryDockPredecessor(file, source)), moneyStoryDockSources[file].before);
    for (const mutated of [source + '\n// drift', source.replace('ccpun:money-story-dock', 'ccpun:unknown-dock')]) {
      assert.equal(moneyStoryDockPredecessor(file, mutated), mutated);
      if (file === gameFile) assert.throws(() => assertProductionCmsOwner(file, mutated));
    }
  }
  assertProductionCmsOwner(gameFile);
  assert.equal(sha(readFileSync('tests/money-story-presentation-parity.test.mjs')), '2fab8aac076c4fe2f2dbe4a1acfbfe1dc0c19beab4f714495b55324bb5644b5b');
});
function hooks(values = []) {
  const effects = [], writes = [];
  let index = 0;
  return { effects, writes, react: { ...React, useState: initial => { const n = index++; return [values[n] ?? initial, value => writes.push([n, value])]; }, useEffect: (effect, deps) => effects.push({ effect, deps }), useMemo: compute => compute(), useCallback: callback => callback, useRef: () => ({ current: null }) } };
}
const baseMocks = () => new Map([
  ['@/components/ui/PublicCopyProvider', { usePublicCopy: defaults => Object.assign(key => defaults[key], { node: key => defaults[key] }) }],
  ['@/lib/analytics', { trackEvent() {} }],
  ['@/lib/cookie-consent', { getConsentData: () => ({ analytics: false, social: false }) }],
  ['../MoneyStory.module.css', { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) }],
]);
test('actual game effect hides on selection/play/final and restores intro/reset/unmount', () => {
  const attributes = new Map();
  let notifications = 0;
  const root = { setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key) };
  const oldDocument = globalThis.document, oldWindow = globalThis.window;
  globalThis.document = { documentElement: root };
  globalThis.window = { dispatchEvent: event => { assert.equal(event.type, 'ccpun:money-story-dock'); notifications++; } };
  try {
    const engine = loadFixtureModule('features/money-story/engine.ts');
    const game = engine.createGame('c12-synthetic', 'gam');
    for (const [name, values, expected] of [
      ['intro', [null, null], false], ['selected', [null, 'gam'], true], ['playing', [game], true],
      ...['win', 'survive', 'lose'].map(status => [status, [{ ...game, status }], true]), ['reset', [null, null], false],
    ]) {
      const h = hooks(values), mocks = baseMocks(); mocks.set('react', h.react);
      const Game = loadFixtureModule(gameFile, { mocks }).default;
      Game({});
      const owned = h.effects.filter(entry => String(entry.effect).includes('data-money-story-dock-hidden'));
      assert.equal(owned.length, 1);
      assert.deepEqual(owned[0].deps, [values[0], values[1] ?? null]);
      const cleanup = owned[0].effect();
      assert.equal(attributes.has('data-money-story-dock-hidden'), expected, name);
      cleanup();
      assert.equal(attributes.has('data-money-story-dock-hidden'), false, name + ' cleanup');
    }
    assert.equal(notifications, 14);
  } finally { globalThis.document = oldDocument; globalThis.window = oldWindow; }
});
test('dock has identical initial SSR markup in enabled and fallback modes', () => {
  for (const enabled of [true, false]) {
    const render = predecessor => {
      const h = hooks(), mocks = baseMocks(); mocks.set('react', h.react);
      mocks.set('./V5ChatLink', { useHydrated: () => false });
      mocks.set('./V5ChatDock.module.css', { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) });
      const source = readFileSync(dockFile, 'utf8');
      const sources = predecessor ? new Map([[dockFile, moneyStoryDockPredecessor(dockFile, source)]]) : new Map();
      const Dock = loadFixtureModule(dockFile, { mocks, sources }).default;
      return renderToStaticMarkup(Dock({ config: { enabled }, context: { pageGroup: 'tool_money_story' }, fallbackHref: 'https://line.me/R/oaMessage/@ccpun/' }));
    };
    assert.equal(render(false), render(true));
    assert.doesNotMatch(render(false).match(/<div class="dock"[^>]*>/)[0], /hidden|inert|aria-hidden/);
  }
});
