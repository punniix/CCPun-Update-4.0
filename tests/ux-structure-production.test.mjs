import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, dirname, relative } from 'node:path';
const require = createRequire(resolve('package.json'));
const ts = require('typescript');
const React = require('react');
const root = resolve('.');
const read = file => readFileSync(resolve(root, file), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const reviewedSourceOwners = {
  "apps/web/app/cookie-policy/page.tsx": "a6925d6982d0251d74542a8c4fdea408082454f243e0f83b52bcec124d767a9a",
  "apps/web/tsconfig.json": "f99e85600f69e583bf2a1ab88fb186f560cc4c8d405cd0dc51e9c949b69f7bbe",
  "components/layout/website-43/Website43.module.css": "244b11b3d139756c27d99ad67d43f8eeb20287d68fcc8380b90d521c9837be16",
  "components/layout/website-43/Website43Legal.module.css": "7a991a55a0c19ac7fe7152c3abbf979dfcf7a4d91223faaa3ae166b4aeb0a6f5",
  "components/layout/website-43/Website43Navbar.module.css": "16cb8c7d1f18bbb201f704429e0264789c8a8a820cd36db97c7e3e98ffbb2492",
  "components/layout/website-43/Website43Navbar.tsx": "3ec52233fa899aa0792fd7555ee7e4d822cd53d9db1367225b394628254543f3",
  "components/layout/website-43/Website43ResponsiveStyles.tsx": "6c90a2136905c48703e1d68108d2bb3fa5d21d8bee64bf25bb4737274c2ed3bb",
  "components/layout/website-43/Website43Shared.tsx": "45433f4cf955c8705f020303cfefd51acba6fcf5e401654df8f0c1f3379ac8b6",
  "components/layout/website-43/Website43ToolHero.tsx": "bfd8593bf862935f0215c1c11c6da2a16c6665c959e80d17c7e521dba3611446",
  "components/ui/FunctionalMotion.module.css": "92b7093d9ccdf90e08c29520e3d50c6537339f88dce6ea98781084ccd357c873",
  "components/ui/HumanCalculatorCard.tsx": "4e8acb7c79693ab5fecb45383355324a808109a7441e55a421b3c63f8b4cf1c4",
  "features/analytics/components/CookieConsent.tsx": "c33b93274de762aaf9a08536de65c6263da761513edab7d11c37f5f22632ec87",
  "features/analytics/components/CookieConsentPreferences.tsx": "bfa0c44d6fd9342349227b69c4a249845d48ab1c49ac321ff7c85d51d4fc09b7",
  "features/blog/pages/BlogArchivePage.tsx": "8e79c488b53718920e07184bb7e65d199ea4d6f2aa3421d48f9b98589bef589c",
  "features/blog/pages/BlogCategoryPage.tsx": "1411abf041ec54d8e83d22510b90c923d497f46ec292434d56bdcc8b560e246d",
  "features/blog/website-43/Website43Article.tsx": "d6415bfcdee858ba052a3c78077f302463ef1db2ce128cb15257c74653a93bb2",
  "features/blog/website-43/Website43ArticleBody.tsx": "a6e73b3fe0e67d728be2e4d26083ae08be17ad4493c31431145b8d74297dba07",
  "features/blog/website-43/Website43Blog.tsx": "4fab6ca4931b548211cf63917f3ea901c9798ad44e68f51bf1acc3832fdf3bad",
  "features/blog/website-43/Website43BlogInteractive.tsx": "229035fb264ee95052543622aee9211f18d4badd314af8accbba72f78b14ad80",
  "features/ci-planning/components/CIWizard.tsx": "6f529c5234721605ecea12651351f09129f9c79827dc6c8b8173187ca8e2b86f",
  "features/ci-planning/components/steps/ExpenseObligationsSection.tsx": "a7c2e89457fba2da585cf9972df44113597023c2ae7bb3de6c82c906639fcd6c",
  "features/ci-planning/components/steps/RecoveryReserveSection.tsx": "8d13ccb26c52c52f1e3429ac181afb58e1d6922232864e5dc143a9cd6c95060b",
  "features/ci-planning/components/steps/StepExpenses.tsx": "d178d58769cbd134d8414c0625e7083547cc49cca422d7e3665020074976a1a7",
  "features/ci-planning/page.tsx": "40a9e9759455373cc7a757bcf7e3fc5b369f702f1542d2225f33d1aec68602fb",
  "features/financial-health-check/components/ClientFHC.tsx": "88f007c1e6c33d83bd4befdd69985363609f6c2ddb230861d548cba49c7e0fa2",
  "features/financial-health-check/components/LifeCoverageWizard.tsx": "89448a29974ef184232d2a9aa7a47e588cd7b748106a6bd496ae64f2a6f09dd5",
  "features/home/website-43/Website43Home.tsx": "dc2a4efb448ab859570a55a53344c9f88007f19e39a6f497d18185c0ffc9f30e",
  "features/home/website-43/Website43HomeStatic.tsx": "854a75321d4511223729efc377a581d0f3581838faf37dd12f7b532f88b612d2",
  "features/money-story/MoneyStory.module.css": "40b39bf243365a0888163b8a3b7dfc2d53f8a37fb92e5802f8fc12e167917a61",
  "features/money-story/components/MoneyStoryGame.tsx": "1628800ae52abfd0c6b67a636904eb7c717d43058660700aef3bd1a68c8f468d",
  "features/money-story/components/MoneyStoryScreens.tsx": "bd05ee383cf07515b97e679ee79c1de4200d5a1253796aae96399cd62d02c618",
  "features/money-story/page.tsx": "82f5d5c4e21df8663c7881e7dc7d1793654f84ee7875654ac27f75f98d32b45b",
  "apps/web/static-images.d.ts": "fe57bd015bfec7883efee95cfa98ec8ffd4806c505c4a9ad3ccacc6275ac5579",
  "components/ui/health-happy/HealthHappyCountdown.module.css": "73e39a9e3f17af98b25e9a12b706d0a9729260aced6bd47425e79dd9ec6e9766",
  "components/ui/health-happy/HealthHappyCountdown.tsx": "8932c557a75fe8d3a79cc2b65624d6b6cc3f21f090e8f04650f1b24ecb9f1f35",
  "features/blog/website-43/ArticleDetailAccess.tsx": "a25a584fede138b706ad3b61064b49da3c5ddd443529d6cf89aef015eb547dc1",
  "features/blog/website-43/BlogNavigation.ts": "c978030ce80dce3ada76d3269f098c200b12c581d259fb4d8e6fecd4b8f1ff84",
  "features/blog/website-43/BlogReturnLink.tsx": "77a3ef1c5f7eb02e91e425e400d4c289d5e329aa400c33ac0f7484eeb991a556",
  "lib/runtime/investment-availability.ts": "d7dadd956963e82c6efe4dd966a8710c44aed30d325e5f7f246261ffa3bfc3fa"
};
const protectedProduction = {
  "apps/web/app/sitemaps/blog.xml/route.ts": "36f23c2cbece5321f361cada7232bcc958f038b9496ebf62185c0167ff967162",
  "apps/web/app/sitemaps/core.xml/route.ts": "b65773febf84cb13cc71d28b59d35b1d812db008e721f3c011eca2736c48b7ce",
  "apps/web/app/sitemaps/tools.xml/route.ts": "d6f0a88e8e082af3045cd5a4b132241444d50164c9293ec36e647087993033f0",
  "apps/web/next.config.ts": "2c21e02a2bd71080f5c5a339338f9ad520b99d629598ad0fe105a7c3f8a16cf4",
  "apps/web/scripts/build-provider.mjs": "90a606fc6d04947385989fac4f6ce2f43f10d214c4fabc72dcc465e378de84bd",
  "features/analytics/components/GoogleAnalytics.tsx": "6caff27b5dec7cf21bb6b6c29149c031e47f12828090e7bdd0c26a7f5192f64f",
  "features/analytics/components/GoogleTagManager.tsx": "1de8f93231a01fcdf669f7331a01de3bc2345a62934a209e92120198639bdf23",
  "features/analytics/components/MetaPixel.tsx": "a1c57275db8692a6487b08ad0a291742d11b1209070461f7b433e7086713a6ea",
  "features/blog/pages/ArticlePage.tsx": "c951fa95c6b892baf46e25d3e73f50ad296177ae3aaa99497a7a0ad019192303",
  "features/ci-planning/calculator/calculator.ts": "1e41d688787bddfed147b5f36188ebb858d5e512e5a5983d9306dfa44f8fa03d",
  "features/ci-planning/calculator/constants.ts": "ccdafe5526f8dfe32d129e6f74b0f574f07dbed3aa62d6fa3eb612ed44dbd9c9",
  "features/ci-planning/calculator/schemas.ts": "53965eb168b40043cfc007f96f7ade90344866e177bb828eb5bba6afd8b2bb46",
  "features/ci-planning/components/steps/StepExpenses.model.ts": "c432bcdcb7d5b6720043e2501144f1ac5af5034ad7ea8b2af59637bcf2fd81c9",
  "features/ci-planning/result-image.ts": "477c7e2abb1f71db62b0febae624f85135a97290507d5659ffa3b198e3023889",
  "features/financial-health-check/components/lifeCoverageModel.ts": "2d3af15e5c5a0250adf0840a61348acb333caa29595cab7570a5af7e063abd9f",
  "features/money-story/characters.ts": "47cdefc39c897d012cae539d08d8899a5602ff3bf398db20dd7949adc93f86c9",
  "features/money-story/config.ts": "2cc4d066a5e80ed042ddd877d8e312b2b4f1cd022eb642ae9d35d4d11269ccc4",
  "features/money-story/engine-debt.ts": "7a1bd8f924da752aaa820f9fa9e98cf4eda9bddd207190681197a53cf1f4fb87",
  "features/money-story/engine-events.ts": "14190fdf6ff68b29d5c33ce818cbf0d5f1983ea0976e9cae58399d8518ba4354",
  "features/money-story/engine-recovery.ts": "9de75f4a3f2958ae18f89ff8274ab4201b66fd9f4dcb3d27de04f813ff8d1732",
  "features/money-story/engine-state.ts": "9d456c5dbfe8766fb49ff873c79cea9e7bca543ead693cec950da7755ea04c73",
  "features/money-story/engine.ts": "3fef4c106b7177d1276d44a0646027edf4d2cb2eb0352c0c5b9ad5f2db4a0d16",
  "features/money-story/events.ts": "241213f7d1aeb6181b8df6cb92f5d1316cf0110cf0fc3db59d8517352112478e",
  "features/money-story/financial-metrics.ts": "95587d3219a6ddcd14dd0b5179b931b6b6bc414bfc0bf1fb79d2e2bb586078cd",
  "lib/analytics.ts": "43b1abf55778f2dc562e79dd632573006aafbc401ff3423223d9395722681211",
  "lib/content/category-registry-sanity.ts": "6e16064dd7c82072f843bb9c3c92b363054769e4e2fe376d1253916cc0d5bba4",
  "lib/content/category-registry.ts": "7c6925e218f4e419948255580f5cbff3d058e136a819b53f1db90c6125ce1f14",
  "lib/content/provider.ts": "ba16b36c0804a619f16518ad92e29861c0a2ac7729f361b72c3f1d7dcd4b3954",
  "lib/content/sanity-lane.ts": "dde4086c7598aae795ab10f9273758e53544d468a5ebe4811e226cc47e3456ef",
  "lib/cookie-consent.ts": "baf8c726c0ff5740c0267df87987fde845cc6966173e7b1ffbd75cbcb51cb007",
  "lib/deployment-environment.ts": "c80458f09dcd398b91a59e29bae88a16e49f3e997a3cf41daae346d34cda931a",
  "lib/runtime/deployment-contract.ts": "6e21e4a338f4c6e19fe0e3288536d346026bfc00830e2a3878a24f9b3b253f05",
  "lib/runtime/deployment-identity.ts": "d9b606d8064d1f4b5b72d7f20594519bc2524c925bbfff9228875f78083a2fa9",
  "lib/runtime/deployment-lanes.mjs": "5a56b8ee085a5aca064eee2e3573cdcbc5803a8412153d3c2d5c62c98ee0fc6c",
  "package-lock.json": "f9184e3de2ae3fd8f9a9f3e62fec7b88434d4811c2a4653db631f712a1dfe8b5",
  "package.json": "a1897b986acc1852e129e03218b53637fd4433c899bb0accf90ded31f5a151cc",
  "proxy.ts": "c39fee661df6235e976de34d66353fd605e75cca6043a7eb63792e2a0a3b2a9a"
};
function files(directory) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(item => {
    const path = `${directory}/${item.name}`;
    return item.isDirectory() ? files(path) : /\.[cm]?[jt]sx?$/.test(path) ? [path] : [];
  });
}
function ownedImport(from, specifier) {
  const base = specifier.startsWith('@/') ? resolve(root, specifier.slice(2)) : specifier.startsWith('.') ? resolve(dirname(resolve(root, from)), specifier) : null;
  if (!base) return null;
  for (const suffix of ['', '.ts', '.tsx', '.mjs', '.js', '.json', '/index.ts', '/index.tsx']) {
    const target = base + suffix;
    if (existsSync(target)) { try { readFileSync(target); return relative(root, target); } catch { /* directory */ } }
  }
  return null;
}
function closure(entries) {
  const seen = new Set(), queue = [...entries];
  while (queue.length) {
    const file = queue.pop(); if (seen.has(file)) continue;
    seen.add(file); if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
    const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
    const visit = node => {
      let literal;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) literal = node.moduleSpecifier;
      else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(tree) === 'require')) literal = node.arguments[0];
      if (literal && ts.isStringLiteral(literal)) { const target = ownedImport(file, literal.text); if (target) queue.push(target); }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  return seen;
}
const forbidden = /(?:uat-tax-table-fixture|uat-public-article-snapshots|uat-public-snapshot|investment-allocation)/;

