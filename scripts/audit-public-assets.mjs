import { execFileSync } from 'node:child_process';
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
const implicitlyOwnedAssets = new Set(['public/favicon.ico']);

const auditedAssets = trackedFiles
  .filter((file) => file.startsWith('public/') && assetExtensions.has(extname(file).toLowerCase()))
  .filter((file) => !excludedBlogAssetPrefixes.some((prefix) => file.startsWith(prefix)))
  .filter((file) => !excludedBlogAssets.has(file))
  .sort();

const reachableStyleFiles = getReachableStyleFiles();
const referenceSources = [
  ...reachableSources,
  ...[...reachableStyleFiles].map((file) => [file, readFileSync(file, 'utf8')]),
  ...['next.config.ts', 'vercel.json']
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

const candidates = auditedAssets
  .filter((file) => !hasRuntimeReference(file))
  .map((file) => ({ file, bytes: fileSize(file), url: publicUrlFor(file) }))
  .sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file));
const candidateBytes = candidates.reduce((sum, asset) => sum + asset.bytes, 0);

console.log('PUBLIC_NON_BLOG_ASSET_AUDIT');
console.log(`audited_assets=${auditedAssets.length}`);
console.log(`reachable_style_files=${reachableStyleFiles.size}`);
console.log(`dynamic_asset_prefixes=${dynamicAssetPrefixes.size}`);
console.log(`zero_runtime_reference_assets=${candidates.length}`);
console.log(`zero_runtime_reference_bytes=${candidateBytes}`);
console.log('ZERO_RUNTIME_REFERENCE_ASSETS_START');
for (const asset of candidates) console.log(`${asset.bytes}\t${asset.file}\t${asset.url}`);
console.log('ZERO_RUNTIME_REFERENCE_ASSETS_END');

// Discovery-only during this cleanup pass. Once each candidate has been reviewed
// and either deleted or given an explicit owner, this becomes a permanent gate.
