import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import ts from 'typescript';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');
const controllerPath = 'features/money-story/components/MoneyStoryGame.tsx';
const ownerPath = 'features/money-story/components/MoneyStoryStatusSidebar.tsx';
const parse = (path, source) => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const statementName = node => ts.isVariableStatement(node) ? node.declarationList.declarations[0].name.getText() : node.name?.getText();
const find = (tree, predicate) => {
  let found;
  const visit = node => { if (predicate(node)) found ??= node; ts.forEachChild(node, visit); };
  visit(tree);
  assert(found, 'Missing actual implementation node');
  return found;
};
function structure(node, options = {}) {
  if (options.ignoreExport && node.kind === ts.SyntaxKind.ExportKeyword) return null;
  if (ts.isJsxText(node) && !node.text.trim()) return null;
  if (options.omitProtectionTypes && ts.isVariableStatement(node) && statementName(node) === 'protectionTypes') return null;
  if (options.sidebar && ts.isJsxSelfClosingElement(node) && node.tagName.getText() === 'MoneyStoryStatusSidebar') return structure(options.sidebar);
  const children = [];
  ts.forEachChild(node, child => { const value = structure(child, options); if (value !== null) children.push(value); });
  return [node.kind, typeof node.operator === 'number' ? node.operator : null, ts.isVariableDeclarationList(node) ? node.flags : null, typeof node.text === 'string' ? node.text : null, children];
}
function imports(tree) {
  return tree.statements.filter(ts.isImportDeclaration).map(node => ({
    module: node.moduleSpecifier.text,
    typeOnly: Boolean(node.importClause?.isTypeOnly),
    default: node.importClause?.name?.text ?? null,
    namespace: node.importClause?.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings) ? node.importClause.namedBindings.name.text : null,
    bindings: node.importClause?.namedBindings?.elements?.map(item => [item.propertyName?.text ?? item.name.text, item.name.text, Boolean(item.isTypeOnly)]) ?? [],
  }));
}

