import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { DEPLOYMENT_LANES } from '../lib/runtime/deployment-lanes.mjs';
import { main as audit } from '../scripts/audit-monorepo-boundaries.mjs';

test('generated CCPun build outputs stay excluded in root and nested apps while source remains checked', async () => {
  const paths = ['.ccpun-local/next-uat/build/package.json', 'apps/web/.ccpun-local/next-uat/build/package.json', 'apps/admin/.ccpun-local/next-uat/build/package.json'];
  assert.deepEqual(execFileSync('git', ['check-ignore', '--', ...paths], { encoding: 'utf8' }).trim().split('\n'), paths);
  const { ESLint } = await import('eslint');
  const eslint = new ESLint();
  for (const file of paths.map(path => path.replace('package.json', 'generated.js'))) assert.equal(await eslint.isPathIgnored(file), true, file);
  for (const file of ['apps/web/app/page.tsx', 'apps/admin/app/layout.tsx']) {
    assert.equal(await eslint.isPathIgnored(file), false, file);
    assert.equal(spawnSync('git', ['check-ignore', '--no-index', '--quiet', '--', file]).status, 1, file);
  }
});

const baselinedMirrors = JSON.parse(readFileSync(new URL('../qa/monorepo-compatibility-mirrors.json', import.meta.url), 'utf8'));

test('the four independently deployable Hostinger lanes retain their owners and data isolation', () => {
  assert.deepEqual(Object.keys(DEPLOYMENT_LANES).sort(), [
    'admin-production', 'admin-uat', 'web-production', 'web-uat',
  ]);
  const expected = {
    'web-production': ['ccpun.com', 'web', '@ccpun/web', 'kyfxgjnq', 'production', true, '1'],
    'web-uat': ['test.ccpun.com', 'web', '@ccpun/web', 'ccb9lnw5', 'uat', false, '0'],
    'admin-production': ['admin.ccpun.com', 'admin', '@ccpun/admin', 'kyfxgjnq', 'production', false, '0'],
    'admin-uat': ['admin-test.ccpun.com', 'admin', '@ccpun/admin', 'ccb9lnw5', 'uat', false, '0'],
  };
  for (const [name, [domain, role, workspace, project, dataset, indexable, analytics]] of Object.entries(expected)) {
    const lane = DEPLOYMENT_LANES[name];
    assert.equal(lane.domain,domain,name);
    assert.equal(lane.provider,'hostinger',name);
    assert.equal(lane.role,role,name);
    assert.equal(lane.workspace,workspace,name);
    assert.equal(lane.sanityProjectId,project,name);
    assert.equal(lane.sanityDataset,dataset,name);
    assert.equal(lane.indexable,indexable,name);
    assert.equal(lane.productionAnalytics,analytics,name);
    assert.equal(lane.nodeMajor,24,name);
  }
});

test('monorepo audit starts from the actual apps/web and apps/admin entrypoints', async () => {
  const report = await audit({log:false});
  assert.ok(report.roots.web.length >= 1, 'Web runtime roots missing');
  assert.ok(report.roots.admin.length >= 1, 'Admin runtime roots missing');
  assert.ok(report.roots.web.every((file) => file.startsWith('apps/web/')));
  assert.ok(report.roots.admin.every((file) => file.startsWith('apps/admin/') || file === 'auth.ts'));
  assert.ok(report.counts.legacyCompatibilityRoutes > 0);
  assert.deepEqual(report.crossWorkspaceImports, {webToAdmin:[],adminToWeb:[]});
  assert.deepEqual(report.unassignedRoutes, []);
});


