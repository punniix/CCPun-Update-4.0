import { assertProductionCmsOwner, hasProductionCmsOwner } from './production-cms-source-proof.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import ts from 'typescript';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');
// Explicit v5 successors: the existing consent/event layer and one reviewed game stylesheet.
// Historical manifests stay unchanged; a partial or unrelated source cannot enter this bridge.
const reviewedV5Successors = {
  'lib/content/category-registry-sanity.ts': ['6e16064dd7c82072f843bb9c3c92b363054769e4e2fe376d1253916cc0d5bba4', 'f8950cb210499b59698237c4af1272c429813864199d24a2b209c0b121a96577'],
  'lib/content/category-registry.ts': ['7c6925e218f4e419948255580f5cbff3d058e136a819b53f1db90c6125ce1f14', 'fecdaf000ddb456a8c2f886d9fbb8873945bc25019cb0d3baa35ee0c9c1353de'],
  'lib/analytics.ts': ['4176646b29ae2614cc044fef35d9be7cdffe8cfb303c8519f86fe71c148cd90f', 'e1d290d31c5d7d8af1f038ef3796795e7df3cf8f479e1018c4699fbdcc30eb38'],
  'features/analytics/components/GoogleAnalytics.tsx': ['6379bb9a48584a748980f1163458150776410ce32d71c782bfd3529fdb295b6a', 'ed528cd554a3a9be818ea399e65fd23ee2642e6ffe5008186e02ff01892a6a6e'],
  'features/money-story/MoneyStory.module.css': ['40b39bf243365a0888163b8a3b7dfc2d53f8a37fb92e5802f8fc12e167917a61', 'c6ab64a3b945c443623214ba42fc949af830842b23ae28026f1424f3c011890a'],
  'features/blog/pages/ArticlePage.tsx': ['c951fa95c6b892baf46e25d3e73f50ad296177ae3aaa99497a7a0ad019192303', 'e161a9247a0bd02b6864cc2b259f71b4324d0493fbcb77f10cbebda5bed29db1'],
  'components/ui/health-happy/HealthHappyCountdown.module.css': ['73e39a9e3f17af98b25e9a12b706d0a9729260aced6bd47425e79dd9ec6e9766', '05b5e5726c6227036dbf0a18b63cc8a05420a51ec32464be4e0b713c9647e14c'],
  'tests/money-story-presentation-parity.test.mjs': ['2fab8aac076c4fe2f2dbe4a1acfbfe1dc0c19beab4f714495b55324bb5644b5b', '48e7ac281b11c5cf2a16f2538bcb1a3527c5d9641e33411bdff3fc99f12a063a'],
};
export const hasReviewedV5Successor = file => Object.hasOwn(reviewedV5Successors, file);
export function reviewedV5PredecessorDigest(file, source, previous) {
  assert.ok(hasReviewedV5Successor(file), 'only named reviewed v5 successors');
  const [before, after] = reviewedV5Successors[file];
  assert.equal(previous, before, file + ': historical owner pin retained');
  assert.equal(sha(source), after, file + ': exact reviewed v5 source, no partial/unrelated changes');
  return before;
}

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

export function reviewedArticleCardProjection(file, source) {
  const changes = {
  "features/blog/website-43/Website43Article.tsx": [
    [
      "            <p className={styles.articleHeaderMeta} style={{ width: 'min(1028px,100%)', margin: '24px auto 0' }}>โดย {author.name.replaceAll('™', '')}</p>\n",
      ""
    ],
    [
      "textWrap: 'balance', marginTop: 12",
      "textWrap: 'balance'"
    ]
  ],
  "features/blog/website-43/Website43BlogInteractive.tsx": [
    [
      "import ArticleCardEngagement from './ArticleCardEngagement';\nimport cardStyles from './ArticleCardEngagement.module.css';\n",
      ""
    ],
    [
      "    <article className={classNames.articleCard}>\n    <Link className={cardStyles.contentLink} href={article.href}>",
      "    <Link className={classNames.articleCard} href={article.href}>"
    ],
    [
      "      </div>\n    </Link>\n    <ArticleCardEngagement articleId={article.id} title={article.title} dateLabel={article.meta} publishedAt={article.publishedAt} />\n    </article>",
      "        <p className={classNames.articleMeta}>{article.meta}</p>\n      </div>\n    </Link>"
    ]
  ],
  "features/blog/website-43/Website43ArticleBody.tsx": [
    [
      "  const introEnd = items.findIndex(item => item.type !== 'paragraph');\n",
      ""
    ],
    [
      "<p key={key} style={index < (introEnd < 0 ? items.length : introEnd) ? { fontSize: 19, lineHeight: 1.75, color: 'rgba(250,249,249,.9)' } : undefined}>",
      "<p key={key}>"
    ]
  ],
  "features/blog/website-43/blogData.ts": [
    [
      "  id: string;\n",
      ""
    ],
    [
      "    id: article.id,\n",
      ""
    ]
  ]
};
  for (const [reviewed, original] of changes[file] ?? []) {
    assert.equal(source.split(reviewed).length, 2, file + ": one exact approved card/byline/intro change");
    source = source.replace(reviewed, original);
  }
  return source;
}

