import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const importerPath = path.join(root, 'scripts/import-wordpress-drafts-to-sanity.mjs');
const exporterPath = path.join(root, 'scripts/export-wordpress-drafts-via-cdp.mjs');
const temp = await mkdtemp(path.join(tmpdir(), 'ccpun-cms-safety-'));
const fixturePath = path.join(temp, 'wp-drafts-export.json');

const fixture = {
  source: 'https://blog.ccpun.com',
  exportedAt: '2026-08-19T00:00:00.000Z',
  posts: [{
    wpId: 900001,
    slug: 'uat-synthetic-draft',
    status: 'draft',
    title: 'Synthetic UAT Draft',
    contentHtml: '<h2>Heading</h2><p>Body</p>',
    excerptHtml: '<p>Excerpt</p>',
    authorId: 7,
    author: { id: 7, name: 'CCPun', slug: 'ccpun' },
    categories: [{ id: 8, name: 'ประกันสุขภาพ', slug: 'health-insurance' }],
    tags: [{ id: 9, name: 'Synthetic', slug: 'synthetic' }],
    rankMath: { title: 'Synthetic SEO title', description: 'Synthetic SEO description' },
    featuredImage: null,
    date: '2026-08-19T00:00:00.000Z',
    modified: '2026-08-19T00:00:00.000Z',
  }],
};

const runImporter = (args, uatMode = '') => {
  const env = { ...process.env, WP_DRAFT_EXPORT: fixturePath, CCPUN_UAT_MODE: uatMode };
  for (const name of ['SANITY_API_PROJECT_ID', 'NEXT_PUBLIC_SANITY_PROJECT_ID', 'SANITY_API_DATASET', 'NEXT_PUBLIC_SANITY_DATASET', 'SANITY_API_WRITE_TOKEN']) delete env[name];
  return spawnSync(process.execPath, [importerPath, ...args], { cwd: root, env, encoding: 'utf8' });
};

try {
  await writeFile(fixturePath, `${JSON.stringify(fixture)}\n`, { mode: 0o600 });

  for (const args of [[], ['--dry-run']]) {
    const result = runImporter(args);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /"mode":"dry-run"/);
    assert.match(result.stdout, /"mutationAttempted":false/);
    assert.match(result.stdout, /"commitRequired":true/);
    assert.match(result.stdout, /"categoryRef":"ccpun-wp-category-4"/);
    assert.match(result.stdout, /"tags":\["Synthetic","ประกันสุขภาพ"\]/);
  }

  const unknown = runImporter(['--unknown']);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /Unknown argument/);

  const blockedCommit = runImporter(['--commit']);
  assert.notEqual(blockedCommit.status, 0);
  assert.match(blockedCommit.stderr, /Refusing to write outside explicit UAT mode/);

  const missingCredentials = runImporter(['--commit'], '1');
  assert.notEqual(missingCredentials.status, 0);
  assert.match(missingCredentials.stderr, /Missing Sanity UAT configuration/);

  const [importer, exporter, studio, schema, gitignore] = await Promise.all([
    readFile(importerPath, 'utf8'),
    readFile(exporterPath, 'utf8'),
    readFile(path.join(root, 'sanity.config.ts'), 'utf8'),
    readFile(path.join(root, 'cms/sanity/schema/documents/article.ts'), 'utf8'),
    readFile(path.join(root, '.gitignore'), 'utf8'),
  ]);
  assert.doesNotMatch(importer, /createOrReplace/);
  assert.match(importer, /createIfNotExists/);
  assert.match(importer, /sourceRevision/);
  assert.match(importer, /tmpdir\(\)/);
  assert.match(exporter, /tmpdir\(\)/);
  assert.match(exporter, /X-WP-TotalPages/);
  assert.match(gitignore, /wp-drafts-export\*\.json/);
  assert.match(studio, /filterStudioDocumentActions\(previousActions, context\.dataset, environment, context\.schemaType, projectId\)/);
  assert.match(schema, /ก่อนเผยแพร่ ต้องตั้งขั้นตรวจเนื้อหาเป็น “อนุมัติเนื้อหาแล้ว”/);

  console.log('PASS: 23/23 CMS Draft migration safety checks');
} finally {
  await rm(temp, { recursive: true, force: true });
}