test('Web legal and not-found routes have one canonical implementation with explicit metadata ownership', () => {
  const legal = [
    ['privacy/page.tsx', 'features/legal/pages/PrivacyPage', 'renderPrivacyPage'],
    ['cookie-policy/page.tsx', 'features/legal/pages/CookiePolicyPage', 'renderCookiePolicyPage'],
  ];
  for (const [route, owner, render] of legal) {
    assert.equal(readFileSync(new URL('../app/' + route, import.meta.url), 'utf8'), 'export { default, generateMetadata } from "@/apps/web/app/' + route.replace(/\.tsx$/, '') + '";\n');
    assert.equal(readFileSync(new URL('../apps/web/app/' + route, import.meta.url), 'utf8'), 'export { default, generateMetadata } from "@/' + owner + '";\n');
    const source = readFileSync(new URL('../' + owner + '.tsx', import.meta.url), 'utf8');
    assert.equal((source.match(new RegExp('export async function ' + render + '\\(', 'g')) ?? []).length, 1, 'One reusable rendering owner');
    assert.match(source, /const metadata: Metadata/);
    assert.doesNotMatch(source, /export const metadata:/, 'The route must not export both static and generated metadata');
  }
  const route = 'not-found.tsx';
  assert.equal(readFileSync(new URL('../app/' + route, import.meta.url), 'utf8'), 'export { default, generateMetadata } from "@/apps/web/app/not-found";\n');
  assert.equal(existsSync(new URL('../features/public-pages/NotFoundPage.tsx', import.meta.url)), false, 'No second not-found implementation owner');
  const source = readFileSync(new URL('../apps/web/app/' + route, import.meta.url), 'utf8');
  assert.match(source, /const metadata: Metadata/);
  assert.match(source, /export function generateMetadata[\s\S]*resolvePageSeoMetadata\("__not_found__", metadata, parent\)/);
  assert.doesNotMatch(source, /export const metadata:/);
  assert.match(source, /^export default async function NotFound\(/m);
  const seoOwners = [
    ['apps/web/app/page.tsx', '/'], ['apps/web/app/blog/page.tsx', '/blog/'],
    ['apps/web/app/ci-planning/page.tsx', '/ci-planning/'],
    ['apps/web/app/tools/financial-health-check/page.tsx', '/tools/financial-health-check/'],
    ['apps/web/app/play/money-story/page.tsx', '/play/money-story/'],
    ['features/legal/pages/PrivacyPage.tsx', '/privacy/'],
    ['features/legal/pages/CookiePolicyPage.tsx', '/cookie-policy/'],
  ];
  for (const [file, pathname] of seoOwners) {
    const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.equal((source.match(/export function generateMetadata\(/g) ?? []).length, 1, file);
    assert.ok(source.includes('resolvePageSeoMetadata(' + JSON.stringify(pathname) + ','), file);
  }
});

test('legacy root mirrors are compatibility debt, never justification to create more duplicate route files', async () => {
  const report = await audit({log:false});
  assert.deepEqual(baselinedMirrors.canonicalWorkspaces,['apps/web','apps/admin']);
  const approved = new Set(baselinedMirrors.existingPairs.map((pair) => pair.join('\0')));
  const newPairs = report.compatibilityMirrors.filter(({legacy,canonical}) => !approved.has([legacy,canonical].join('\0')));
  assert.deepEqual(newPairs,[], 'New duplicate root routes require replacing the clone with an owned feature or documented exception');
});

test('Web sitemap routes have exactly one implementation but keep both route entrypoints', () => {
  const routes = [
    ['sitemap.xml/route.ts', 'index', 'force-static'],
    ['sitemaps/core.xml/route.ts', 'core', 'force-static'],
    ['sitemaps/tools.xml/route.ts', 'tools', 'force-static'],
    ['sitemaps/blog.xml/route.ts', 'blog', 'force-dynamic'],
  ];
  for (const [route, moduleName, dynamic] of routes) {
    const configuration = 'export const dynamic = "' + dynamic + '";\n';
    const expected = configuration + 'export { GET } from "@/apps/web/app/' + route.replace(/\.ts$/, '') + '";\n';
    assert.equal(readFileSync(new URL('../app/' + route, import.meta.url), 'utf8'), expected, route);
    assert.equal(existsSync(new URL('../lib/sitemap/routes/' + moduleName + '.ts', import.meta.url)), false, 'No duplicate sitemap owner');
    const implementation = readFileSync(new URL('../apps/web/app/' + route, import.meta.url), 'utf8');
    assert.match(implementation, /export (async )?function GET\(/);
    assert.equal(implementation.split(configuration).length, 2, 'Canonical literal Next configuration occurs once');
  }
});

function sourceInventoryFixture(t) {
  const root = mkdtempSync(join(process.platform === 'darwin' ? '/private/tmp' : tmpdir(), 'ccpun-source-inventory-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, source) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), source);
  };
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git('init', '-q');
  const code = `const { main } = await import(${JSON.stringify(new URL('../scripts/audit-monorepo-boundaries.mjs', import.meta.url).href)}); console.log(JSON.stringify(await main({log:false})));`;
  const run = () => spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: root, encoding: 'utf8', env: { ...process.env, CCPUN_MONOREPO_AUDIT_OUTPUT: '' },
  });
  const scan = () => { const result = run(); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); };
  return { root, write, git, run, scan };
}

test('Git source inventory omits ignored untracked SDK mirrors but retains tracked ignored source', (t) => {
  const { write, git, scan } = sourceInventoryFixture(t);
  const legacy = 'app/.well-known/workflow/v1/flow/route.js';
  const canonical = 'apps/admin/' + legacy;
  write('.gitignore', '/app/.well-known/workflow/\n/apps/admin/app/.well-known/workflow/\n');
  write('apps/web/app/page.tsx', 'export default function Page() {}');
  write('apps/admin/app/layout.tsx', 'export default function Layout() {}');
  for (const file of [legacy, canonical]) write(file, 'export const generated = true;');
  const ignored = scan();
  assert.equal(ignored.sourceFiles, 2);
  assert.deepEqual(ignored.compatibilityMirrors, []);
  git('add', '-f', '--', legacy, canonical);
  const tracked = scan();
  assert.equal(tracked.sourceFiles, 4);
  assert.deepEqual(tracked.compatibilityMirrors, [{ legacy, canonical, lane: 'admin', identical: true }]);
});

test('Git source inventory retains nonignored untracked mirrors and private cross-workspace imports', (t) => {
  const { write, scan } = sourceInventoryFixture(t);
  const legacy = 'app/.well-known/workflow/v1/flow/route.js';
  const canonical = 'apps/admin/' + legacy;
  for (const file of [legacy, canonical]) write(file, 'export const privateRoute = true;');
  write('apps/web/app/page.tsx', `import '@/${canonical}';`);
  const report = scan();
  assert.equal(report.sourceFiles, 3);
  assert.deepEqual(report.compatibilityMirrors, [{ legacy, canonical, lane: 'admin', identical: true }]);
  assert.deepEqual(report.crossWorkspaceImports.webToAdmin, [canonical]);
});

test('Git source inventory fails closed when Git cannot provide the source list', (t) => {
  const { root, write, run } = sourceInventoryFixture(t);
  write('apps/web/app/page.tsx', 'export default function Page() {}');
  rmSync(join(root, '.git'), { recursive: true, force: true });
  const result = run();
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /not a git repository/);
});

