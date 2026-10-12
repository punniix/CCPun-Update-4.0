import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createRequire } from 'node:module';

const ts = createRequire(resolve('package.json'))('typescript');
const gamePath = resolve('features/money-story/components/MoneyStoryGame.tsx');
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const effects = [];
const events = [];
let hookValues = [];
let hookIndex = 0;
const stateWrites = [];
const cache = new Map();

// No browser, provider scripts, or network: execute the real JSX and pure engine.
function load(path, sources = new Map(), modules = cache) {
  if (modules.has(path)) return modules.get(path);
  const exports = {};
  modules.set(path, exports);
  const require = (id) => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
    if (id === 'react') return {
      useState: (initial) => {
        const index = hookIndex++;
        const value = hookValues[index] ?? initial;
        return [value, (next) => stateWrites.push([index, typeof next === 'function' ? next(value) : next])];
      },
      useRef: () => ({ current: null }),
      useMemo: (compute) => compute(),
      useEffect: (effect) => effects.push(effect),
    };
    if (id === 'next/link') return { __esModule: true, default: (props) => jsx('a', props) };
    if (id === 'lucide-react') return new Proxy({}, { get: (_, name) => (props) => jsx('icon', { name, ...props }) });
    if (id.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) };
    if (id === '@/lib/analytics') return { trackEvent: (name, params) => events.push({ name, params }) };
    if (id === '@/lib/cookie-consent') return { getConsentData: () => ({ analytics: true }) };
    if (id.startsWith('.')) {
      const target = resolve(dirname(path), id);
      return load(existsSync(target + '.tsx') ? target + '.tsx' : target + '.ts', sources, modules);
    }
    throw new Error('Unexpected import: ' + id);
  };
  new Function('exports', 'require', 'requestAnimationFrame', ts.transpileModule(sources.get(path) ?? readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText)(exports, require, (callback) => callback());
  return exports;
}

const Game = load(gamePath).default;
const engine = load(resolve('features/money-story/engine.ts'));
const characters = load(resolve('features/money-story/characters.ts')).MONEY_STORY_CHARACTERS;
const eventLibrary = load(resolve('features/money-story/events.ts')).MONEY_STORY_EVENTS;
function expand(value) {
  if (Array.isArray(value)) return value.map(expand);
  if (!value || typeof value !== 'object') return value;
  if (typeof value.type === 'function') return expand(value.type(value.props));
  return { ...value, props: { ...value.props, children: expand(value.props.children) } };
}
function render(values, component = Game) {
  hookValues = values;
  hookIndex = 0;
  effects.length = 0;
  events.length = 0;
  stateWrites.length = 0;
  return expand(component({ showSeed: true }));
}
function digest(tree) {
  return createHash('sha256').update(JSON.stringify(tree, (key, value) => {
    if (key === 'ref' || key === 'key') return undefined;
    return typeof value === 'function' ? '[callback]' : value;
  })).digest('hex');
}
function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...elements(tree.props.children)];
}
const text = (tree) => Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props.children) : tree ?? '';
const resultHistory = eventLibrary.slice(0, 5).map((event, index) => ({
  month: index + 1, eventId: event.id, eventTitle: event.title,
  optionLabel: event.options[0].label, sensitive: index === 4,
}));
const state = engine.createGame('presentation-production-baseline', 'gam');
const cases = [
  ['selection-none', [null, null]],
  ...characters.map((character) => ['selection-' + character.id, [null, character.id]]),
  ['month-start', [state]],
  ['event-choice', [engine.beginMonth(state)]],
  ['recovery', [{ ...state, cash: 0, pendingShortfall: { amount: 12000, resume: 'month-end', usedActions: [] } }]],
  ...['win', 'survive', 'lose'].flatMap((status) => [
    ['result-' + status, [{ ...state, status, history: resultHistory }]],
    ['result-' + status + '-actions', [{ ...state, status, history: resultHistory, protections: [{ type: 'health', source: 'purchased', activeFromMonth: 1, monthlyPremium: 1200 }] }, null, 'คัดลอกลิงก์แล้ว', [], [{ game: state, lastChoiceImpact: [] }]]],
  ]),
];
// Frozen hashes captured from UX/UAT 3d66f027 before extraction; preserve its intentional layout.
// Full rendered host trees include text, hierarchy, classes, inline styles, ARIA,
// disabled states, destinations, and callback positions. Works in shallow CI.
const baseline = {
  "selection-none": "eb947c21ae8eb918f9ef86f97adf1defac9b3d7b48422b16561a26e8f8d9d81c",
  "selection-gam": "d200fc204c1bf2730759c28b48818dd13daddaba28bde9490439ce05f8980f35",
  "selection-ton": "44f3df699a06cd5b21903fe76613a41cb6fd23281fa5ef29b3356bd2db625baa",
  "selection-meen": "7e0788b2dc6f677d9cd814c4c554e50d2974d383a08b24e7d969ce4f39fe9d2f",
  "selection-nut": "d8d2613a8d10c84b6a2bf7ca055131eee3c80af4852dcb24825aee5251253aa1",
  "selection-fon": "bc12cdae6d793ac77508fd3ff821583ea906b08422a96730b6952d8b45d259da",
  "selection-win": "4daf30867b728f68f024747e07eece272879b213abe5c4de073924570bde4a92",
  "selection-ploy": "f85a80ca7aabc75d6c3c868a8e10cfab45334d0deb6e64cc5ca1af4074714123",
  "selection-poom": "20a216a0e7323b7edbeffe504027d3eca77fc9a33d3f0373bcf8f3f71234ce44",
  "month-start": "11b444783468c5eb9d215c3bd95b0f36a46c2d55fce9aefde8fd7b3a7626a729",
  "event-choice": "c2fdf0c4e168d1074e05b25c9d5bff10b935d46f84d8297c6090f7493f009aff",
  "recovery": "8ca5d13c39d5545225dbbc9739a6dc28cd4b2a464b8ffd59f569720c18ae6057",
  "result-win": "8e4b10593fcf3128cc9d3ba40605c23b5a5f497844075a17d29b85d016a6e601",
  "result-win-actions": "e380fb0af5ce90c1c1b5d6a3e5d01141c217e85c3f4bc57a326d956a7277e3f0",
  "result-survive": "4dd821a4d66dcb37a2fecb555b9bb3ebee5ed8b48d6eeac8324b4ab15cf0c601",
  "result-survive-actions": "cd565580b3f08ce8df4e1e9435b6e85b208fa1f4da705316b4456aa93fc6afd6",
  "result-lose": "f38fd6833d9f4442044e6327102b395af81c2eddc1d11e1da0df6147781ae89b",
  "result-lose-actions": "e13b18e16c877fb72cba6b8ac6ee4dc5f794460b301edd8740a39be311230678"
};

