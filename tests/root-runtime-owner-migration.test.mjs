import { assertProductionCmsOwner, hasProductionCmsOwner } from '../qa/production-cms-source-proof.mjs';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { reviewedCoreSitemapBaseline, CORE_ROUTE } from '../qa/seo-core-sitemap-review.mjs';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { JSDOM } from 'jsdom';

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
    if(!cmsSource) assert.equal(canonical === CORE_ROUTE ? reviewedCoreSitemapBaseline(canonical, canonicalSource, productionProof.protected[canonical])
      : createHash('sha256').update(canonicalSource).digest('hex'), reviewed?.candidateSha256 ?? productionProof.protected[canonical], canonical);
    const dynamic = read(canonical).match(/^export const dynamic = (.+);$/m)?.[1];
    const owner = '@/' + canonical.replace(/\.[^.]+$/, '');
    const metadataExport = canonical.endsWith('/privacy/page.tsx') || canonical.endsWith('/cookie-policy/page.tsx') || canonical.endsWith('/not-found.tsx') ? 'generateMetadata' : 'metadata';
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
  assert.throws(() => verify(routes[1], undefined, read('apps/web/app/not-found.tsx').replace('className={shell.buttonRow}', 'className={shell.inner}')));
  assert.throws(() => verify(routes[1], undefined, read('apps/web/app/not-found.tsx').replace('site.extra.blogRecovery', 'site.extra.primaryButton')));
  assert.throws(() => verify(routes[1], undefined, read('apps/web/app/not-found.tsx').replace("justifyContent: 'center'", "justifyContent: 'left'")));
  assert.throws(() => verify(routes[1], undefined, read('apps/web/app/not-found.tsx').replace('<V5Page>', '<V5Page current="/unapproved/">')));
});

test('compiled root and Web native 404 preserve recovery, touch targets, editable metadata and no canonical owner', async () => {
  const css={__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
  const mocks=new Map([
    ['@/components/layout/v5/V5Page',{__esModule:true,default:({children})=>createElement('main',null,children)}],
    ['@/components/layout/v5/V5.module.css',css],['./V5.module.css',css],
    ['@/components/layout/v5/shell-data',{getPublishedArticles:async()=>[]}],
    ['@/lib/content/public-copy',{getPublicCopy:async scope=>loadFixtureModule('lib/content/public-copy-registry.ts').parsePublicCopy(scope,null)}],
    ['@/lib/seo/page-seo',{resolvePageSeoMetadata:async(path,defaults)=>{assert.equal(path,'__not_found__');return{...defaults,title:'Owner 404 title',description:'Owner 404 description'};}}],
  ]);
  const legacy=loadFixtureModule('app/not-found.tsx',{mocks});
  const canonical=loadFixtureModule('apps/web/app/not-found.tsx',{mocks});
  const expected=await canonical.generateMetadata({},Promise.resolve({}));
  assert.deepEqual(await legacy.generateMetadata({},Promise.resolve({})),expected);
  assert.equal(expected.title,'Owner 404 title');assert.equal(expected.description,'Owner 404 description');assert.equal(expected.alternates.canonical,null);
  for(const page of [legacy,canonical]){
    const tree=await page.default();const html=renderToStaticMarkup(tree);
    const doc=new JSDOM(html).window.document;
    const row=doc.querySelector('section[aria-labelledby="not-found-title"] .buttonRow');
    assert.equal(row.style.justifyContent,'center');
    assert.deepEqual([...row.querySelectorAll('a')].map(a=>[a.getAttribute('href'),a.textContent,a.className]),[['/','กลับหน้าแรก','button'],['/blog/','ดูบทความ','buttonOutline']]);
    assert.equal(doc.querySelector('h1').textContent,'ไม่พบหน้าที่คุณกำลังหา');
    assert.deepEqual([...doc.querySelectorAll('#not-found-tools+nav a, [aria-labelledby="not-found-tools"] nav a')].map(a=>a.getAttribute('href')),['/play/money-story/','/tools/financial-health-check/','/ci-planning/']);
  }
  const cssSource=read('components/layout/v5/V5.module.css');
  assert.match(cssSource,/\.buttonRow \{ display: flex; flex-wrap: wrap; gap: 12px/);
  assert.match(cssSource,/min-height: 48px; padding: 12px 28px/);
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