test('all actual Root/Web entry imports exclude UAT content and separated Investment features', () => {
  const entries = files('apps/web/app').filter(file => /(?:page|route|layout|not-found|robots)\.[jt]sx?$/.test(file));
  const publicRoots = ['app/layout.tsx','app/page.tsx','app/blog/page.tsx','app/blog/[category]/page.tsx','app/blog/[category]/[slug]/page.tsx','app/ci-planning/page.tsx','app/tools/financial-health-check/page.tsx','app/play/money-story/page.tsx','app/cookie-policy/page.tsx','app/privacy/page.tsx','app/not-found.tsx','app/sitemap.xml/route.ts','app/sitemaps/core.xml/route.ts','app/sitemaps/blog.xml/route.ts','app/sitemaps/tools.xml/route.ts'];
  assert(entries.length > 10);
  for (const file of closure([...entries, ...publicRoots])) assert.doesNotMatch(file, forbidden, file);
  for (const directory of ['features/investment-allocation','apps/web/app/tools/investment-allocation','apps/web/app/api/investment-allocation','app/tools/investment-allocation','app/api/investment-allocation']) assert.equal(existsSync(resolve(root, directory)), false, directory);
  for (const file of ['lib/content/uat-tax-table-fixture.ts','lib/content/uat-tax-table-fixture.json','lib/content/uat-public-article-snapshots.json']) assert.equal(existsSync(resolve(root, file)), false, file);
});