test('Money Story rendered selection, result and recovery trees match current UX/UAT', () => {
  for (const [name, values] of cases) assert.equal(digest(render(values)), baseline[name], name);
});

test('selection and result buttons retain original state owner and analytics payloads', () => {
  const selection = render([null, 'gam']);
  elements(selection).find((element) => element.type === 'button' && text(element).includes('แก้ม')).props.onClick();
  assert.deepEqual(stateWrites, [[1, 'gam']]);
  elements(selection).find((element) => element.type === 'button' && text(element) === 'เริ่มชีวิตที่เลือก').props.onClick();
  assert.equal(stateWrites[1][0], 0);
  assert.equal(stateWrites[1][1].characterId, 'gam');
  assert.equal(stateWrites[1][1].status, 'active');
  assert.deepEqual(events.map((event) => event.name), ['money_story_start', 'money_story_character_generated']);
  const result = render([{ ...state, status: 'win', history: resultHistory }, null, '', [], [{ game: state, lastChoiceImpact: ['เดิม'] }]]);
  const find = (label) => elements(result).find((element) => text(element) === label && ['button', 'a'].includes(element.type));
  find('พีระมิดทางการเงินคืออะไร?').props.onClick();
  find('เพิ่มเพื่อน LINE เพื่อคุยต่อ').props.onClick();
  find(' ย้อนกลับ').props.onClick();
  assert.deepEqual(events.map((event) => event.name), ['money_story_financial_pyramid_click', 'money_story_line_click', 'money_story_undo']);
  assert.ok(events.every((event) => event.params.tool_name === 'money_story' && event.params.surface_group === 'money_story'));
  assert.deepEqual(stateWrites.slice(-3), [[4, []], [0, state], [3, ['เดิม']]]);
  find(' เลือกชีวิตใหม่').props.onClick();
  assert.deepEqual(events.slice(-2).map((event) => event.name), ['money_story_replay', 'money_story_character_reselect']);
  assert.deepEqual(stateWrites.slice(-5), [[0, null], [1, null], [2, ''], [3, []], [4, []]]);
});

// Original own-UAT controller executes only as an output fixture, never as a current-source reader.
const phase2 = JSON.parse(readFileSync('qa/phase2-css-delivery-parity.json', 'utf8'));
const OriginalGame = load(gamePath, new Map([[gamePath, gunzipSync(Buffer.from(phase2.moneyOriginalControllerGzip, 'base64')).toString()]]), new Map()).default;
const sidebarCases = [
  ...characters.map(character => engine.createGame('phase2-sidebar-parity', character.id)),
  ...['health', 'critical', 'life', 'motor', 'home'].flatMap(type =>
    [0, 1, 2].flatMap(activeFromMonth => ['existing', 'purchased'].map(source => ({
      ...state, protections: [{ type, source, activeFromMonth, monthlyPremium: 1234 }],
    })))),
  ...[-1000, 0, 0.5, 1e6, 1e9].map(amount => ({ ...state, cash: amount, investments: amount })),
];
test('actual extracted status sidebar preserves all characters, coverage timings and goal/meter clamps', () => {
  for (const [index, game] of sidebarCases.entries()) {
    assert.equal(digest(render([game])), digest(render([game], OriginalGame)), 'sidebar state ' + index);
  }
});

test('active controller buttons keep callback state writes and analytics after sidebar extraction', () => {
  let activeTrace;
  for (const original of [false, true]) {
    const tree = render([state], original ? OriginalGame : Game);
    const begin = elements(tree).find(element => element.type === 'button' && text(element) === 'เริ่มเดือน 1');
    begin.props.onClick();
    const trace = { states: structuredClone(stateWrites), events: structuredClone(events) };
    if (original) assert.deepEqual(trace, activeTrace);
    else activeTrace = trace;
  }
});


test('all library event impact branches preserve original render output and required presentation dependencies', () => {
  const month = engine.beginMonth(state);
  for (const event of eventLibrary) {
    const game = { ...month, currentEventId: event.id, pendingShortfall: undefined };
    assert.equal(digest(render([game])), digest(render([game], OriginalGame)), event.id);
  }
});
