import { assertProductionCmsOwner, hasProductionCmsOwner } from '../qa/production-cms-source-proof.mjs';
import { websiteV5PredecessorDigest } from '../qa/website-v5-phase-a-proof.mjs';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import { renderToStaticMarkup } from 'react-dom/server';

const root = resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const inventory = JSON.parse(read('qa/root-runtime-owner-migration.json'));

test('seven duplicate public routes retain frozen canonical bodies, export identities and literal Next configuration', () => {
  const productionProof = JSON.parse(read('qa/production-code-only-parity.json'));
  const routes = ['privacy/page.tsx', 'not-found.tsx', 'sitemap.xml/route.ts', 'sitemaps/core.xml/route.ts', 'sitemaps/tools.xml/route.ts', 'sitemaps/blog.xml/route.ts', 'cookie-policy/page.tsx'];
  const verify = (route, source = read('app/' + route), canonicalSource = read('apps/web/app/' + route)) => {
    const file = 'app/' + route, canonical = 'apps/web/' + file;
    const reviewed = productionProof.reviewedUxOwners[canonical];
    if (reviewed) assert.equal(reviewed.baselineSha256, productionProof.protected[canonical], 'original canonical source retained');
    const cmsSource = hasProductionCmsOwner(canonical);
    if(cmsSource) assertProductionCmsOwner(canonical,canonicalSource);
    if (canonical === 'apps/web/app/not-found.tsx' && !cmsSource) {
      assert.equal(productionProof.protected[canonical], '73fb0bf30b6e8302c1526d9f9ce979147377938026c03f4de2a60d9bb1f31fe8');
      for (const insertion of [
        " style={{ flexDirection: 'row', flexWrap: 'wrap', width: 'min(292px, 100%)', gap: '12px', justifyContent: 'center', marginInline: 'auto' }}",
        " style={{ flex: '1 1 124px', width: 'auto', minWidth: 0, minHeight: 48, height: 'auto' }}",
        " style={{ flex: '1 1 124px', width: 'auto', minWidth: 0, minHeight: 48, height: 'auto', justifyContent: 'center' }}",
      ]) {
        assert.equal(canonicalSource.split(insertion).length, 2, 'each exact reviewed 404 action style occurs once');
        canonicalSource = canonicalSource.replace(insertion, '');
      }
    }
    // Owner-approved 2026-10-25 (T1): the /tools/ hub entry is an exact reviewed successor of the tools sitemap.
    if(!cmsSource) assert.equal(websiteV5PredecessorDigest(canonical, canonicalSource), reviewed?.candidateSha256 ?? productionProof.protected[canonical], canonical);
    const dynamic = read(canonical).match(/^export const dynamic = (.+);$/m)?.[1];
    const owner = '@/' + canonical.replace(/\.[^.]+$/, '');
    const metadataExport = canonical.endsWith('/privacy/page.tsx') || canonical.endsWith('/cookie-policy/page.tsx') ? 'generateMetadata' : 'metadata';
    assert.equal(source, (dynamic ? `export const dynamic = ${dynamic};\n` : '') + `export { ${dynamic ? 'GET' : 'default, '+metadataExport} } from "${owner}";\n`);
    const sentinel = { __esModule: true, default: () => null, metadata: { title: 'fixture' }, generateMetadata: async()=>({title:'fixture'}), GET: () => new Response('fixture') };
    const candidate = loadFixtureModule(file, { sources: new Map([[file, source]]), mocks: new Map([[owner, sentinel]]) });
    assert.deepEqual(Object.keys(candidate).sort(), dynamic ? ['GET', 'dynamic'] : ['default', metadataExport]);
    for (const name of dynamic ? ['GET'] : ['default', metadataExport]) assert.equal(candidate[name], sentinel[name]);
    if (dynamic) assert.equal(candidate.dynamic, JSON.parse(dynamic));
  };
  for (const route of routes) verify(route);
  assert.throws(() => verify(routes[0], read('app/' + routes[0]).replace('default, generateMetadata', 'default')));
  assert.throws(() => verify(routes[2], read('app/' + routes[2]).replace('force-static', 'force-dynamic')));
  assert.throws(() => verify(routes[1], read('app/' + routes[1]).replace('@/apps/web/', '@/apps/admin/')));
  // Website v5 Phase A: the Web 404 is the reviewed v5 source; any copy, href or byte change is rejected.
  assert.throws(() => verify(routes[1], undefined, read('apps/web/app/not-found.tsx').replace('site.extra.blogRecovery', 'site.extra.primaryButton')));
  assert.throws(() => verify(routes[1], undefined, read('apps/web/app/not-found.tsx').replace('href="/blog/"', 'href="/blog"')));
  assert.throws(() => verify(routes[1], undefined, read('apps/web/app/not-found.tsx') + ' '));
});