test('WebP imports have their exact Next image type before generated Next declarations exist', async () => {
  const { default: ts } = await import('typescript');
  const parsed = ts.getParsedCommandLineOfConfigFile('tsconfig.json', { incremental: false }, ts.sys);
  const declaration = join(process.cwd(), 'apps/web/static-images.d.ts');
  const probe = join(process.cwd(), '__virtual_prebuild_webp_probe.ts');
  const source = 'import image from "@/public/assets/blog-migration/aia-health-happy-describe/featured-01-AIA-Health-Happy-article.lossless.webp"; const src: string = image.src; const width: number = image.width;';
  const declarations = readFileSync(declaration, 'utf8');
  const compile = (imageDeclarations, probeSource = source) => {
    const host = ts.createCompilerHost(parsed.options);
    const originalGetSourceFile = host.getSourceFile;
    host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => {
      if (file === declaration || file === probe) return ts.createSourceFile(file, file === declaration ? imageDeclarations : probeSource, languageVersion);
      return originalGetSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile);
    };
    const program = ts.createProgram([declaration, probe], parsed.options, host);
    assert.ok(!program.getSourceFiles().some(({fileName}) => /(?:next-env\.d\.ts|next\/image-types\/global\.d\.ts)$/.test(fileName)), 'fresh prebuild proof must not load generated Next or image-global declarations');
    return ts.getPreEmitDiagnostics(program);
  };
  const withoutWebp = declarations.replace(/declare module "\*\.webp" \{[\s\S]*?\n\}/, '');
  assert.notEqual(withoutWebp, declarations);
  assert.ok(compile(withoutWebp).some(({code}) => code === 2307), 'missing WebP declaration reproduces fresh CI failure');
  assert.deepEqual(compile(declarations).map(({code,messageText}) => ({code,messageText})), []);
  assert.ok(compile(declarations, source + ' const invalid: number = image.src;').some(({code}) => code === 2322), 'the declaration must preserve StaticImageData types rather than any');
});
