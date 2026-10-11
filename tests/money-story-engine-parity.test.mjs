import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const ts = createRequire(resolve('package.json'))('typescript');
const cache = new Map();
const loading = new Set();
// Execute actual pure source without browser/provider calls; reject cycles.
function load(file) {
  if (loading.has(file)) throw new Error('Money Story dependency cycle: ' + file);
  if (cache.has(file)) return cache.get(file);
  loading.add(file);
  const exports = {};
  const require = (id) => {
    assert.ok(id.startsWith('.'), 'Pure engine must not add an external runtime dependency: ' + id);
    const target = resolve(dirname(file), id);
    return load(existsSync(target + '.ts') ? target + '.ts' : target);
  };
  new Function('exports', 'require', ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(exports, require);
  loading.delete(file);
  cache.set(file, exports);
  return exports;
}
const engine = load(resolve('features/money-story/engine.ts'));
const characters = load(resolve('features/money-story/characters.ts')).MONEY_STORY_CHARACTERS;
const eventFor = load(resolve('features/money-story/events.ts')).getMoneyStoryEvent;
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const record = (trace, label, state) => {
  trace.push({ label, state: structuredClone(state), bars: engine.statusBars(state) });
  return state;
};
function journey(characterId) {
  const trace = [];
  let state = engine.createGame('foundation-' + characterId + '-20261011', characterId);
  // Synthetic ample cash forces all 12 months, retaining each character's debts,
  // protections, income variability and actual seeded event selection.
  state = record(trace, 'create', { ...state, cash: 1000000 });
  for (let month = 1; month <= 12; month += 1) {
    state = record(trace, 'begin-' + month, engine.beginMonth(state));
    const event = eventFor(state.currentEventId);
    assert.ok(event, 'Seeded journey requires an actual event');
    const option = event.options[month % event.options.length];
    state = record(trace, 'choice-' + month, engine.resolveEventChoice(state, option.id));
    assert.equal(state.pendingShortfall, undefined, 'Ample-cash fixture must complete every month');
    state = record(trace, 'complete-' + month, engine.completeMonth(state));
  }
  assert.equal(state.currentMonth, 12);
  assert.equal(state.history.length, 12);
  assert.notEqual(state.status, 'active');
  return trace;
}
function recovery(resume, mode) {
  const trace = [];
  const characterId = mode === 'restructure' ? 'nut' : 'gam';
  const initial = engine.createGame('foundation-recovery-' + resume + '-' + mode, characterId);
  const cash = mode === 'combined' ? -121126 : -12000;
  let state = record(trace, 'shortfall', {
    ...initial, cash, investments: mode === 'sell' ? 24000 : 0,
    monthStarted: true,
    pendingShortfall: { amount: -cash, resume, usedActions: [] },
  });
  const actions = {
    sell: ['coverShortfallWithInvestments'],
    loan: ['coverShortfallWithLoan'],
    income: ['coverShortfallWithExtraIncome'],
    expenses: ['coverShortfallWithExpenseCut'],
    restructure: ['coverShortfallWithDebtRestructure'],
    combined: ['coverShortfallWithLoan', 'coverShortfallWithExtraIncome', 'coverShortfallWithExpenseCut', 'coverShortfallWithInvestments'],
  }[mode];
  for (const action of actions) {
    const input = state;
    const inputDigest = digest(input);
    state = record(trace, action, engine[action](state));
    assert.equal(digest(input), inputDigest, 'Recovery must not mutate its input state');
    const first = structuredClone(state);
    state = record(trace, action + '-repeat', engine[action](state));
    if (action !== 'coverShortfallWithInvestments') assert.deepEqual(state, first, 'Recovery action may be used once per shortfall');
  }
  return trace;
}
// Frozen from Production 1843dbc11a1cd400f89a32a333516ee2e0a53223 before
// extraction. Whole traces include every state field, RNG cursor, ledger,
// history, resolution, shortfall resume/actions and financial/status outputs.
// Fixtures are portable in shallow CI and never invoke Git or a network.
const GOLDEN = {
  "journey:gam": "75ddbb135a2c73d465a92f03ae2d79e7206602628a0220ccfa04a8a88e19c268",
  "journey:ton": "0ceb816812757202c14e63cd8f209a08d1bc8bcf3c0a5766a220cb83964f445b",
  "journey:meen": "b110aa8715d0fccb0a7ceafa954d9ed72bf26d78fc7bef43f24ae1ee834beb36",
  "journey:nut": "47f77ba1decb9fdba8295bee8cf6bbfa7da8e4ee0b9d0749dcfaa3704fefe4f2",
  "journey:fon": "f6c3ed662fc24c2aff1a8be7a72627b81d65c17ed0c0551ff13212c69258a598",
  "journey:win": "9e3626090ecdcaa12218114dd022533af3d450be064cb63bee54dbc1232c8d9b",
  "journey:ploy": "48d6e7996effe618ad35fb951765727c37a0f4cfe8a4bcf84688e4ee2cc3489d",
  "journey:poom": "65aa58bfa3156af4a86babfddda6249ca21b46dac4676a4235756f0ab8b39660",
  "recovery:event:sell": "50d42366e51bb652418e77ce87d422ca17f694b3cd16bd9549189733b4e4950d",
  "recovery:event:loan": "ce8268ccd42d540a02e5585362cf9511cd96b97429ebe42cfbe9122ad056ddc0",
  "recovery:event:income": "59b9b3eaf42ed179b65349b070adc522c85b95849ab447f62ffb6bf495402657",
  "recovery:event:expenses": "b76b954af8f97dc49dd32cc68519f86f812f97abfd6bfb838066cfc926c4d26d",
  "recovery:event:restructure": "b9581b03267f46993c70d31b0b5b38a189be75d4249417144e7e8f146af4182c",
  "recovery:event:combined": "233e4985157e1b8d5079af609e068c7fe90620229c1fa97c143116a6efe23f93",
  "recovery:month-end:sell": "a72915cc5d9ae62bb54cc3ab43c1e60f900b02e835bd9692e01c84e16deafcd7",
  "recovery:month-end:loan": "7cbf27fea94fef59f08004190582325a86149add3df321c9ded64ffa3876527f",
  "recovery:month-end:income": "8c1ff249175e118ef5169f9b43f1893b321500259109974150cb39c1a6c3a392",
  "recovery:month-end:expenses": "e62f7443fc42279435d9d1d38bc2e34f5e29afa3634ded767accb03c3d7ba0ba",
  "recovery:month-end:restructure": "7bec47a7d100cf5b475ae1cf0117bd775e75bef32bbc7c9d8c19e59504b380b3",
  "recovery:month-end:combined": "c1f9e4b11403431d3ff49b65892563dbe438284e2f836722e49ca904cd03d76e"
};
const PUBLIC_EXPORTS = [
  "amortizedPayment",
  "beginMonth",
  "characterFor",
  "completeMonth",
  "coverShortfallWithDebtRestructure",
  "coverShortfallWithExpenseCut",
  "coverShortfallWithExtraIncome",
  "coverShortfallWithInvestments",
  "coverShortfallWithLoan",
  "createGame",
  "createSeed",
  "declareUnableToContinue",
  "eventEligible",
  "hasRecoveryOption",
  "protectionBenefitPreview",
  "quoteRecoveryDebtRestructure",
  "quoteRecoveryExpenseCut",
  "quoteRecoveryExtraIncome",
  "quoteShortfallLoan",
  "resolveEventChoice",
  "selectEvent",
  "statusBars",
  "totalDebt"
];

// Assertions use frozen baseline outputs, not implementation-derived expectations.
test('Money Story public exports and acyclic pure dependency boundary remain unchanged', () => {
  assert.deepEqual(Object.keys(engine).sort(), PUBLIC_EXPORTS);
});
test('all eight seeded character journeys retain every transition through month 12', () => {
  for (const character of characters) assert.equal(digest(journey(character.id)), GOLDEN['journey:' + character.id], character.id);
});
test('shortfall sale, loan, income, cuts, restructure and combined recovery retain both resume paths', () => {
  for (const resume of ['event', 'month-end']) {
    for (const mode of ['sell', 'loan', 'income', 'expenses', 'restructure', 'combined']) {
      const key = 'recovery:' + resume + ':' + mode;
      assert.equal(digest(recovery(resume, mode)), GOLDEN[key], key);
    }
  }
});