// Explicit admission to the own-baseline composition assertion. No original source
// is returned; current-source readers continue reading current implementations.
export function assertPhase2MoneyComposition(file, expectedBaselineDigest, readCurrent = read) {
  assert.equal(file, controllerPath, 'Only the reviewed Money Story composition is admitted');
  const proof = JSON.parse(readCurrent('qa/phase2-css-delivery-parity.json'));
  const composition = proof.moneyComposition;
  assert.equal(composition.controller, controllerPath);
  assert.equal(composition.owner, ownerPath);
  const current = readCurrent(file), owner = readCurrent(ownerPath);
  assert.equal(sha(current), composition.controllerSha256, 'Unreviewed controller composition');
  assert.equal(sha(owner), composition.ownerSha256, 'Unreviewed current sidebar body');
  const original = gunzipSync(Buffer.from(proof.moneyOriginalControllerGzip, 'base64')).toString();
  assert.equal(sha(original), expectedBaselineDigest, 'Original own-UAT output fixture must match the unchanged protected manifest');
  assert.equal(sha(original), composition.baselineSha256);
  assert.equal(composition.test, 'tests/money-story-presentation-parity.test.mjs');
  assert.equal(sha(readCurrent(composition.test)), composition.outputTestSha256, 'Actual output/action test drift');
  const oldTree = parse(file, original), currentTree = parse(file, current), ownerTree = parse(ownerPath, owner);
  const expectedImports = imports(oldTree).map(item => ({ ...item, bindings: item.bindings.filter(([imported, local]) => !['Car', 'HeartPulse', 'House', 'ShieldCheck', 'Users'].includes(imported) || imported !== local) }));
  expectedImports.push({ module: './MoneyStoryStatusSidebar', typeOnly: false, default: null, namespace: null, bindings: ['money', 'MoneyStoryStatusSidebar'].map(name => [name, name, false]) });
  assert.deepEqual(imports(currentTree), expectedImports, 'Only presentation bindings may move');
  assert.doesNotMatch(owner, /\b(?:useState|useEffect|trackEvent|trackMoneyStoryEvent|setGame)\b/);
  assert(!imports(ownerTree).some(item => item.module.includes('MoneyStoryGame')), 'No owner/controller cycle');
  const oldFunction = find(oldTree, node => ts.isFunctionDeclaration(node) && node.name?.text === 'MoneyStoryGame');
  const ownerFunction = find(ownerTree, node => ts.isFunctionDeclaration(node) && node.name?.text === 'MoneyStoryStatusSidebar');
  for (const node of ownerTree.statements.filter(ts.isImportDeclaration)) {
    assert(!node.importClause?.namedBindings || ts.isNamedImports(node.importClause.namedBindings));
    assert(node.importClause?.namedBindings?.elements?.every(item => !item.propertyName) ?? true, 'No presentation import alias may change its original binding');
  }
  assert.deepEqual(imports(ownerTree), [
    { module: 'lucide-react', typeOnly: false, default: null, namespace: null, bindings: ['Car', 'HeartPulse', 'House', 'ShieldCheck', 'Users'].map(name => [name, name, false]) },
    { module: '../config', typeOnly: false, default: null, namespace: null, bindings: ['PROTECTION_CATALOG'].map(name => [name, name, false]) },
    { module: '../engine', typeOnly: true, default: null, namespace: null, bindings: ['statusBars'].map(name => [name, name, false]) },
    { module: '../types', typeOnly: true, default: null, namespace: null, bindings: ['GameState', 'ProtectionType'].map(name => [name, name, false]) },
    { module: '../MoneyStory.module.css', typeOnly: false, default: 'styles', namespace: null, bindings: [] },
    { module: './MoneyStoryScreens', typeOnly: false, default: null, namespace: null, bindings: [['percentLabel', 'percentLabel', false]] },
  ], 'Only original presentation dependencies and type-only state contracts belong to the sidebar');
  assert.deepEqual(ownerTree.statements.filter(node => !ts.isImportDeclaration(node)).map(statementName),
    ['money', 'protectionIcons', 'Meter', 'MoneyStoryStatusSidebarProps', 'MoneyStoryStatusSidebar'],
    'No extra top-level initialization or side-effect statements');
  assert(ownerTree.statements.every(node => ts.isImportDeclaration(node) || ts.isVariableStatement(node)
    || ts.isFunctionDeclaration(node) || ts.isTypeAliasDeclaration(node)));
  assert.deepEqual(ownerFunction.modifiers?.map(node => node.kind), [ts.SyntaxKind.ExportKeyword]);
  assert.equal(ownerFunction.parameters.length, 1);
  assert.equal(ownerFunction.parameters[0].type?.getText(), 'MoneyStoryStatusSidebarProps');
  assert(!ownerFunction.parameters[0].initializer && !ownerFunction.parameters[0].dotDotDotToken);
  const bindings = ownerFunction.parameters[0].name;
  assert(ts.isObjectBindingPattern(bindings));
  assert.deepEqual(bindings.elements.map(binding => [binding.name.getText(), binding.propertyName?.getText(), Boolean(binding.initializer)]),
    [['game', undefined, false], ['bars', undefined, false]], 'Actual state/status props remain correctly bound');
  assert.deepEqual(ownerFunction.body.statements.map(node => node.kind),
    [ts.SyntaxKind.VariableStatement, ts.SyntaxKind.ReturnStatement], 'No hidden owner mutations or calls before the view');

  const ownerReturn = find(ownerFunction, node => ts.isReturnStatement(node)).expression;
  const returnedAside = ts.isParenthesizedExpression(ownerReturn) ? ownerReturn.expression : ownerReturn;
  const sidebarCall = find(currentTree, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText() === 'MoneyStoryStatusSidebar');
  assert.equal(sidebarCall.getText(), '<MoneyStoryStatusSidebar game={game} bars={bars} />');
  const oldTypes = find(oldFunction, node => ts.isVariableStatement(node) && statementName(node) === 'protectionTypes');
  const currentTypes = find(ownerFunction, node => ts.isVariableStatement(node) && statementName(node) === 'protectionTypes');
  assert.deepEqual(structure(currentTypes), structure(oldTypes));
  for (const name of ['money', 'protectionIcons', 'Meter']) {
    const oldNode = oldTree.statements.find(node => statementName(node) === name);
    const newNode = ownerTree.statements.find(node => statementName(node) === name);
    assert(oldNode && newNode, name);
    assert.deepEqual(structure(newNode, { ignoreExport: true }), structure(oldNode), name + ': moved helper body');
  }
  const moved = new Set(['money', 'protectionIcons', 'Meter']);
  const keep = node => !ts.isImportDeclaration(node) && !moved.has(statementName(node));
  assert.deepEqual(currentTree.statements.filter(keep).map(node => structure(node, { sidebar: returnedAside })),
    oldTree.statements.filter(keep).map(node => structure(node, { omitProtectionTypes: true })), 'Remaining controller logic and expanded CURRENT sidebar must match own UAT');
  return true;
}
