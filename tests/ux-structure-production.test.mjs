import { assertProductionCmsOwner, hasProductionCmsOwner } from '../qa/production-cms-source-proof.mjs';
import { isWebsiteV5ReviewedSuccessor } from '../qa/website-v5-phase-a-proof.mjs';
import { websiteV5CopyPredecessor, websiteV5PredecessorDigest } from '../qa/website-v5-phase-a-proof.mjs';
import './article-overview-rendering.test.mjs';
import { articleOverviewSourceProjection, reviewedThaiWrapProjection, reviewedArticleCardProjection } from '../qa/phase2-source-proof.mjs';
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
  "package-lock.json": "a8d4db9862264112f0fb8787c103ca488ce516851c024a91d7a412b5d1894cea",
  "package.json": "f57a1eddfc98f84296dcb5edb55adefef646d33c4ac7304f1f115d78b1442b6e",
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
const investmentAvailabilityPath = 'lib/runtime/investment-availability.ts';
const reviewedInvestmentAvailabilityDigest = '34938dba75d9bdeb14f2bb33dabee8b9559633b95605b2e8a559e43cac438682';
// Owner-approved v5 Investment Allocation port (2026-10-24): exactly these entries may
// reach the feature, and each one is gated by the server availability flag.
const gatedInvestmentEntries = [
  'apps/web/app/api/investment-allocation/amcs/route.ts',
  'apps/web/app/api/investment-allocation/catalog/route.ts',
  'apps/web/app/api/investment-allocation/detail/route.ts',
  'apps/web/app/api/investment-allocation/funds/route.ts',
  'apps/web/app/tools/aia-fund-allocation/page.tsx',
  'apps/web/app/tools/investment-allocation/page.tsx',
];
// บลจ. เอไอเอ fund tool (owner request 2026-10-26): same feature, same server flag, own page owner.
const gatedInvestmentPageOwners = {
  'apps/web/app/tools/investment-allocation/page.tsx': 'features/investment-allocation/page.tsx',
  'apps/web/app/tools/aia-fund-allocation/page.tsx': 'features/investment-allocation/aia-page.tsx',
};