export function reviewedThaiWrapProjection(file, source) {
  const additions = {
  "features/blog/website-43/Website43Article.tsx": [
    [
      "<h1 className={styles.articleHeadline}>",
      "<h1 className={styles.articleHeadline} style={{ textWrap: 'balance' }}>"
    ],
    [
      "<h3 className={styles.articleTitle}>",
      "<h3 className={styles.articleTitle} style={{ textWrap: 'pretty' }}>"
    ],
    [
      "<p className={styles.articleExcerpt}>",
      "<p className={styles.articleExcerpt} style={{ textWrap: 'pretty' }}>"
    ]
  ],
  "features/blog/website-43/Website43BlogInteractive.tsx": [
    [
      "<h2 className={classNames.articleTitle}>",
      "<h2 className={classNames.articleTitle} style={{ textWrap: 'pretty' }}>"
    ],
    [
      "<p className={classNames.articleExcerpt}>",
      "<p className={classNames.articleExcerpt} style={{ textWrap: 'balance' }}>"
    ]
  ],
  "features/blog/website-43/Website43ArticleToc.tsx": [
    [
      "data-level={group.primary.level}>",
      "data-level={group.primary.level} style={{ textWrap: 'pretty' }}>"
    ],
    [
      "data-level={heading.level}>",
      "data-level={heading.level} style={{ textWrap: 'pretty' }}>"
    ]
  ]
};
  for (const [original, reviewed] of additions[file] ?? []) {
    assert.equal(source.split(reviewed).length, 2, file + ": one exact scoped Thai wrapping insertion");
    source = source.replace(reviewed, original);
  }
  return source;
}

export function articleOverviewSourceProjection(source) {
  for (const addition of [
    "import Website43ArticleOverview from './Website43ArticleOverview';\n",
    "              {(preview || article.status === 'published') && <Website43ArticleOverview summary={article.geo?.summary} />}\n",
  ]) {
    assert.equal(source.split(addition).length, 2, 'one exact approved published overview insertion');
    source = source.replace(addition, '');
  }
  return source;
}