test('Investment release capability remains false even with explicit environment1 and cannot enter navigation/sitemap/meta', () => {
  const source = read('lib/runtime/investment-availability.ts');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const before = process.env.CCPUN_INVESTMENT_ALLOCATION_ENABLED;
  try {
    process.env.CCPUN_INVESTMENT_ALLOCATION_ENABLED = '1';
    const loaded = { exports: {} };
    new Function('require','module','exports',compiled)(id => { assert.equal(id, 'server-only'); return {}; },loaded,loaded.exports);
    assert.equal(loaded.exports.INVESTMENT_ALLOCATION_ENABLED, false);
  } finally { if (before === undefined) delete process.env.CCPUN_INVESTMENT_ALLOCATION_ENABLED; else process.env.CCPUN_INVESTMENT_ALLOCATION_ENABLED = before; }
  for (const file of ['components/layout/website-43/Website43Navbar.tsx','components/layout/website-43/Website43Shared.tsx','features/home/website-43/Website43Home.tsx','features/home/website-43/Website43HomeStatic.tsx','lib/nav-config.json','public/nav-config.json', ...files('apps/web/app/sitemaps')]) assert.doesNotMatch(read(file), /investment-allocation|INVESTMENT_TOOL_LINK/, file);
});

function packageBeforePostPublishScripts(source) {
  const manifest = JSON.parse(source);
  for (const [name, value] of Object.entries({
    'worker:seo-post-publish': 'node --conditions=react-server --import tsx scripts/seo-post-publish-worker.ts',
    'nav:check': 'node scripts/sync-public-nav-config.mjs --check',
    'nav:sync:write': 'node scripts/sync-public-nav-config.mjs --write',
  })) {
    assert.equal(manifest.scripts[name], value, 'only the reviewed Production script is admitted');
    delete manifest.scripts[name];
  }
  return JSON.stringify(manifest, null, 2) + '\n';
}