test('all actual Root/Web entry imports exclude UAT content and separated Investment features', () => {
  const entries = files('apps/web/app').filter(file => /(?:page|route|layout|not-found|robots)\.[jt]sx?$/.test(file));
  const investmentEntries = entries.filter(file => file.includes('investment-allocation') || file.includes('aia-fund-allocation'));
  assert.deepEqual([...investmentEntries].sort(), gatedInvestmentEntries, 'only the reviewed gated Investment entries exist');
  const publicRoots = ['app/layout.tsx','app/page.tsx','app/blog/page.tsx','app/blog/[category]/page.tsx','app/blog/[category]/[slug]/page.tsx','app/ci-planning/page.tsx','app/tools/financial-health-check/page.tsx','app/play/money-story/page.tsx','app/cookie-policy/page.tsx','app/privacy/page.tsx','app/not-found.tsx','app/sitemap.xml/route.ts','app/sitemaps/core.xml/route.ts','app/sitemaps/blog.xml/route.ts','app/sitemaps/tools.xml/route.ts'];
  assert(entries.length > 10);
  for (const file of closure([...entries.filter(file => !investmentEntries.includes(file)), ...publicRoots])) assert.doesNotMatch(file, forbidden, file);
  for (const file of closure(investmentEntries)) assert.doesNotMatch(file, /(?:uat-tax-table-fixture|uat-public-article-snapshots|uat-public-snapshot)/, file);
  for (const file of gatedInvestmentEntries) {
    const owner = gatedInvestmentPageOwners[file] ?? file;
    assert.match(read(owner), /if \(!INVESTMENT_ALLOCATION_ENABLED\) (?:notFound\(\);|\{)/, `${file} must close before rendering or SEC access`);
  }
  for (const directory of ['app/tools/investment-allocation','app/tools/aia-fund-allocation','app/api/investment-allocation']) assert.equal(existsSync(resolve(root, directory)), false, directory);
  for (const file of ['lib/content/uat-tax-table-fixture.ts','lib/content/uat-tax-table-fixture.json','lib/content/uat-public-article-snapshots.json']) assert.equal(existsSync(resolve(root, file)), false, file);
});

test('Investment release capability stays off in Production unless exactly 1 and cannot enter navigation/sitemap/meta', () => {
  const source = read(investmentAvailabilityPath);
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  // Minimal explicit-lane resolver; the real resolveContentEnvironment is exercised
  // with this module in tests/investment-availability.test.mjs.
  const lane = { resolveContentEnvironment: explicit => explicit?.trim() || 'development' };
  const load = () => {
    const loaded = { exports: {} };
    new Function('require','module','exports',compiled)(id => {
      if (id === 'server-only') return {};
      assert.equal(id, '../content/sanity-lane');
      return lane;
    },loaded,loaded.exports);
    return loaded.exports;
  };
  const before = { flag: process.env.CCPUN_INVESTMENT_ALLOCATION_ENABLED, env: process.env.CCPUN_APP_ENV };
  try {
    process.env.CCPUN_APP_ENV = 'production';
    for (const value of [undefined, '', 'true', 'yes', ' 1', '01']) {
      if (value === undefined) delete process.env.CCPUN_INVESTMENT_ALLOCATION_ENABLED; else process.env.CCPUN_INVESTMENT_ALLOCATION_ENABLED = value;
      assert.equal(load().INVESTMENT_ALLOCATION_ENABLED, false, `Production with flag ${JSON.stringify(value)}`);
    }
    process.env.CCPUN_INVESTMENT_ALLOCATION_ENABLED = '1';
    assert.equal(load().INVESTMENT_ALLOCATION_ENABLED, true, 'Production opens only on the exact owner flag');
    process.env.CCPUN_INVESTMENT_ALLOCATION_ENABLED = '0';
    process.env.CCPUN_APP_ENV = 'web-uat';
    assert.equal(load().INVESTMENT_ALLOCATION_ENABLED, false, 'kill switch closes Web UAT');
  } finally {
    for (const [name, value] of [['CCPUN_INVESTMENT_ALLOCATION_ENABLED', before.flag], ['CCPUN_APP_ENV', before.env]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
  for (const file of ['components/layout/website-43/Website43Navbar.tsx','components/layout/website-43/Website43Shared.tsx','features/home/website-43/Website43Home.tsx','features/home/website-43/Website43HomeStatic.tsx','lib/nav-config.json','public/nav-config.json', ...files('apps/web/app/sitemaps')]) assert.doesNotMatch(read(file), /investment-allocation|aia-fund-allocation|INVESTMENT_TOOL_LINK|V5_AIA_FUND_TOOL/, file);
});

function packageBeforePostPublishScripts(source) {
  const manifest = JSON.parse(source);
  const sameWordTest=' && node --test tests/production-cms-sameword.test.mjs';
  assert.equal(manifest.scripts['test:foundation-contracts'].split(sameWordTest).length,2,'same-word frozen render and metadata checks must run exactly once');
  manifest.scripts['test:foundation-contracts']=manifest.scripts['test:foundation-contracts'].replace(sameWordTest,'');
  // Owner-approved Investment Allocation port (2026-10-24): its offline regression suite runs exactly once.
  const investmentTests=' && node --import tsx --test tests/investment-allocation-regression.test.ts tests/investment-fund-catalog.test.ts tests/investment-rate-limit.test.ts tests/investment-allocation-units.test.ts tests/investment-allocation-api.test.ts tests/investment-allocation-live-script.test.ts';
  assert.equal(manifest.scripts['test:foundation-contracts'].split(investmentTests).length,2,'the Investment offline suite must run exactly once');
  manifest.scripts['test:foundation-contracts']=manifest.scripts['test:foundation-contracts'].replace(investmentTests,'');
  const addedStaticChecks = " && npm run test:calculators && npm run test:sitemap-google && npm run test:home-lcp && npm run test:seo-topic-hubs";
  assert.ok(manifest.scripts["check:foundation"].endsWith(addedStaticChecks), "all existing static CI gates must also run locally");
  manifest.scripts["check:foundation"] = manifest.scripts["check:foundation"].slice(0, -addedStaticChecks.length);
  for (const [name, command] of Object.entries({
  "test:calculators": "node --import tsx tests/calculator-regression.ts && node --import tsx --test tests/ci-numeric-safety.test.ts && node --test tests/calculator-design-language.test.mjs && node --test tests/calculator-ux-formula-parity.test.mjs && node --import tsx --test tests/calculator-ux-journey.test.mjs && node --import tsx --test tests/ci-recovery-ui-regression.test.mjs && node --import tsx --test tests/ci-numeric-ui-regression.test.mjs && node --import tsx tests/result-actions-regression.ts && node tests/fhc-seo-geo-regression.mjs",
  "test:sitemap-google": "node --conditions=react-server --import tsx --test tests/sitemap-google-regression.test.ts",
  "test:home-lcp": "node tests/home-lcp-regression.mjs",
  "test:seo-topic-hubs": "node tests/seo-topic-hubs-regression.mjs"
})) {
    assert.equal(manifest.scripts[name], command, "only exact existing canonical CI commands are admitted");
    delete manifest.scripts[name];
  }
  // Admit only these reviewed compatible security patches; retain the complete
  // original manifest digest for every other field and existing command.
  for (const owner of [manifest.overrides, manifest.overrides['@workflow/world-local'], manifest.overrides['@workflow/world-vercel']]) {
    assert.equal(owner.undici, '7.30.1');
    owner.undici = '7.29.1';
  }
  assert.equal(manifest.overrides.dompurify, '3.4.17');
  manifest.overrides.dompurify = '3.4.16';
  // Reviewed 2026-10-24 security patch: zod >= 4.6.6 (GHSA-mrhx-c7xc-m3w5) and body-parser 2.4.0 (GHSA-27r3-jxmh-p828).
  assert.equal(manifest.overrides.zod, '^4.6.6', 'only the exact reviewed zod security override is admitted');
  delete manifest.overrides.zod;
  assert.equal(manifest.overrides['body-parser'], '2.4.0', 'only the exact reviewed body-parser security override is admitted');
  delete manifest.overrides['body-parser'];
  assert.deepEqual(manifest.overrides['@module-federation/dts-plugin'], { 'adm-zip': '0.6.1' }, 'only the exact reviewed adm-zip security override is admitted');
  delete manifest.overrides['@module-federation/dts-plugin'];
  assert.equal(manifest.dependencies.zod, '^4.6.6', 'only the reviewed zod floor is admitted');
  manifest.dependencies.zod = '^4.3.6';
  assert.equal(manifest.overrides.vite, '8.3.3', 'only the exact reviewed Vite security override is admitted');
  delete manifest.overrides.vite;
  assert.equal(manifest.dependencies['@cloudflare/ai-search-snippet'], '^0.0.43', 'only the reviewed disabled SDK is admitted');
  delete manifest.dependencies['@cloudflare/ai-search-snippet'];
  const architecture = 'node --test tests/monorepo-lane-ownership.test.mjs';
  const withAi = architecture + ' tests/ai-search-integration.test.mjs';
  assert.equal(manifest.scripts['test:architecture'].split(withAi).length, 2, 'one reviewed AI SSR and import-graph check');
  manifest.scripts['test:architecture'] = manifest.scripts['test:architecture'].replace(withAi, architecture);
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

const zodFunding = { url: 'https://github.com/sponsors/colinhacks' };
const zodRecord = (version, integrity) => ({ version, resolved: `https://registry.npmjs.org/zod/-/zod-${version}.tgz`, integrity, license: 'MIT', funding: zodFunding });
const bodyParserRecord = (version, integrity, contentType, iconv, qs) => ({ version, resolved: `https://registry.npmjs.org/body-parser/-/body-parser-${version}.tgz`, integrity, license: 'MIT',
  dependencies: { bytes: '^3.1.2', 'content-type': contentType, debug: '^4.4.3', 'http-errors': '^2.0.1', 'iconv-lite': iconv, 'on-finished': '^2.4.1', qs, 'raw-body': '^3.0.2', 'type-is': '^2.1.0' },
  engines: { node: '>=18' }, funding: { type: 'opencollective', url: 'https://opencollective.com/express' } });
const qsRecord = (version, integrity) => ({ version, resolved: `https://registry.npmjs.org/qs/-/qs-${version}.tgz`, integrity, license: 'BSD-3-Clause',
  dependencies: { 'es-define-property': '^1.0.1', 'side-channel': '^1.1.1' }, engines: { node: '>=0.6' }, funding: { url: 'https://github.com/sponsors/ljharb' } });
const zod4111 = zodRecord('4.1.11', 'sha512-WPsqwxITS2tzx1bzhIKsEs19ABD5vmCVa4xBo2tq/SrV4RNZtfws1EnCWQXM6yh8bD08a1idvkB5MZSBiZsjwg==');
const zod436 = zodRecord('4.3.6', 'sha512-rftlrkhHZOcjDwkGlnUtZZkvaPHCsDATp4pGpuOOMDaTdDDXF91wuVDJoWoPsKX/3YPQ5fHuF3STjcYyKr+Qhg==');
const zodNestedBefore = {
  'node_modules/@vercel/cli-auth/node_modules/zod': zod4111, 'node_modules/@vercel/cli-config/node_modules/zod': zod4111,
  'node_modules/@workflow/cli/node_modules/zod': zod436, 'node_modules/@workflow/core/node_modules/zod': zod436,
  'node_modules/@workflow/world-local/node_modules/zod': zod436, 'node_modules/@workflow/world-postgres/node_modules/zod': zod436,
  'node_modules/@workflow/world-vercel/node_modules/zod': zod436, 'node_modules/@workflow/world/node_modules/zod': zod436,
};
/** Reverse only the reviewed 2026-10-24 zod/body-parser security patch (and the qs record npm regenerated with it). */
function lockBeforeZodBodyParserPatch(lock) {
  for (const owner of ['', 'apps/web']) {
    assert.equal(lock.packages[owner].dependencies.zod, '^4.6.6');
    lock.packages[owner].dependencies.zod = '^4.3.6';
  }
  assert.deepEqual(lock.packages['node_modules/zod'], zodRecord('4.6.7', 'sha512-g8W2D2kU6a8untc053fX1uVBKzM7yqAxW/3zwk83+6RyF2+SKOuV+c0wBDhUwzV1PaGapmZH+rmcUzPf+3CGwg=='));
  lock.packages['node_modules/zod'] = zodRecord('4.6.2', 'sha512-lh5RCAGFa1Cm2hjtNwLQhSs/AsqdWnTQaBER9fEwN/88pSh7KOtJavtBx/0VlkN/uFd61SwYmljLMDAsHlvzBQ==');
  assert.deepEqual(lock.packages['node_modules/body-parser'], bodyParserRecord('2.4.0', 'sha512-Ifk1KcLrxaGt1occQagQNFNNOqRt1LFuehEnHHzB8Z6cRgIxRU1TBaiIsUiCdA+gy5PL7Y1IX31DNKkRmxtXjQ==', '^2.1.0', '^0.7.3', '^6.16.1'));
  lock.packages['node_modules/body-parser'] = bodyParserRecord('2.3.0', 'sha512-2cGmJupaNgg+QUwVLAucDuWuoMZ6EX9iHDRswZ5lsNYEmwPaRknMPCLZz07yTzVq/83p4o/wzbDZbBrTvGGTIw==', '^2.0.0', '^0.7.2', '^6.15.2');
  assert.deepEqual(lock.packages['node_modules/qs'], qsRecord('6.16.1', 'sha512-5Px6J7rfHBAGUhNQ3es4YzcOdBBw0SDcVtThJml4RdnKw4tKs2epA0kPZ+K8X+WiHktT93RHVcQ/3ym5aTCgtg=='));
  lock.packages['node_modules/qs'] = qsRecord('6.16.0', 'sha512-h6fhOIaRrID2CbEY2fqs+7t+UXZo+MLAnU5gRIq85uFtdiUPCdsApMlHhXogKVM4HM2DVbIjGNTTYH2OcmP1vA==');
  // adm-zip stays deduplicated onto the patched root 0.6.1 (GHSA-7q85-xj36-vmfc and related) via the dts-plugin override.
  assert.equal(Object.hasOwn(lock.packages, 'node_modules/@module-federation/dts-plugin/node_modules/adm-zip'), false, 'no vulnerable nested adm-zip');
  for (const [path, record] of Object.entries(zodNestedBefore)) {
    assert.equal(Object.hasOwn(lock.packages, path), false, path + ' is deduplicated onto the patched zod');
    lock.packages[path] = record;
  }
  lock.packages = Object.fromEntries(Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b, 'en')));
}

function lockBeforeAiSdk(source) {
  const lock = JSON.parse(source);
  lockBeforeZodBodyParserPatch(lock);
  // Exact registry records generated by npm. All unrelated lock entries stay
  // covered by the unchanged historical whole-lock hash below.
  assert.deepEqual(lock.packages["node_modules/undici"], {
  "version": "7.30.1",
  "resolved": "https://registry.npmjs.org/undici/-/undici-7.30.1.tgz",
  "integrity": "sha512-03KrMbjIFDWQR5RNPrSw3bd1r12JpyFQl9/yxjUbJtqkjmllqC5lFjZh6ujeuJCKr8EOQvRW872Oy/az+nLYxg==",
  "license": "MIT",
  "engines": {
    "node": ">=20.18.1"
  }
});
  lock.packages["node_modules/undici"] = {
  "version": "7.29.1",
  "resolved": "https://registry.npmjs.org/undici/-/undici-7.29.1.tgz",
  "integrity": "sha512-RYONW2MeafgYlkVOKYKkA/Ag7BmXqgIWCa8t1m0JcxrQg9pI9lEqRhAOruOBCbAohOa/gkCF+iPi9hrgvTzu6Q==",
  "license": "MIT",
  "engines": {
    "node": ">=20.18.1"
  }
};
  assert.deepEqual(lock.packages["node_modules/dompurify"], {
  "version": "3.4.17",
  "resolved": "https://registry.npmjs.org/dompurify/-/dompurify-3.4.17.tgz",
  "integrity": "sha512-B/pSlYVHQ58kqISD/yDjuJ1yfzI34m1gF4lAod2bwSRhiN4K5Cl3H8Af7hqB2PmTL911tdEudnnXn5FnhRoz0w==",
  "license": "(MPL-2.0 OR Apache-2.0)",
  "optionalDependencies": {
    "@types/trusted-types": "^2.0.7"
  }
});
  lock.packages["node_modules/dompurify"] = {
  "version": "3.4.16",
  "resolved": "https://registry.npmjs.org/dompurify/-/dompurify-3.4.16.tgz",
  "integrity": "sha512-sqo+pNp3qRhCIpbgRi1y8Tgk27Bo2Ry7w0dC1NBeNTdZChWjz9Xb/KOoZbRP/R6pQZ80Qw8YhXw13hWWBbMRnQ==",
  "license": "(MPL-2.0 OR Apache-2.0)",
  "optionalDependencies": {
    "@types/trusted-types": "^2.0.7"
  }
};
  const vite = lock.packages['node_modules/vite'];
  assert.equal(vite.version, '8.3.3');
  assert.equal(vite.resolved, 'https://registry.npmjs.org/vite/-/vite-8.3.3.tgz');
  assert.equal(vite.integrity, 'sha512-cTAldKPImjg6c+gk48U19POPn3GCBzZwpdsN8ZMEEcbpes+6/wvfqUd0C2y3qYY4wsj8PwgFwrZ/1jBPVttMSg==');
  assert.equal(vite.dependencies.rolldown, '~1.2.11');
  // Reconstruct only the four reviewed security-patch fields. The original whole
  // lock hash below still protects every other dependency and metadata byte.
  vite.version = '8.3.1';
  vite.resolved = 'https://registry.npmjs.org/vite/-/vite-8.3.1.tgz';
  vite.integrity = 'sha512-/bvH9E9tmCXRGp2uXY3WbOldqpTwFkbha/8ANaEQ6VkxhH60KyqLwgZq6lG2y+4uT55x9+9eUHMpQ7uGnOCKjA==';
  vite.dependencies.rolldown = '~1.2.9';
  for (const owner of ['', 'apps/web']) {
    assert.equal(lock.packages[owner].dependencies['@cloudflare/ai-search-snippet'], '^0.0.43');
    delete lock.packages[owner].dependencies['@cloudflare/ai-search-snippet'];
  }
  assert.deepEqual(lock.packages['node_modules/@cloudflare/ai-search-snippet'], {
    version: '0.0.43', resolved: 'https://registry.npmjs.org/@cloudflare/ai-search-snippet/-/ai-search-snippet-0.0.43.tgz',
    integrity: 'sha512-NWT/0wULeX1YLQRDFm6rs8NAJz4YDYWbED628F0GpXF1w5PT09glR4CilIdGiovL9jflGneCD7/uLTrxWMkerQ==',
    license: 'MIT', engines: { node: '>=16.0.0' },
  });
  delete lock.packages['node_modules/@cloudflare/ai-search-snippet'];
  return JSON.stringify(lock, null, 2) + '\n';
}

test('Production providers, metadata, models, engines, tracking, consent storage and delivery contract stay protected', () => {
  // Retain the deployed 7951 tracking baseline while admitting only the reviewed
  // UAT cookie-isolation fix, covered by analytics-component-regression.mjs.
  const analyticsPath = 'features/analytics/components/GoogleAnalytics.tsx';
  assert.equal(protectedProduction[analyticsPath], '6caff27b5dec7cf21bb6b6c29149c031e47f12828090e7bdd0c26a7f5192f64f');
  const semanticPath = 'lib/analytics.ts';
  assert.equal(protectedProduction[semanticPath], '43b1abf55778f2dc562e79dd632573006aafbc401ff3423223d9395722681211');
  // Reviewed shared Node security policy and generated serving guard; all other bytes remain pinned.
  const webDriverPath = 'apps/web/scripts/build-provider.mjs';
  assert.equal(protectedProduction[webDriverPath], '90a606fc6d04947385989fac4f6ce2f43f10d214c4fabc72dcc465e378de84bd');
  // Reviewed 2026-10-24 GA4 outage fix: the Production analytics lane inlines its
  // public GA4 ID and semantic-layer flag; covered by web-foundation-config-parity.
  const webConfigPath = 'apps/web/next.config.ts';
  assert.equal(protectedProduction[webConfigPath], '2c21e02a2bd71080f5c5a339338f9ad520b99d629598ad0fe105a7c3f8a16cf4');
  for (const [file,digest] of Object.entries(protectedProduction)) {
    const reviewedDigest = file === analyticsPath
      ? '6379bb9a48584a748980f1163458150776410ce32d71c782bfd3529fdb295b6a'
      : file === semanticPath ? '4176646b29ae2614cc044fef35d9be7cdffe8cfb303c8519f86fe71c148cd90f'
      : file === webDriverPath ? '629f77a0037613a9acb7cdf5e28cd141c6bdb2c921a7ecee79dceca0d07092a4'
      : file === webConfigPath ? 'd4cf8aa0725fdf58263e3f68776db192fa39bfa1e7578b8cb7f715a7e5face9f' : digest;
    if(hasProductionCmsOwner(file)) { assertProductionCmsOwner(file,read(file)); continue; }
    const source = file === 'package.json' ? packageBeforePostPublishScripts(websiteV5CopyPredecessor(file, read(file))) : file === 'package-lock.json' ? lockBeforeAiSdk(read(file)) : read(file);
    // Website v5 Phase A: an exact reviewed v5 route successor maps to its frozen predecessor digest.
    assert.equal(file === 'package.json' ? sha(source) : websiteV5PredecessorDigest(file, source), reviewedDigest, file);
  }
});

test('Production script and AI SDK admissions reject unknown scripts, changed commands and dependency drift', () => {
  const manifest = JSON.parse(read('package.json'));
  const altered = value => sha(packageBeforePostPublishScripts(JSON.stringify(value)));
  assert.notEqual(altered({ ...manifest, scripts: { ...manifest.scripts, unreviewed: 'new-command' } }), protectedProduction['package.json']);
  assert.notEqual(altered({ ...manifest, dependencies: { ...manifest.dependencies, unreviewed: '1.0.0' } }), protectedProduction['package.json']);
  assert.throws(() => altered({ ...manifest, scripts: { ...manifest.scripts, 'nav:check': 'unreviewed' } }));
  for (const name of ['test:calculators', 'test:sitemap-google', 'test:home-lcp', 'test:seo-topic-hubs']) {
    assert.throws(() => altered({ ...manifest, scripts: { ...manifest.scripts, [name]: 'unreviewed' } }));
  }
  assert.throws(() => altered({ ...manifest, scripts: { ...manifest.scripts, 'check:foundation': manifest.scripts['check:foundation'].replace(' && npm run test:sitemap-google', '') } }));
  assert.notEqual(altered({ ...manifest, scripts: { ...manifest.scripts, 'build:admin:uat:acceptance': 'node scripts/build-root.mjs --native-scheduler-uat-acceptance' } }), protectedProduction['package.json'], 'no native acceptance alias is admitted in Production');
  assert.throws(() => altered({ ...manifest, dependencies: { ...manifest.dependencies, '@cloudflare/ai-search-snippet': '^0.0.44' } }));
  assert.throws(() => altered({ ...manifest, scripts: { ...manifest.scripts, 'test:architecture': manifest.scripts['test:architecture'] + ' node --test tests/monorepo-lane-ownership.test.mjs tests/ai-search-integration.test.mjs' } }));
  const lock = JSON.parse(read('package-lock.json'));
  lock.packages['node_modules/clsx'].version = '0.0.0';
  assert.notEqual(sha(lockBeforeAiSdk(JSON.stringify(lock))), protectedProduction['package-lock.json']);
  lock.packages['node_modules/@cloudflare/ai-search-snippet'].integrity = 'unreviewed';
  assert.throws(() => lockBeforeAiSdk(JSON.stringify(lock)));
});

test('Vite security admission rejects changed overrides, artifact metadata and unrelated dependencies', () => {
  const manifest = JSON.parse(read('package.json'));
  for (const version of [undefined, '^8.3.3', '8.3.1', '8.3.4']) {
    const changed = structuredClone(manifest); changed.overrides.vite = version;
    assert.throws(() => packageBeforePostPublishScripts(JSON.stringify(changed)));
  }
  const extraOverride = structuredClone(manifest); extraOverride.overrides.unreviewed = '1.0.0';
  assert.notEqual(sha(packageBeforePostPublishScripts(JSON.stringify(extraOverride))), protectedProduction['package.json']);
  const original = JSON.parse(read('package-lock.json'));
  for (const [field, value] of [['version', '8.3.4'], ['resolved', 'https://unreviewed.example/vite.tgz'], ['integrity', 'unreviewed']]) {
    const changed = structuredClone(original); changed.packages['node_modules/vite'][field] = value;
    assert.throws(() => lockBeforeAiSdk(JSON.stringify(changed)));
  }
  const range = structuredClone(original); range.packages['node_modules/vite'].dependencies.rolldown = '~1.2.12';
  assert.throws(() => lockBeforeAiSdk(JSON.stringify(range)));
  for (const mutate of [
    lock => { lock.packages['node_modules/vite'].dependencies.postcss = '^9.0.0'; },
    lock => { lock.packages['node_modules/vite'].unreviewed = true; },
    lock => { lock.packages['node_modules/rolldown'].version = '0.0.0'; },
    lock => { delete lock.packages['node_modules/@emnapi/core']; },
  ]) {
    const changed = structuredClone(original); mutate(changed);
    assert.notEqual(sha(lockBeforeAiSdk(JSON.stringify(changed))), protectedProduction['package-lock.json']);
  }
});

function loadArchive(articles, registry) {
  const Page = props => React.createElement('archive-proof', props);
  const mocks = {
    '@/lib/content/public-copy': { getPublicCopy: async () => ({}) },
    '@/lib/content/public-copy-registry': { publicCopyText: () => key => key },
    '@/components/ui/PublicCopyProvider': { PublicCopyProvider: ({children}) => children },
    'next/headers': { draftMode: async () => ({ isEnabled: false }) },
    // Website v5 Phase A: /blog/ renders V5BlogIndex; published reads share the v5 request cache.
    '@/features/blog/v5/V5BlogIndex': { __esModule: true, default: Page },
    '@/lib/content/topic-navigation': { listLinkableTopics: entries => entries.entries.filter(x => x.status === 'active').map(({ slug, title }) => ({ slug, title })), listFallbackTopics: () => [] },
    '@/lib/content/sanity': { getPrimaryAuthorProfile: async () => null },
    '@/components/layout/v5/shell-data': { getPublishedArticles: async () => articles.filter(x => x.status === 'published'), getPublishedCategoryRegistry: async () => ({ available: true, ...registry }) },
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
  assert.deepEqual(page.props.topics, [{ slug:'personal-finance',title:'Original physical category' }]);
  // v5 pages per group on the same URL: ?page= is never forwarded as a listing owner.
  assert.equal(Object.hasOwn(page.props, 'initialPage'), false);
  const empty = loadArchive([], { entries:[] });
  const emptyTree = await empty.module.default({ searchParams: Promise.resolve({}) });
  const emptyPage = React.Children.toArray(emptyTree.props.children).find(x => x.type === empty.Page);
  assert.deepEqual(emptyPage.props.articles,[]); assert.deepEqual(emptyPage.props.topics,[]);
});

// Reviewed Article/H4/Author candidate updates retain original baseline hashes in the parity manifests.
test('all39 approved source records retain provenance with exact reviewed Article and image URL ownership', () => {
  assert.equal(Object.keys(reviewedSourceOwners).length,39);
  const retired = 'features/blog/website-43/BlogReturnLink.tsx';
  assert.equal(reviewedSourceOwners[retired], '77a3ef1c5f7eb02e91e425e400d4c289d5e329aa400c33ac0f7484eeb991a556');
  assert.equal(existsSync(resolve(root, retired)), false, 'Retired link has no route/import owner and must remain absent');
  for (const [file,digest] of Object.entries(reviewedSourceOwners)) {
    if (file === retired) continue;
    if (file === investmentAvailabilityPath) {
      // Owner-approved release contract (2026-10-24): the original always-false pin
      // stays recorded; only the exact reviewed flag module is admitted.
      assert.equal(digest, 'd7dadd956963e82c6efe4dd966a8710c44aed30d325e5f7f246261ffa3bfc3fa');
      assert.equal(sha(read(file)), reviewedInvestmentAvailabilityDigest, file);
      continue;
    }
    if(hasProductionCmsOwner(file)) { assertProductionCmsOwner(file,read(file)); continue; }
    // Website v5 Phase B: the countdown stylesheet is an exact reviewed v5 successor (flat v5 frame, no
    // decorative artwork layer); its frozen predecessor digest stays recorded in qa/website-v5-phase-a-proof.mjs.
    if (isWebsiteV5ReviewedSuccessor(file, read(file))) continue;
    const source = reviewedThaiWrapProjection(file, reviewedArticleCardProjection(file, read(file)));
    if (file === 'apps/web/static-images.d.ts') {
      assert.equal(digest, 'fe57bd015bfec7883efee95cfa98ec8ffd4806c505c4a9ad3ccacc6275ac5579');
      const comment = '// Static SVG and WebP imports must typecheck before Next generates next-env.d.ts.';
      const addition = '\ndeclare module "*.webp" {\n  const image: import("next/image").StaticImageData;\n  export default image;\n}\n';
      const check = (candidate) => {
        assert.equal(candidate.split(comment).length, 2, 'exact image declaration comment');
        assert.equal(candidate.split(addition).length, 2, 'exactly one typed WebP declaration');
        const prior = candidate.replace(comment, comment.replace('SVG and WebP', 'SVG')).replace(addition, '');
        assert.equal(sha(prior), digest, 'all original declarations remain frozen');
      };
      check(source);
      for (const mutant of [source.replace('*.webp', '*.png'), source.replace('StaticImageData', 'any'), source + addition, source + '\n// unrelated\n', source.replace(addition, '')]) assert.throws(() => check(mutant));
    } else if (file === 'components/ui/health-happy/HealthHappyCountdown.module.css') {
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
      assert.equal(sha(articleOverviewSourceProjection(source)), 'c808e31c1e6e43e6c8ca7bb2b41efe7c82c36c696c1b0a1ee0eb6363dfaea3ae', 'reviewed Article V4 plus exact published overview only');
    } else assert.equal(sha(source),digest,file);
  }
});


test('reviewed Undici and DOMPurify patches reject altered registry records and override values', () => {
  for (const name of ['undici', 'dompurify']) {
    for (const field of ['version', 'resolved', 'integrity', 'license']) {
      const changed = JSON.parse(read('package-lock.json'));
      changed.packages['node_modules/' + name][field] += '-unreviewed';
      assert.throws(() => lockBeforeAiSdk(JSON.stringify(changed)), name + ':' + field);
    }
    const changed = JSON.parse(read('package.json'));
    changed.overrides[name] += '-unreviewed';
    assert.throws(() => packageBeforePostPublishScripts(JSON.stringify(changed)), name);
  }
});