export function assertReviewedUxOwners(proof, allowed, readCurrent = read) {
  assert.ok(["e7d30c05a340e831756440a21ae8ab515ad7680d90bc333288dac2c3ff996eb7", "a45fec53fee9dc969b817d9d4df4dc96271a4838da22f3c5250e79d55afb2885"].includes(sha(JSON.stringify(proof.reviewedUxOwners))),'previous complete UI admission manifest remains frozen');
  assert.deepEqual(Object.keys(proof.reviewedUxOwners).sort(), [...allowed].sort(), 'Only exact reviewed UI owners are admitted');
  for (const file of allowed) {
    const admission = proof.reviewedUxOwners[file];
    assert.deepEqual(Object.keys(admission).sort(), ['baselineSha256','candidateSha256']);
    assert.equal(admission.baselineSha256, (proof.protected[file] ?? proof.canonical?.[file]), file + ': original protected digest retained');
    assert.match(admission.candidateSha256, /^[0-9a-f]{64}$/);
    if(hasProductionCmsOwner(file)) { assertProductionCmsOwner(file,readCurrent(file)); continue; }
    if (hasReviewedV5Successor(file)) { reviewedV5PredecessorDigest(file, readCurrent(file), admission.candidateSha256); continue; }
    let source = reviewedThaiWrapProjection(file, reviewedArticleCardProjection(file, readCurrent(file)));
    if (file === 'features/blog/website-43/Website43Article.tsx') source = articleOverviewSourceProjection(source);
    let expected = admission.candidateSha256;
    const articleV4 = {
      'components/layout/website-43/Website43.module.css': ['244b11b3d139756c27d99ad67d43f8eeb20287d68fcc8380b90d521c9837be16', 'def909c954d9bd9769e26ba4bac4c2c16de40719affce6668b486423853dbf13'],
      'features/blog/website-43/Website43Article.tsx': ['d6415bfcdee858ba052a3c78077f302463ef1db2ce128cb15257c74653a93bb2', 'c808e31c1e6e43e6c8ca7bb2b41efe7c82c36c696c1b0a1ee0eb6363dfaea3ae'],
    };
    if (articleV4[file]) {
      assert.equal(expected, articleV4[file][0], file + ': previous reviewed candidate retained');
      expected = articleV4[file][1];
    }
    const unusedLegalCss = {
      'components/layout/website-43/Website43.module.css': ['def909c954d9bd9769e26ba4bac4c2c16de40719affce6668b486423853dbf13', '973eed337a31212f28ee1210327773568a8534b6d85142ade317872ac7e49b6d'],
      'components/layout/website-43/Website43ResponsiveStyles.tsx': ['6c90a2136905c48703e1d68108d2bb3fa5d21d8bee64bf25bb4737274c2ed3bb', '49a2b4550755fc02c7c1f145bb5980b267c6a2d82013059cc135cd4ad6464717'],
    };
    if (unusedLegalCss[file]) {
      assert.equal(expected, unusedLegalCss[file][0], file + ': pre-cleanup source retained');
      expected = unusedLegalCss[file][1];
    }
    if (file === 'apps/web/app/layout.tsx') {
      const approved = 'weight: ["300", "400", "500", "600", "700"]';
      assert.equal(source.split(approved).length, 2, 'one noncritical Kanit 500 face');
      source = source.replace(approved, 'weight: ["300", "400", "600", "700"]');
      const critical = 'weight: ["400", "500", "600", "700"]';
      assert.equal(source.split(critical).length, 2, 'one critical Thai Kanit 500 face');
      source = source.replace(critical, 'weight: ["400", "600", "700"]');
      assert.equal(source.split('display: "swap"').length, 3, 'both existing Kanit loaders swap late fonts');
      source = source.replaceAll('display: "swap"', 'display: "optional"');
    }
    const additions = {
      'lib/content/types.ts': ['  optimizedAt?: string;\n', 'import type { ArticleFontSize } from "./article-font-size";\n\n', '  /** Editor-chosen size relative to the surrounding text (Sanity font-size mark). */\n  size?: ArticleFontSize;\n'],
      'lib/content/sanity-schema.ts': ['  contentOptimizedAt: z.string().datetime({ offset: true }).nullish().transform((value) => value ?? undefined).catch(undefined),\n'],
      'lib/content/sanity.ts': ['    optimizedAt: raw.contentOptimizedAt,\n', '  contentOptimizedAt,\n'],
    };
    for (const addition of additions[file] ?? []) {
      assert.equal(source.split(addition).length, 2, file + ': one explicit optimization-date addition');
      source = source.replace(addition, '');
    }
    assert.equal(sha(source), expected, file + ': current reviewed source frozen');
  }
}

const approvedResetGuard = "if (game?.status === 'active' && (game.currentMonth > 1 || game.history.length > 0) && !window.confirm('กลับไปเลือกตัวละครจะเริ่มรอบใหม่ ต้องการเริ่มใหม่หรือไม่?')) return;";
function resetPresentationProjection(source) {
  const tree = parse(controllerPath, source);
  const reset = find(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'returnToCharacterSelection');
  assert(ts.isArrowFunction(reset.initializer) && ts.isBlock(reset.initializer.body));
  const guard = reset.initializer.body.statements[0];
  assert(ts.isIfStatement(guard), 'Reset prompt must be the first statement before events/state changes');
  assert.equal(guard.getText(tree), approvedResetGuard, 'Only the exact approved native reset guard is admitted');
  return source.slice(0, guard.getStart(tree)) + source.slice(guard.end);
}