test('compiled root and Web 404 recovery retain centered bounded buttons, copy, href and metadata', async () => {
  const shared = { Website43Navbar: () => null, Website43Footer: () => null };
  const copyMock = {getPublicCopy: async scope => loadFixtureModule('lib/content/public-copy-registry.ts').parsePublicCopy(scope,null)};
  // Website v5 Phase A: the route renders the v5 404 inside the shared v5 frame (mocked here);
  // the Website 4.3 body is retained verbatim as the rollback component and keeps its exact contract.
  const mocks = new Map([
    ['@/components/layout/website-43/Website43Shared', shared], ['./Website43Shared', shared], ['@/lib/content/public-copy', copyMock],
    ['@/components/layout/v5/V5Page', { __esModule: true, default: ({ children }) => children }],
    ['@/components/layout/v5/shell-data', { getPublishedArticles: async () => [] }],
  ]);
  const legacy = loadFixtureModule('app/not-found.tsx', { mocks });
  const canonical = loadFixtureModule('apps/web/app/not-found.tsx', { mocks });
  assert.deepEqual(legacy.metadata, canonical.metadata);
  assert.equal(canonical.metadata.alternates.canonical, null);
  for (const page of [legacy, canonical]) {
    const html = renderToStaticMarkup(await page.default());
    const links = [...html.matchAll(/<a(?: class="[^"]*")? href="(\/|\/blog\/)">([^<]+)<\/a>/g)];
    assert.deepEqual(links.map(([, href, text]) => [href, text]), [['/', 'กลับหน้าแรก'], ['/blog/', 'ดูบทความ']]);
    assert.match(html, /<h1 id="not-found-title"[^>]*>ไม่พบหน้าที่คุณกำลังหา<\/h1>/);
  }
  const rollback = loadFixtureModule('components/layout/website-43/Website43NotFound.tsx', { mocks });
  const html = renderToStaticMarkup(await rollback.default());
  assert.match(html, /style="flex-direction:row;flex-wrap:wrap;width:min\(292px, 100%\);gap:12px;justify-content:center;margin-inline:auto"/);
  const links = [...html.matchAll(/<a style="([^"]+)" href="(\/|\/blog\/)">([^<]+)<\/a>/g)];
  assert.deepEqual(links.map(([, , href, text]) => [href, text]), [['/', 'กลับหน้าแรก'], ['/blog/', 'ดูบทความ']]);
  assert.equal(links[0][1], 'flex:1 1 124px;width:auto;min-width:0;min-height:48px;height:auto');
  assert.equal(links[1][1], links[0][1] + ';justify-content:center');
  assert.match(html, /<h1>ไม่พบหน้าที่คุณกำลังหา<\/h1>/);
});

test('root compatibility routes delegate implementations to their canonical app owners', () => {
  assert.equal(inventory.pairs.length, 49);
  for (const { legacy, canonical, wrapper, status } of inventory.pairs) {
    assert.equal(status, 'migrated', legacy);
    const expectedWrapper = hasProductionCmsOwner(legacy) ? (wrapper.includes('default, metadata') ? wrapper.replace('default, metadata','default, generateMetadata') : wrapper.replace('export { default }','export { default, generateMetadata }')) : wrapper;
    assert.equal(read(legacy), expectedWrapper, legacy);
    if(hasProductionCmsOwner(legacy)) assertProductionCmsOwner(legacy,read(legacy));
    assert.equal(existsSync(resolve(root, canonical)), true, canonical);
    const implementation = read(canonical);
    const namedReexports = [...implementation.matchAll(/export \{\s*([^}]+)\s*\}/g)].flatMap(match => match[1].split(',').map(name => name.trim()));
    const wrapperExports = [...expectedWrapper.matchAll(/export \{\s*([^}]+)\s*\}/g)].flatMap(match => match[1].split(',').map(name => name.trim()));
    for (const name of ['default', 'metadata', 'generateMetadata']) {
      const exported = name === 'default' ? /export default\b/.test(implementation) : name === 'metadata' ? /export const metadata\b/.test(implementation) : /export (?:async )?function generateMetadata\b/.test(implementation);
      if (exported || namedReexports.includes(name)) assert.ok(wrapperExports.includes(name), `${legacy}: missing ${name} export`);
    }
    assert.match(wrapper, new RegExp(`from "@/${canonical.replace(/\.[^.]+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), legacy);
    // Keep Next's statically analysed route configuration literal in the entry file.
    for (const match of read(canonical).matchAll(/export const (dynamic|dynamicParams|revalidate|fetchCache|runtime|preferredRegion|maxDuration|experimental_ppr)\s*=\s*([^;]+);/g)) {
      assert.ok(wrapper.includes(`export const ${match[1]} = ${match[2]};`), `${legacy}: ${match[1]}`);
    }
  }
});

test('global foundation has one owner with explicit root, Web and Admin entry bridges', () => {
  const owner = resolve(root, 'components/styles/global-foundation.css');
  const resolveImport = (file) => {
    const source = read(file);
    if (file === "apps/web/app/globals.css") assert.equal(source, "@import \"../../../components/styles/global-foundation.css\";\n/* Public Web never renders the private Admin UI. Keep its utility candidates\n   out of this app's CSS without changing the shared or Admin foundations. */\n@source not \"../../../features/admin\";\n", "only the exact Web-only Admin scanner exclusion is admitted");
    const match = source.match(file === "apps/web/app/globals.css" ? /^@import "([^"\n]+)";/ : /^@import "([^"\n]+)";\s*$/);
    assert.ok(match, file);
    return resolve(root, dirname(file), match[1]);
  };
  assert.equal(resolveImport('app/globals.css'), owner);
  assert.equal(resolveImport('apps/web/app/globals.css'), owner);
  assert.equal(resolveImport('apps/admin/app/globals.css'), resolve(root, 'app/globals.css'));
  const foundation = read('components/styles/global-foundation.css');
  for (const source of ['../../components', '../../features']) {
    assert.ok(foundation.includes(`@source "${source}";`));
    assert.equal(existsSync(resolve(dirname(owner), source)), true);
  }
  for (const stylesheet of ['./public-compat.css', './public-motion.css', '../../features/financial-health-check/styles/print.css']) {
    assert.ok(foundation.includes(`@import "${stylesheet}";`));
    assert.equal(existsSync(resolve(dirname(owner), stylesheet)), true);
  }
});
