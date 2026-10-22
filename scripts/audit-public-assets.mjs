import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import {
  getReachableStyleFiles,
  reachableSources,
  trackedFiles,
  trackedFileSet,
} from './lib/public-reachability.mjs';

const assetExtensions = new Set([
  '.avif', '.gif', '.ico', '.jpeg', '.jpg', '.mp3', '.mp4', '.otf', '.pdf',
  '.png', '.svg', '.ttf', '.webm', '.webp', '.woff', '.woff2',
]);

// Blog/CMS media is outside this cleanup. It has a separate content lifecycle and
// must never be deleted merely because the App Router source graph does not cite it.
const excludedBlogAssetPrefixes = ['public/assets/blog-migration/'];
const excludedBlogAssets = new Set(['public/assets/blog-hub-hero-ccpun-v1.webp']);

// Browser/protocol ownership can exist without a literal source reference.
const implicitlyOwnedAssets = new Set([
  'public/favicon.ico',
  // Keep the legacy alias and previous published URLs until CMS/cache references are audited.
  'public/assets/pun.webp',
  'public/assets/pun.jpg',
  'public/assets/website-43/about-pun.png',
]);

// COO-authorized UAT trust-first change: the three AI-person scenario pictures
// were replaced by static text panels. Preserve the exact existing files for
// review/rollback. This is a closed retirement manifest, never a general unused
// asset exception: changed bytes or renewed runtime use must fail this audit.
const retiredCiScenarioAssets = new Map([
  ['public/assets/ci-story-coverage-v6.webp', '252ef042c664d37020510c7ec48d2a8fdf05489205b1ba4a2e027a681562b422'],
  ['public/assets/ci-story-debt-v6.webp', 'bbf81aaba069ac18e0409c185e2b5057b78c0d4d2265bd228f847057e084f496'],
  ['public/assets/ci-story-income-v6.webp', 'db23ae522203b13cca878a1afba19dffc6b1e469d73a1dd374150c24b479ff9b'],
]);

const auditedAssets = trackedFiles
  .filter((file) => file.startsWith('public/') && assetExtensions.has(extname(file).toLowerCase()))
  .filter((file) => !excludedBlogAssetPrefixes.some((prefix) => file.startsWith(prefix)))
  .filter((file) => !excludedBlogAssets.has(file))
  .sort();

const reachableStyleFiles = getReachableStyleFiles();
const referenceSources = [
  ...reachableSources,
  ...[...reachableStyleFiles].map((file) => [file, readFileSync(file, 'utf8')]),
  ...['next.config.ts', 'apps/web/next.config.ts']
    .filter((file) => trackedFileSet.has(file))
    .map((file) => [file, readFileSync(file, 'utf8')]),
];

// Dynamic asset families are conservatively retained. Example:
// `/assets/icons/${name}.svg` owns that whole directory prefix until the builder
// is refactored to a statically enumerable manifest.
const dynamicAssetPrefixes = new Set();
for (const [, source] of referenceSources) {
  for (const match of source.matchAll(/([/][A-Za-z0-9._/-]*[/])[^`'"\n]*\$\{/g)) {
    if (match[1].startsWith('/assets/')) dynamicAssetPrefixes.add(match[1]);
  }
}

function publicUrlFor(file) {
  return `/${file.slice('public/'.length)}`;
}

function hasRuntimeReference(file) {
  if (implicitlyOwnedAssets.has(file)) return true;
  const publicUrl = publicUrlFor(file);
  const relativeUrl = publicUrl.slice(1);
  if ([...dynamicAssetPrefixes].some((prefix) => publicUrl.startsWith(prefix))) return true;
  return referenceSources.some(([, source]) => source.includes(publicUrl) || source.includes(relativeUrl));
}

function fileSize(file) {
  const row = execFileSync('git', ['ls-tree', '-l', 'HEAD', file], { encoding: 'utf8' }).trim();
  const size = Number(row.split(/\s+/)[3] ?? 0);
  return Number.isFinite(size) ? size : 0;
}

for (const [file, expectedDigest] of retiredCiScenarioAssets) {
  if (!auditedAssets.includes(file)) throw new Error(`Retired CI asset must remain tracked: ${file}`);
  const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (digest !== expectedDigest) throw new Error(`Retired CI asset bytes changed: ${file}`);
  if (hasRuntimeReference(file)) throw new Error(`Retired CI asset has regained a runtime reference: ${file}`);
}

const candidates = auditedAssets
  .filter((file) => !hasRuntimeReference(file))
  .filter((file) => !retiredCiScenarioAssets.has(file))
  .map((file) => ({ file, bytes: fileSize(file), url: publicUrlFor(file) }))
  .sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file));
const candidateBytes = candidates.reduce((sum, asset) => sum + asset.bytes, 0);

console.log('PUBLIC_NON_BLOG_ASSET_AUDIT');
console.log(`audited_assets=${auditedAssets.length}`);
console.log(`reachable_style_files=${reachableStyleFiles.size}`);
console.log(`dynamic_asset_prefixes=${dynamicAssetPrefixes.size}`);
console.log(`retired_preserved_ci_scenario_assets=${retiredCiScenarioAssets.size}`);
console.log(`retired_preserved_ci_scenario_bytes=${[...retiredCiScenarioAssets.keys()].reduce((sum, file) => sum + fileSize(file), 0)}`);
console.log(`zero_runtime_reference_assets=${candidates.length}`);
console.log(`zero_runtime_reference_bytes=${candidateBytes}`);
console.log('ZERO_RUNTIME_REFERENCE_ASSETS_START');
for (const asset of candidates) console.log(`${asset.bytes}\t${asset.file}\t${asset.url}`);
console.log('ZERO_RUNTIME_REFERENCE_ASSETS_END');

if (candidates.length > 0) {
  throw new Error(`Non-Blog Public assets must have a runtime/protocol owner. Found ${candidates.length} unowned asset(s): ${candidates.map((asset) => asset.file).join(', ')}`);
}
