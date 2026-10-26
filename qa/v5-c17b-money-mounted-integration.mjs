// Actual React component integration only; this is not compiled-browser or native-device acceptance.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import React from 'react';
import { JSDOM } from 'jsdom';
import { loadFixtureModule } from './phase1-fixture-loader.mjs';

const latest = '7f34e2a305af58f6b138099d2107c47cf773b5b8';
const beforeC17 = '457867b8a487dbb49dcec2d1c02ee26d232947ed';
const dockFile = 'components/layout/v5/V5ChatDock.tsx';
const gameFile = 'features/money-story/components/MoneyStoryGame.tsx';
const proofFile = 'qa/v5-money-story-dock-proof.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const gitSource = (ref, file) => execFileSync('/usr/bin/git', ['show', `${ref}:${file}`], { encoding: 'utf8' });
const original = gitSource(beforeC17, dockFile);
const latestDock = gitSource(latest, dockFile), latestGame = gitSource(latest, gameFile);
const candidate = await readFile(dockFile, 'utf8');
const proofSource = gitSource(latest, proofFile);
const proof = loadFixtureModule(proofFile, { sources: new Map([[proofFile, proofSource]]) });
assert.equal(proof.moneyStoryDockPredecessor(dockFile, latestDock), original);
assert.equal(sha(latestGame), proof.moneyStoryDockSources[gameFile].after);
assert.equal(execFileSync('/usr/bin/git', ['diff', '--name-only', '6de2bde5dc70941fd19e7bb0121d63de1613f159', latest, '--', 'features/money-story'], { encoding: 'utf8' }).trim(), gameFile, 'all other actual game dependencies are identical');

const typingLine = candidate.match(/^  const \[typing, setTyping\].*\n/m)?.[0];
const start = candidate.indexOf('  useEffect(() => {\n    const isField');
const hero = '  useEffect(() => {\n    let heroBottom = 480;';
const end = candidate.indexOf(hero, start);
assert.ok(typingLine && start > 0 && end > start);
const edits = [
  ['  const [shown, setShown] = useState(true);\n', '  const [shown, setShown] = useState(true);\n' + typingLine, 1],
  [hero, candidate.slice(start, end) + hero, 1],
  ['  const state = open || shown ? "shown" : "hidden";', '  const state = typing ? "hidden" : open || shown ? "shown" : "hidden";', 1],
  ['<ChatIcon />{LABEL}', '<ChatIcon /><span className={styles.triggerLabel}>{LABEL}</span>', 2],
];
const apply = (source, pairs) => {
  for (const [old, next, count] of pairs) {
    assert.equal(source.split(old).length - 1, count, 'exact reviewed edit count');
    source = source.replaceAll(old, next);
  }
  return source;
};
assert.equal(apply(original, edits), candidate, 'patch consists only of the actual C17b branch changes');
const combined = apply(latestDock, edits);
assert.equal(apply(combined, [...edits].reverse().map(([old, next, count]) => [next, old, count])), latestDock, 'removing only C17b restores exact fetched C12 Dock');
let inverseC12 = combined;
for (const [current, prior] of proof.moneyStoryDockSources[dockFile].changes) {
  assert.equal(inverseC12.split(current).length - 1, 1); inverseC12 = inverseC12.replace(current, prior);
}
assert.equal(inverseC12, candidate, 'removing only frozen C12 additions restores exact C17b branch Dock');

