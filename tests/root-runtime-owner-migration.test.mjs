import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
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
    if (canonical === 'apps/web/app/not-found.tsx') {
      assert.equal(productionProof.protected[canonical], '73fb0bf30b6e8302c1526d9f9ce979147377938026c03f4de2a60d9bb1f31fe8');
      const insertion = " style={{ width: 'min(160px, 100%)', justifyContent: 'center' }}";
      assert.equal(canonicalSource.split(insertion).length, 2, 'exact reviewed 404 button style occurs once');
      canonicalSource = canonicalSource.replace(insertion, '');
    }
    assert.equal(createHash('sha256').update(canonicalSource).digest('hex'), reviewed?.candidateSha256 ?? productionProof.protected[canonical], canonical);
    const dynamic = read(canonical).match(/^export const dynamic = (.+);$/m)?.[1];
    const owner = '@/' + canonical.replace(/\.[^.]+$/, '');
    assert.equal(source, (dynamic ? `export const dynamic = ${dynamic};\n` : '') + `export { ${dynamic ? 'GET' : 'default, metadata'} } from "${owner}";\n`);
    const sentinel = { __esModule: true, default: () => null, metadata: { title: 'fixture' }, GET: () => new Response('fixture') };
    const candidate = loadFixtureModule(file, { sources: new Map([[file, source]]), mocks: new Map([[owner, sentinel]]) });
    assert.deepEqual(Object.keys(candidate).sort(), dynamic ? ['GET', 'dynamic'] : ['default', 'metadata']);
    for (const name of dynamic ? ['GET'] : ['default', 'metadata']) assert.equal(candidate[name], sentinel[name]);
    if (dynamic) assert.equal(candidate.dynamic, JSON.parse(dynamic));
  };
  for (const route of routes) verify(route);
  assert.throws(() => verify(routes[0], read('app/' + routes[0]).replace('default, metadata', 'default')));
  assert.throws(() => verify(routes[2], read('app/' + routes[2]).replace('force-static', 'force-dynamic')));
  assert.throws(() => verify(routes[1], read('app/' + routes[1]).replace('@/apps/web/', '@/apps/admin/')));
  assert.throws(() => verify(routes[1], undefined, read('apps/web/app/not-found.tsx').replace('min(160px, 100%)', 'min(161px, 100%)')));
  assert.throws(() => verify(routes[1], undefined, read('apps/web/app/not-found.tsx').replace('ดูบทความ', 'unreviewed copy')));
});

test('compiled root and Web 404 recovery retain centered bounded buttons, copy, href and metadata', () => {
  const shared = { Website43Navbar: () => null, Website43Footer: () => null };
  const mocks = new Map([['@/components/layout/website-43/Website43Shared', shared]]);
  const legacy = loadFixtureModule('app/not-found.tsx', { mocks });
  const canonical = loadFixtureModule('apps/web/app/not-found.tsx', { mocks });
  assert.deepEqual(legacy.metadata, canonical.metadata);
  for (const page of [legacy, canonical]) {
    const html = renderToStaticMarkup(page.default());
    assert.match(html, /<a style="width:min\(160px, 100%\);justify-content:center" href="\/blog\/">ดูบทความ<\/a>/);
    assert.match(html, /href="\/">กลับหน้าแรก<\/a>/);
    assert.match(html, /<h1>ไม่พบหน้าที่คุณกำลังหา<\/h1>/);
  }
});

test('root compatibility routes delegate implementations to their canonical app owners', () => {
  assert.equal(inventory.pairs.length, 49);
  for (const { legacy, canonical, wrapper, status } of inventory.pairs) {
    assert.equal(status, 'migrated', legacy);
    assert.equal(read(legacy), wrapper, legacy);
    assert.equal(existsSync(resolve(root, canonical)), true, canonical);
    const implementation = read(canonical);
    const namedReexports = [...implementation.matchAll(/export \{\s*([^}]+)\s*\}/g)].flatMap(match => match[1].split(',').map(name => name.trim()));
    const wrapperExports = [...wrapper.matchAll(/export \{\s*([^}]+)\s*\}/g)].flatMap(match => match[1].split(',').map(name => name.trim()));
    for (const name of ['default', 'metadata']) {
      const exported = name === 'default' ? /export default\b/.test(implementation) : /export const metadata\b/.test(implementation);
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
    const match = read(file).match(/^@import "([^"\n]+)";\s*$/);
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