// Explicit admission to the OLD protected-manifest assertion. No original source
// is returned; current-source readers continue reading current implementations.
export function assertPhase2MoneyComposition(file, expectedBaselineDigest, readCurrent = read) {
  assert.equal(file, controllerPath, 'Only the reviewed Money Story composition is admitted');
  const proof = JSON.parse(readCurrent('qa/phase2-css-delivery-parity.json'));
  const composition = proof.moneyComposition;
  assert.equal(sha(JSON.stringify(composition)), '92b76f2e8c0599731866ca76111ee4887c49d97ef93b2ca1a05b08ec39e61265','entire original Money composition manifest stays frozen');
  assert.equal(composition.controller, controllerPath);
  assert.equal(composition.owner, ownerPath);
  const current = readCurrent(file), owner = readCurrent(ownerPath);
  if(hasProductionCmsOwner(file)) {
    assert.equal(composition.controllerSha256,'1628800ae52abfd0c6b67a636904eb7c717d43058660700aef3bd1a68c8f468d');
    assert.equal(composition.ownerSha256,'6ec4b01b4930d5b14d95073a168e2d87e982ae611edb4945d0ff8accf301ec9b');
    assertProductionCmsOwner(file,current); assertProductionCmsOwner(ownerPath,owner);
    const original = gunzipSync(Buffer.from(proof.moneyOriginalControllerGzip,'base64')).toString();
    assert.equal(sha(original),expectedBaselineDigest,'frozen original Money controller');
    assert.equal(expectedBaselineDigest,composition.baselineSha256);
    assert.equal(composition.test,'tests/money-story-presentation-parity.test.mjs');
    assert.equal(reviewedV5PredecessorDigest(composition.test, readCurrent(composition.test), '2fab8aac076c4fe2f2dbe4a1acfbfe1dc0c19beab4f714495b55324bb5644b5b'),'2fab8aac076c4fe2f2dbe4a1acfbfe1dc0c19beab4f714495b55324bb5644b5b','historical output/action fixture plus exact approved caption inverse');
    return true;
  }
  assert.equal(sha(current), composition.controllerSha256, 'Unreviewed controller composition');
  assert.equal(sha(owner), composition.ownerSha256, 'Unreviewed current sidebar body');
  const original = gunzipSync(Buffer.from(proof.moneyOriginalControllerGzip, 'base64')).toString();
  assert.equal(sha(original), expectedBaselineDigest, 'Original f703 output fixture must match the unchanged protected manifest');
  assert.equal(sha(original), composition.baselineSha256);
  assert.equal(composition.test, 'tests/money-story-presentation-parity.test.mjs');
  assert.equal(sha(readCurrent(composition.test)), composition.outputTestSha256, 'Actual output/action test drift');
  const oldTree = parse(file, original), currentTree = parse(file, resetPresentationProjection(current)), ownerTree = parse(ownerPath, owner);
  const expectedImports = imports(oldTree).map(item => ({ ...item, bindings: item.bindings.filter(([imported, local]) => !['Car', 'HeartPulse', 'House', 'ShieldCheck', 'Users'].includes(imported) || imported !== local) }));
  expectedImports.push({ module: './MoneyStoryStatusSidebar', typeOnly: false, default: null, namespace: null, bindings: ['money', 'MoneyStoryStatusSidebar', 'percentLabel'].map(name => [name, name, false]) });
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
  ], 'Only original presentation dependencies and type-only state contracts belong to the sidebar');
  assert.deepEqual(ownerTree.statements.filter(node => !ts.isImportDeclaration(node)).map(statementName),
    ['money', 'protectionIcons', 'Meter', 'percentLabel', 'MoneyStoryStatusSidebarProps', 'MoneyStoryStatusSidebar'],
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
  for (const name of ['money', 'protectionIcons', 'Meter', 'percentLabel']) {
    const oldNode = oldTree.statements.find(node => statementName(node) === name);
    const newNode = ownerTree.statements.find(node => statementName(node) === name);
    assert(oldNode && newNode, name);
    assert.deepEqual(structure(newNode, { ignoreExport: true }), structure(oldNode), name + ': moved helper body');
  }
  const moved = new Set(['money', 'protectionIcons', 'Meter', 'percentLabel']);
  const keep = node => !ts.isImportDeclaration(node) && !moved.has(statementName(node));
  assert.deepEqual(currentTree.statements.filter(keep).map(node => structure(node, { sidebar: returnedAside })),
    oldTree.statements.filter(keep).map(node => structure(node, { omitProtectionTypes: true })), 'Remaining controller logic and expanded CURRENT sidebar must match f703');
  return true;
}
