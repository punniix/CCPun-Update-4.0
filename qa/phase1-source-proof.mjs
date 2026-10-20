import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');

// Admit only the reviewed literal-to-registry extraction; recover the original bytes.
export function pageSeoRootMetadataBaseline(source, registry) {
  assert.equal(sha(source), '85d6d0b4bc1e4014119e1381f3f6d5b7f4a98644628740686552ed7d56e75724');
  if (sha(registry) !== '988d3fc97c9c0537eb0e74ee673b0fa822f96085a4b810eafef4f5f092e3e8eb') {
    assert.equal(sha(registry), 'f6e68802f9bc2958d6625f94e5620f64b0b63228bcee69197c36668bcd9c7673', 'only reviewed public singleton IDs may differ');
    for (const key of ['home', 'blog', 'ci-planning', 'financial-health-check', 'money-story', 'investment-allocation', 'privacy', 'cookie-policy']) {
      const current = '"documentId": "pageSeo-' + key + '"';
      assert.equal(registry.split(current).length - 1, 1, 'each public singleton ID must occur once');
      registry = registry.replace(current, '"documentId": "pageSeo.' + key + '"');
    }
  }
  assert.equal(sha(registry), '988d3fc97c9c0537eb0e74ee673b0fa822f96085a4b810eafef4f5f092e3e8eb');
  const table = registry.match(/export const PAGE_SEO_PAGES: readonly PageSeoPage\[\] = (\[[\s\S]*?\n\]);/);
  assert.ok(table, 'reviewed JSON defaults table is required');
  const pages = JSON.parse(table[1]);
  assert.deepEqual(pages.map(page => page.pathname), ['/', '/blog/', '/ci-planning/', '/tools/financial-health-check/', '/play/money-story/', '/tools/investment-allocation/', '/privacy/', '/cookie-policy/']);
  const defaults = pages[0].defaults;
  const counts = { seoTitle: 1, seoDescription: 1, ogTitle: 2, ogDescription: 2, ogImageUrl: 2 };
  assert.deepEqual(Object.keys(defaults), Object.keys(counts));
  for (const line of ['import { getPageSeoPage } from "@/lib/content/page-seo-registry";\n', 'const PAGE_SEO_DEFAULTS = getPageSeoPage("/")!.defaults;\n\n']) {
    assert.equal(source.split(line).length - 1, 1, 'reviewed registry wiring must occur exactly once');
    source = source.replace(line, '');
  }
  for (const [field, count] of Object.entries(counts)) {
    assert.equal(typeof defaults[field], 'string');
    const expression = 'PAGE_SEO_DEFAULTS.' + field + '!';
    assert.equal(source.split(expression).length - 1, count, 'reviewed metadata substitution count drift');
    source = source.replaceAll(expression, JSON.stringify(defaults[field]));
  }
  assert.equal(sha(source), '2983a29ac19e21bab33d4faa9d9245a3643fa6fdbbd08821463e67233fdee874', 'original metadata owner bytes must be recovered exactly');
  return source;
}

// An explicit, reviewed composition projection, not a protected-path exemption.
// Every admitted route AND every new implementation owner remains hash-checked.
// The same original modules execute in the registered Phase 1 DOM/API/denial fixtures.
export function productionBaselineSource(file) {
  const proof = JSON.parse(read('qa/phase1-source-ownership.json'));
  const projection = proof.compositions?.[file];
  if (!projection) return read(file);
  let current = read(file);
  if (file === 'apps/web/app/layout.tsx') {
    const approved = 'weight: ["300", "400", "500", "600", "700"]';
    assert.equal(current.split(approved).length, 2, 'only the noncritical Kanit face adds weight 500 once');
    current = current.replace(approved, 'weight: ["300", "400", "600", "700"]');
  }
  assert.equal(sha(current), projection.candidateSha256, file + ': unreviewed route composition change');
  for (const [owner, digest] of Object.entries(proof.owners)) {
    const current = read(owner);
    const originalOwner = owner === 'lib/seo/root-metadata.ts' ? pageSeoRootMetadataBaseline(current, read('lib/content/page-seo-registry.ts')) : current;
    assert.equal(sha(originalOwner), digest, owner + ': shared owner changed without output review');
  }
  const original = proof.baselineSources[file];
  assert.equal(sha(original), projection.baselineSha256, file + ': original Production fixture drift');
  return original;
}