const output = 'qa/artifacts/c17b-money-mounted-integration-20261026';
await mkdir(output, { recursive: true });
await writeFile(`${output}/combined-dock.tsx.txt`, combined);
await writeFile(`${output}/actual-c17b-patch.json`, JSON.stringify(edits, null, 2));
const dom = new JSDOM('<!doctype html><html><body><main id="main-content"><div id="app"></div></main><input id="typing-fixture"></body></html>', { url: 'http://127.0.0.1/', pretendToBeVisual: true });
const names = ['window', 'document', 'HTMLElement', 'Element', 'Event', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT'];
const saved = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: name === 'IS_REACT_ACT_ENVIRONMENT' ? true : typeof dom.window[name] === 'function' && ['requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle'].includes(name) ? dom.window[name].bind(dom.window) : dom.window[name] });
dom.window.confirm = () => true;
const styles = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
const mocks = new Map([
  ['../MoneyStory.module.css', styles], ['./V5ChatDock.module.css', styles],
  ['./V5ChatLink', { useHydrated: () => true }],
  ['@/components/ui/PublicCopyProvider', { usePublicCopy: defaults => Object.assign(key => defaults[key], { node: key => defaults[key] }) }],
  ['@/lib/analytics', { trackEvent() {} }], ['@/lib/cookie-consent', { getConsentData: () => null }],
]);
const sources = new Map([[dockFile, combined], [gameFile, latestGame]]);
const Dock = loadFixtureModule(dockFile, { sources, mocks }).default;
const Game = loadFixtureModule(gameFile, { sources, mocks }).default;
const { LINE_CHAT_DEFAULTS, chatContextForPath } = loadFixtureModule('lib/line/chat-panel.ts');
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('app'));
let events = 0;
window.addEventListener('ccpun:money-story-dock', () => events++);
const states = [];
const render = showGame => React.act(async () => root.render(React.createElement(React.Fragment, null, showGame ? React.createElement(Game, { key: 'game' }) : null, React.createElement(Dock, { key: 'dock', config: LINE_CHAT_DEFAULTS, context: chatContextForPath('/play/money-story/'), fallbackHref: 'https://line.me/R/oaMessage/%40ccpun/' }))));
const state = (name, hidden) => {
  const node = document.querySelector('[data-v5-chat-dock]');
  assert.equal(node.hidden, hidden, name); assert.equal(node.hasAttribute('inert'), hidden); assert.equal(node.getAttribute('aria-hidden'), hidden ? 'true' : null);
  states.push({ name, hidden: node.hidden, inertAttribute: node.hasAttribute('inert'), ariaHidden: node.getAttribute('aria-hidden'), dataState: node.dataset.state });
};
const findButton = pattern => [...document.querySelectorAll('button')].find(el => !el.disabled && pattern.test(el.textContent.trim()));
const click = async button => { assert.ok(button, 'actual game action exists'); await React.act(async () => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))); };
let steps = 0, finalReached = false;
try {
  await render(true); state('intro', false);
  await click(findButton(/^แก้ม/)); state('selected', true);
  await click(findButton(/^เริ่มชีวิตที่เลือก$/)); state('playing', true);
  await React.act(async () => document.getElementById('typing-fixture').focus()); state('playing while typing', true);
  await React.act(async () => document.getElementById('typing-fixture').blur()); state('playing after blur', true);
  await click(findButton(/^กลับไปเลือกตัวละคร$/)); state('reset', false);
  await click(findButton(/^แก้ม/)); await click(findButton(/^เริ่มชีวิตที่เลือก$/));
  while (steps++ < 150) {
    const final = [...document.querySelectorAll('a')].find(el => el.textContent.trim() === 'เพิ่มเพื่อน LINE เพื่อคุยต่อ');
    if (final) { finalReached = true; state('actual engine result', true); break; }
    const next = document.querySelector('[data-money-choice]') || findButton(/^เริ่มเดือน /) || findButton(/^(ไปเดือนถัดไป|ดูผล 12 เดือน)$/) || [...document.querySelectorAll('button')].find(el => !el.disabled && /recoveryChoice|danger/.test(el.className));
    await click(next); assert.equal(document.querySelector('[data-v5-chat-dock]').hidden, true);
  }
  assert.equal(finalReached, true, 'real game UI reaches result without engine state mutation');
  await click(findButton(/^เลือกชีวิตใหม่$/)); state('reset after result', false);
  await click(findButton(/^แก้ม/)); await click(findButton(/^เริ่มชีวิตที่เลือก$/)); state('playing before unmount', true);
  await render(false); state('game unmount', false);
  assert.equal(document.documentElement.hasAttribute('data-money-story-dock-hidden'), false);
  assert.ok(events > 0, 'notifications came from actual mounted game effects');
  await writeFile(`${output}/evidence.json`, JSON.stringify({ kind: 'actual mounted React/JSDOM integration, not compiled browser acceptance', latest, beforeC17, hashes: { originalDock: sha(original), fetchedDock: sha(latestDock), fetchedGame: sha(latestGame), branchDock: sha(candidate), patch: sha(JSON.stringify(edits, null, 2)), combinedDock: sha(combined) }, exactPatchReconstructsBranch: true, removeC17bRestoresFetchedC12: true, removeC12RestoresBranch: true, states, eventsFromActualGame: events, steps, finalReached, limitations: ['No native CSS/layout/visibility or combined compiled-browser acceptance', 'C12 remains absent from the committed product branch; owner must integrate normally'] }, null, 2));
  console.log(JSON.stringify({ states: states.length, events, steps, finalReached, output, result: 'PASS actual mounted component integration' }, null, 2));
} finally {
  await React.act(async () => root.unmount()); dom.window.close();
  for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
}
