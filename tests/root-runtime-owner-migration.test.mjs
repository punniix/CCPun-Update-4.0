import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const inventory = JSON.parse(read('qa/root-runtime-owner-migration.json'));

test('root compatibility routes delegate implementations to their canonical app owners', () => {
  assert.equal(inventory.pairs.length, 48);
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
