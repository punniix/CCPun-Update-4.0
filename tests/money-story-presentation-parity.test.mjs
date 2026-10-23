import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');
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
    if (id === '@/components/ui/PublicCopyProvider') return { usePublicCopy: defaults => Object.assign(key => defaults[key], { node: key => defaults[key] }) };
    if (id === '@/lib/analytics') return { trackEvent: (name, params) => events.push({ name, params }) };
    if (id === '@/lib/cookie-consent') return { getConsentData: () => ({ analytics: true }) };
    if (id.startsWith('@/')) {
      const target = resolve(id.slice(2));
      return load(existsSync(target + '.tsx') ? target + '.tsx' : target + '.ts', sources, modules);
    }
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
// Frozen hashes captured from live Production source ede3513 before extraction.
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
  "result-win": "c4cdb46c509ac2b0bea56f1a4a43183746a1b963802891791d104bc06b6695a9",
  "result-win-actions": "a6b83dce2eed6f1c83fb5aad000ad5c58299b6168ac8b85c0b8b9b762660109c",
  "result-survive": "584db9d1c32f7a11f6d2d141d841f7d2fd0b931a560f6de5b814ce8b21712df1",
  "result-survive-actions": "9f89d3a94bd92843160a2c6e24f78d7d0045b9ba1b58e72ca69c56d0e08bd5c3",
  "result-lose": "36c980f2efa275708116ecd2c1b2be0dc6ea47b2bfc7813f74d35bdd1cbe0cad",
  "result-lose-actions": "040361a90f2c1d2fd193c7fb5dbfc8d7268dccff41d28d1f6d13f4623049b861"
};

// Immutable ede3513 controller includes its original screens, unlike the later
// extraction fixture whose relative screen import deliberately follows current code.
const historicalSource = gunzipSync(Buffer.from("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", 'base64')).toString();
assert.equal(createHash('sha256').update(historicalSource).digest('hex'), "aff0271e71d518385a013be22a529aa6325bc89feb75fa1554b24835e0bb3c8f");
const HistoricalGame = load(gamePath, new Map([[gamePath, historicalSource]]), new Map()).default;

// React renders adjacent text/expression fragments as the same text node. Keep
// every character and every non-children prop; only reconcile this JSX boundary.
function hostTree(tree) {
  if (Array.isArray(tree)) {
    const result = [];
    for (const item of tree.flat(Infinity).map(hostTree).flat(Infinity)) {
      if (item === null || item === undefined || typeof item === 'boolean' || item === '') continue;
      if (typeof item === 'string' || typeof item === 'number') {
        if (typeof result.at(-1) === 'string') result[result.length - 1] += String(item);
        else result.push(String(item));
      } else result.push(item);
    }
    return result;
  }
  if (!tree || typeof tree !== 'object') return tree;
  return { ...tree, props: { ...tree.props, children: hostTree([tree.props.children]) } };
}
const hostDigest = tree => digest(hostTree(tree));

test('Money Story preserves original Production trees except approved focusable selection/result root', () => {
  for (const [name, values] of cases) {
    const tree = render(values);
    const historical = render(values, HistoricalGame);
    assert.equal(digest(historical), baseline[name], name + ': immutable Production golden retained');
    const candidate = { ...tree, props: { ...tree.props } };
    if (name.startsWith('selection-') || name.startsWith('result-')) {
      assert.equal(tree.props.tabIndex, -1, name + ': programmatic focus without extra Tab stop');
      delete candidate.props.tabIndex;
    }
    assert.equal(hostDigest(candidate), hostDigest(historical), name + ': identical rendered host content and behavior');
  }
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

// Original f703 controller executes only as an output fixture, never as a current-source reader.
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
    assert.equal(hostDigest(render([game])), hostDigest(render([game], OriginalGame)), 'sidebar state ' + index);
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
    assert.equal(hostDigest(render([game])), hostDigest(render([game], OriginalGame)), event.id);
  }
});

// Explicit native prompt is a presentation safeguard; no game state/event is changed on Cancel.
test('active round reset Cancel/Accept and untouched/final round reselect keep exact original state/events', () => {
  const previous = globalThis.window;
  let prompts = [];
  const back = tree => elements(tree).find(element => element.type === 'button' && text(element).includes('กลับไปเลือก'));
  try {
    for (const game of [{ ...state, currentMonth: 2 }, { ...state, history: resultHistory.slice(0,1) }]) {
      globalThis.window = { confirm: message => { prompts.push(message); return false; } };
      const tree = render([game]); const button = back(tree); assert(button);
      button.props.onClick(); assert.equal(prompts.at(-1), 'กลับไปเลือกตัวละครจะเริ่มรอบใหม่ ต้องการเริ่มใหม่หรือไม่?');
      assert.deepEqual(stateWrites, []); assert.deepEqual(events, []);
      globalThis.window.confirm = message => { prompts.push(message); return true; };
      button.props.onClick(); assert.equal(events.at(-1).name, 'money_story_character_reselect');
      assert.deepEqual(stateWrites.slice(-5), [[0,null],[1,null],[2,''],[3,[]],[4,[]]]);
    }
    let called = false;
    globalThis.window = { confirm: () => { called = true; return false; } };
    back(render([state])).props.onClick(); assert.equal(called, false);
    const finished = render([{ ...state, status:'win',history:resultHistory }]);
    elements(finished).find(x => x.type === 'button' && text(x).includes('เลือกชีวิตใหม่')).props.onClick();
    assert.equal(called,false);
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});

test('CMS harness still rejects changed text, whitespace, destinations and disabled state', () => {
  const before = render([state]);
  const tampered = load(gamePath, new Map([[gamePath, readFileSync(gamePath, 'utf8').replace(/text(\.node)?\("moneyStory\.category"\)/, 'text$1("moneyStory.category2")')]]), new Map()).default;
  assert.notEqual(hostDigest(render([state], tampered)), hostDigest(before));
  const span = children => jsx('span', { children });
  assert.equal(hostDigest(span(['เงิน ', 1])), hostDigest(span('เงิน 1')));
  assert.notEqual(hostDigest(span(['เงิน', 1])), hostDigest(span(['เงิน ', 1])));
  assert.notEqual(hostDigest(jsx('a', { href: '/', children: 'กลับ' })), hostDigest(jsx('a', { href: '/unreviewed', children: 'กลับ' })));
  assert.notEqual(hostDigest(jsx('button', { disabled: true })), hostDigest(jsx('button', { disabled: false })));
});