test('Production providers, metadata, models, engines, tracking, consent storage and delivery contract stay protected', () => {
  // Retain the deployed 7951 tracking baseline while admitting only the reviewed
  // UAT cookie-isolation fix, covered by analytics-component-regression.mjs.
  const analyticsPath = 'features/analytics/components/GoogleAnalytics.tsx';
  assert.equal(protectedProduction[analyticsPath], '6caff27b5dec7cf21bb6b6c29149c031e47f12828090e7bdd0c26a7f5192f64f');
  const semanticPath = 'lib/analytics.ts';
  assert.equal(protectedProduction[semanticPath], '43b1abf55778f2dc562e79dd632573006aafbc401ff3423223d9395722681211');
  for (const [file,digest] of Object.entries(protectedProduction)) {
    const reviewedDigest = file === analyticsPath
      ? '6379bb9a48584a748980f1163458150776410ce32d71c782bfd3529fdb295b6a'
      : file === semanticPath ? '4176646b29ae2614cc044fef35d9be7cdffe8cfb303c8519f86fe71c148cd90f' : digest;
    assert.equal(sha(file === 'package.json' ? packageBeforePostPublishScripts(read(file)) : read(file)), reviewedDigest, file);
  }
});

test('Production script admission rejects unknown scripts, changed commands and dependency drift', () => {
  const manifest = JSON.parse(read('package.json'));
  const altered = value => sha(packageBeforePostPublishScripts(JSON.stringify(value)));
  assert.notEqual(altered({ ...manifest, scripts: { ...manifest.scripts, unreviewed: 'new-command' } }), protectedProduction['package.json']);
  assert.notEqual(altered({ ...manifest, dependencies: { ...manifest.dependencies, unreviewed: '1.0.0' } }), protectedProduction['package.json']);
  assert.throws(() => altered({ ...manifest, scripts: { ...manifest.scripts, 'nav:check': 'unreviewed' } }));
});

