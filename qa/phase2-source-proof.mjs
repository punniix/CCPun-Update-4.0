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
  'apps/web/next.config.ts': ['d4cf8aa0725fdf58263e3f68776db192fa39bfa1e7578b8cb7f715a7e5face9f', '28f066c8bc89415d8292c10ef68809620d0144837740dd63731fee7c71d9e98e'],
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
  if (file === 'components/ui/health-happy/HealthHappyCountdown.module.css' && sha(source) === '6939d5f7bd043e3e81d81e0cbe7d0bbc4603329c3d7665d8905b8f6ebdff7328') {
    const block = "\n/* Native 820 Tablet48: all four time units remain in one row, with balanced equal-width CTAs.\n   The centered action area ends before the bottom-right LINE dock at 768/820px. */\n@media (min-width: 768px) and (max-width: 1023px) {\n  .splitDigits:is([data-campaign-placement=\"home\"], [data-campaign-placement=\"blog\"], [data-campaign-placement=\"article\"]) .numeral { font-size: 48px; line-height: 1.15; }\n  .splitDigits:is([data-campaign-placement=\"home\"], [data-campaign-placement=\"blog\"], [data-campaign-placement=\"article\"]) .timeLabel { font-size: 18px; line-height: 1.5; }\n  .splitDigits:is([data-campaign-placement=\"home\"], [data-campaign-placement=\"blog\"], [data-campaign-placement=\"article\"]) .actions { width: min(620px, calc(100% - 80px)); max-width: 100%; margin-inline: auto; padding-inline-end: 0; justify-self: center; }\n}\n";
    assert.ok(source.endsWith(block), 'exact native-first Tablet48 and centered CTA successor');
    source = source.slice(0, -block.length);
    assert.equal(sha(source), '4af5e5a6ebd794e41453a76ae8fe409b498daa1ee888acce2ab1a059ad354122', 'full unchanged reviewed Countdown predecessor retained');
  }
  if (file === "features/money-story/MoneyStory.module.css" && sha(source) === "d54020cbfe6f19c92f32f7d59875fff470a17c9ab6570ac6bde3f4e471b57ec1") {
    const block = "\n/* Approved portrait endings retain the separate real result, all history/actions and the full LINE explanation. */\n@media (min-width: 768px) and (max-width: 1023px) {\n  .shell:has(> .result) { min-height: 0; background: var(--v5-card); overflow: visible; }\n  .result { padding: 24px; font-size: 18px; line-height: 1.75; }\n  .resultHero h2 { font-size: 32px; line-height: 1.4; }\n  .resultHero p, .resultLead { font-size: 18px; line-height: 1.75; }\n  .root .resultSnapshot { padding: 16px; border-radius: 16px; background: var(--v5-card); }\n  .resultSnapshot h3, .resultGrid h3, .lineCard h3 { font-size: 22px; line-height: 1.5; }\n  .resultNumbers { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }\n  .numberBox { min-height: 88px; padding: 12px; border-radius: 12px; background: var(--v5-bg-alt); }\n  .result .numberBox small, .result .numberBox span { font-size: 16px; line-height: 1.7; }\n  .numberBox strong { font-size: 22px; line-height: 1.4; }\n  .resultCompare { font-size: 18px; line-height: 1.75; }\n  .resultGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }\n  .root .resultGrid .card { padding: 16px; border-radius: 16px; background: var(--v5-card); }\n  .resultWide { grid-column: 1 / -1; }\n  .result .decisionList strong, .result .decisionList span, .result .decisionList small,\n  .result .watchList li, .result .timeline li, .result .emptyResultNote { font-size: 18px; line-height: 1.75; }\n  .resultActions { gap: 12px; margin-top: 20px; }\n  .result .resultActions > :is(a, button) { flex: 0 1 224px; min-width: 0; min-height: 44px; font-size: 16px; line-height: 1.7; }\n  .lineCard { padding: 16px; border-radius: 16px; font-size: 18px; line-height: 1.75; }\n  .lineCard .primary { min-height: 44px; font-size: 16px; line-height: 1.7; }\n}\n";
    assert.ok(source.endsWith(block), "exact approved separate final-result CSS tail");
    source = source.slice(0, -block.length);
    assert.equal(sha(source), "f55d3a723d6abf9870382dd7da6f73c82fbd1a29dc012fca46d2ecf8406e3345", "complete reviewed initial and active-state predecessor retained");
  }
  if (file === "components/ui/health-happy/HealthHappyCountdown.module.css" && sha(source) === "4af5e5a6ebd794e41453a76ae8fe409b498daa1ee888acce2ab1a059ad354122") {
    const block = "\n/* Approved all-width Home/Blog/Article actions: protect hit regions while the complete card stays balanced. */\n@media (max-width: 767px) {\n  .splitDigits:is([data-campaign-placement=\"home\"], [data-campaign-placement=\"blog\"], [data-campaign-placement=\"article\"]) .actions { padding-inline-end: 64px; }\n}\n@media (min-width: 1024px) {\n  .splitDigits:is([data-campaign-placement=\"home\"], [data-campaign-placement=\"blog\"], [data-campaign-placement=\"article\"]) .frame { grid-template-columns: minmax(0, 1fr) 360px; gap: 16px 24px; padding: 24px; }\n  .splitDigits:is([data-campaign-placement=\"home\"], [data-campaign-placement=\"blog\"], [data-campaign-placement=\"article\"]) .actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-column: 1 / -1; gap: 12px; padding-inline-end: max(168px, calc(248px - var(--v5-gutter) - 24px)); }\n}\n\n/* Article shares the same full-shell tablet card without reserving an asymmetric outer strip. */\n@media (min-width: 768px) and (max-width: 1023px) {\n  .splitDigits[data-campaign-placement=\"article\"] .frame { grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 24px; }\n  .splitDigits[data-campaign-placement=\"article\"] .timer { grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 16px; border: 1px solid var(--v5-border-soft, #5b4848); background: var(--v5-bg, #251818); }\n  .splitDigits[data-campaign-placement=\"article\"] .numeral { font-size: 28px; }\n  .splitDigits[data-campaign-placement=\"article\"] .actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding-inline-end: 64px; }\n}\n";
    assert.ok(source.endsWith(block), "exact approved portrait/action-only CSS tail");
    source = source.slice(0, -block.length);
    assert.equal(sha(source), "6251e662de822257a16445d3696435d43f31312c0be0d0c8c80f772d14135ff6", "complete reviewed predecessor retained");
  }
  if (file === "features/money-story/MoneyStory.module.css" && sha(source) === "f55d3a723d6abf9870382dd7da6f73c82fbd1a29dc012fca46d2ecf8406e3345") {
    const block = "\n/* Approved portrait tablet character picker; every original character and game state stays single-owner. */\n@media (min-width: 768px) and (max-width: 1023px) {\n  :global(section):has(.start) { padding-block: 64px; }\n  .shell:has(> .start) { min-height: 0; border: 0; background: transparent; overflow: visible; }\n  .start { padding: 0; text-align: left; }\n  .startIcon { display: none; }\n  .start h2 { font-size: 28px; font-weight: 500; line-height: 1.4; }\n  .start p { max-width: none; margin: 12px 0 0; font-size: 18px; line-height: 1.75; }\n  .start > .characterPicker { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; max-width: none; margin: 32px 0 0; padding: 0; }\n  .characterPickCard { grid-template-columns: 72px minmax(0, 1fr); gap: 4px 10px; min-height: 180px; padding: 16px; border-radius: 24px; background: var(--v5-card); }\n  .characterPickCopy strong { font-size: 22px; font-weight: 600; line-height: 1.35; }\n  .characterPickCopy > span { font-size: 16px; line-height: 1.7; }\n  .start .characterPickCopy em, .start .characterPickCopy small { font-size: 18px; line-height: 1.75; }\n  .startActions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); justify-content: start; gap: 12px; max-width: 520px; margin-top: 32px; }\n  .startActions .primary, .startActions .secondary { min-width: 0; min-height: 56px; font-size: 18px; }\n}\n\n/* Approved native active/recovery game: actual profile/main/status siblings, without moving data or controls. */\n@media (min-width: 768px) and (max-width: 1023px) {\n  .shell:has(> .game) { min-height: 0; border: 0; background: transparent; overflow: visible; }\n  .game { display: grid; grid-template-columns: minmax(0, 1fr) 248px; gap: 24px; align-items: start; }\n  .sideLeft { grid-column: 1 / -1; grid-row: 1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 24px; padding: 20px; border: 1px solid var(--ms-border); border-radius: 24px; background: var(--v5-card); }\n  .characterTop { grid-column: 1; grid-row: 1 / span 2; grid-template-columns: 88px minmax(0, 1fr); }\n  .characterName { font-size: 24px; font-weight: 500; line-height: 1.5; }\n  .characterRole { font-size: 16px; line-height: 1.7; }\n  .sideLeft .story, .sideLeft .trait { grid-column: 2; display: block; margin: 0; font-size: 18px; line-height: 1.75; }\n  .sideLeft .goalText { grid-column: 1 / -1; margin: 0; font-size: 18px; line-height: 1.75; }\n  .sideLeft .changeCharacterButton { grid-column: 1 / -1; justify-self: start; width: auto; min-height: 44px; margin-top: 8px; font-size: 16px; line-height: 1.7; }\n  .center { grid-column: 1; grid-row: 2; padding: 0; }\n  .center .card { padding: 20px; }\n  .center .eventTitle { font-size: 28px; font-weight: 500; line-height: 1.4; }\n  .center .eventText, .center .choice, .center .recoveryChoice { font-size: 18px; line-height: 1.75; }\n  .center .choice, .center .recoveryChoice { min-height: 44px; padding: 20px; }\n  .center .choice .choiceImpact, .center .recoveryChoice span { font-size: 18px; line-height: 1.75; }\n  .center .primary, .center .secondary, .center .danger { min-height: 44px; font-size: 16px; line-height: 1.7; }\n  .center .balanceSummary small { font-size: 16px; line-height: 1.7; }\n  .center .balanceSummary strong { font-size: 18px; line-height: 1.7; }\n\n  .center .undoButton { min-height: 44px; font-size: 16px; line-height: 1.7; }\n  .sideRight { grid-column: 2; grid-row: 2; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 20px; border: 1px solid var(--ms-border); border-radius: 24px; background: var(--v5-card); font-size: 16px; line-height: 1.7; }\n  .root .sideLeft, .root .sideRight { background: var(--v5-card); }\n  .sideRight .sidebarHeading h3, .sideRight .meterHeader span:last-child,\n  .sideRight .coverageTitle span, .sideRight .coverageTitle strong, .sideRight .coverageMissing span,\n  .sideRight .goalReserveNote small { font-size: 16px; line-height: 1.7; }\n  .sideRight .sidebarSection { padding-block: 12px; min-width: 0; }\n  .sideRight .sidebarSection:first-child { padding-top: 0; }\n  .sideRight .sidebarSection:last-child { grid-column: auto; padding-bottom: 0; }\n  .sideRight .meterHeader, .sideRight .meterDetail, .sideRight .meterDetail span, .sideRight .meterDetail small,\n  .sideRight .goalNext, .sideRight .goalFormula, .sideRight .coverageItem small, .sideRight .coverageMissing, .sideRight .coverageMissing small { font-size: 16px; line-height: 1.7; }\n}\n";
    assert.ok(source.endsWith(block), "exact approved portrait/action-only CSS tail");
    source = source.slice(0, -block.length);
    assert.equal(sha(source), "c6ab64a3b945c443623214ba42fc949af830842b23ae28026f1424f3c011890a", "complete reviewed predecessor retained");
  }
  if (file === 'components/ui/health-happy/HealthHappyCountdown.module.css' && sha(source) === '6251e662de822257a16445d3696435d43f31312c0be0d0c8c80f772d14135ff6') {
    const block = "\n/* Approved Blog tablet countdown uses the same full-width four-unit card and local action clearance. */\n@media (min-width: 768px) and (max-width: 1023px) {\n  .splitDigits[data-campaign-placement=\"blog\"] .frame { grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 24px; }\n  .splitDigits[data-campaign-placement=\"blog\"] .timer { grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 16px; border: 1px solid var(--v5-border-soft, #5b4848); background: var(--v5-bg, #251818); }\n  .splitDigits[data-campaign-placement=\"blog\"] .numeral { font-size: 28px; }\n  .splitDigits[data-campaign-placement=\"blog\"] .actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding-inline-end: 64px; }\n}\n";
    assert.ok(source.endsWith(block), 'exact approved Blog tablet countdown block');
    source = source.slice(0, -block.length);
    assert.equal(sha(source), '2518f7bc852fdcc7daddbdf3f1a703e57260ebf723296369bf8fd3088d131158', 'reviewed Home tablet countdown successor retained');
  }
  if (file === 'components/ui/health-happy/HealthHappyCountdown.module.css' && sha(source) === '2518f7bc852fdcc7daddbdf3f1a703e57260ebf723296369bf8fd3088d131158') {
    const block = "\n/* Home tablet card keeps full-width copy/timer; only the two action hit regions clear LINE. */\n@media (min-width: 768px) and (max-width: 1023px) {\n  .splitDigits[data-campaign-placement=\"home\"] .frame { grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 24px; }\n  .splitDigits[data-campaign-placement=\"home\"] .timer { grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 16px; border: 1px solid var(--v5-border-soft, #5b4848); background: var(--v5-bg, #251818); }\n  .splitDigits[data-campaign-placement=\"home\"] .numeral { font-size: 28px; }\n  .splitDigits[data-campaign-placement=\"home\"] .actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding-inline-end: 64px; }\n}\n";
    assert.ok(source.endsWith(block), 'exact approved Home tablet countdown block');
    source = source.slice(0, -block.length);
    assert.equal(sha(source), '05b5e5726c6227036dbf0a18b63cc8a05420a51ec32464be4e0b713c9647e14c', 'complete original flat countdown CSS retained');
  }
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