function loadArchive(articles, registry) {
  const Page = props => React.createElement('archive-proof', props);
  const mocks = {
    'next/headers': { draftMode: async () => ({ isEnabled: false }) },
    '@/features/blog/website-43/Website43Blog': { __esModule: true, default: Page },
    '@/features/blog/website-43/blogData': { toWebsite43ArticleItems: x => x, toWebsite43ArticleItemsInOrder: x => x },
    '@/lib/content/provider': { getContentProvider: () => ({ listArticles: async () => articles }) },
    '@/lib/deployment-environment': { IS_DRAFT_PREVIEW_ALLOWED: false },
    '@/lib/content/category-registry': { listCategoryMenuEntries: entries => entries.entries.filter(x => x.status === 'active') },
    '@/lib/content/category-registry-sanity': { listCategoryRegistry: async () => registry },
    '@/lib/content/blog-featured-sanity': { listBlogFeaturedArticleIds: async () => [] },
    '@/lib/content/featured-articles': { curateFeaturedArticles: () => [] },
    '@/lib/content/structured-data/serialize-json-ld': { serializeJsonLd: JSON.stringify },
    '@/lib/content/structured-data/article-schema': { buildBlogArchiveSchema: () => ({}) },
  };
  const compiled = ts.transpileModule(read('features/blog/pages/BlogArchivePage.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  new Function('require','module','exports',compiled)(id => Object.hasOwn(mocks,id) ? mocks[id] : require(id),loaded,loaded.exports);
  return { module: loaded.exports, Page };
}
test('actual archive route sends only published provider records/active registry and honest querypage to UI', async () => {
  const records = Array.from({ length: 10 }, (_, index) => ({ id: `production-${index}`, status: 'published', title: `published${index}`, category: 'personal-finance' }));
  records.push({ id: 'draft-excluded', status: 'draft' });
  const registry = { entries: [{ slug:'personal-finance', title:'Original physical category', status:'active' }, { slug:'hidden', title:'Disabled', status:'disabled' }] };
  const { module: archiveModule, Page } = loadArchive(records,registry);
  const tree = await archiveModule.default({ searchParams: Promise.resolve({ page:'2', q:'' }) });
  const page = React.Children.toArray(tree.props.children).find(x => x.type === Page);
  assert.deepEqual(page.props.articles, records.slice(0,10));
  assert.deepEqual(page.props.categories, [{ slug:'personal-finance',title:'Original physical category' }]);
  assert.equal(page.props.initialPage,'2');
  const empty = loadArchive([], { entries:[] });
  const emptyTree = await empty.module.default({ searchParams: Promise.resolve({}) });
  const emptyPage = React.Children.toArray(emptyTree.props.children).find(x => x.type === empty.Page);
  assert.deepEqual(emptyPage.props.articles,[]); assert.deepEqual(emptyPage.props.categories,[]);
});

// Reviewed Article/H4/Author candidate updates retain original baseline hashes in the parity manifests.
test('all39 approved source records retain provenance with exact reviewed Article and image URL ownership', () => {
  assert.equal(Object.keys(reviewedSourceOwners).length,39);
  const retired = 'features/blog/website-43/BlogReturnLink.tsx';
  assert.equal(reviewedSourceOwners[retired], '77a3ef1c5f7eb02e91e425e400d4c289d5e329aa400c33ac0f7484eeb991a556');
  assert.equal(existsSync(resolve(root, retired)), false, 'Retired link has no route/import owner and must remain absent');
  for (const [file,digest] of Object.entries(reviewedSourceOwners)) {
    if (file === retired) continue;
    const source = read(file);
    if (file === 'components/ui/health-happy/HealthHappyCountdown.module.css') {
      const asset = 'assets/blog-migration/aia-health-happy-describe/featured-01-AIA-Health-Happy-article.png';
      const derived = asset.replace('.png', '.lossless.webp');
      const resolved = `url('../../../public/${derived}')`;
      assert.equal(source.split(resolved).length, 2, 'exactly one native module-resolved background');
      assert.equal(sha(source.replace(resolved, `url('/${asset}')`)), digest, 'only image URL ownership may change; all visual CSS stays byte-exact');
      assert.equal(sha(readFileSync(resolve(root, 'public', asset))), '3b70e95f0c0e6d15afc8c43aceb1283220c170de3c3fba9440d0091374a9e428', 'same original PNG bytes');
      assert.equal(sha(readFileSync(resolve(root, 'public', derived))), '0691ec77ae85113dc3ed87e6d26025f3d5a56db12ce3e144092b790e5dae2d4f', 'reviewed lossless WebP derivative retains decoded pixels and metadata');
    } else if (file === 'components/layout/website-43/Website43.module.css') {
      assert.equal(digest, '244b11b3d139756c27d99ad67d43f8eeb20287d68fcc8380b90d521c9837be16');
      // Previous V4 source def909c954d9bd9769e26ba4bac4c2c16de40719affce6668b486423853dbf13 stays pinned in phase2-source-proof.
      assert.equal(sha(source), '973eed337a31212f28ee1210327773568a8534b6d85142ade317872ac7e49b6d', 'reviewed V4 CSS minus nine unused legal rules');
    } else if (file === 'components/layout/website-43/Website43ResponsiveStyles.tsx') {
      assert.equal(digest, '6c90a2136905c48703e1d68108d2bb3fa5d21d8bee64bf25bb4737274c2ed3bb');
      assert.equal(sha(source), '49a2b4550755fc02c7c1f145bb5980b267c6a2d82013059cc135cd4ad6464717', 'only unused legal selectors removed');
    } else if (file === 'features/blog/website-43/Website43Article.tsx') {
      assert.equal(digest, 'd6415bfcdee858ba052a3c78077f302463ef1db2ce128cb15257c74653a93bb2');
      assert.equal(sha(source), 'c808e31c1e6e43e6c8ca7bb2b41efe7c82c36c696c1b0a1ee0eb6363dfaea3ae', 'reviewed Article V4 composition only');
    } else assert.equal(sha(source),digest,file);
  }
});
