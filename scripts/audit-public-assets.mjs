import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const publicFiles = trackedFiles.filter((file) => file.startsWith('public/') && !file.endsWith('/'));
const textExtensions = new Set([
  '', '.css', '.csv', '.html', '.js', '.jsx', '.json', '.md', '.mjs', '.svg', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
]);
const searchFiles = trackedFiles.filter((file) =>
  !file.startsWith('.git/') &&
  !file.startsWith('node_modules/') &&
  textExtensions.has(extname(file).toLowerCase()),
);
const searchSources = [];
for (const file of searchFiles) {
  try {
    searchSources.push([file, readFileSync(file, 'utf8')]);
  } catch {
    // Ignore text-extension files that are not UTF-8 readable.
  }
}

const implicitExactPaths = new Set([
  'public/favicon.ico',
  'public/llms.txt',
]);
const protectedPrefixes = [
  'public/.well-known/',
  // These are migration/source artifacts that may still be referenced by historical
  // Sanity content or migration ledgers. They need a content-plane audit before deletion.
  'public/assets/blog-migration/',
];

function publicUrl(file) {
  return `/${file.slice('public/'.length)}`;
}

function isProtected(file) {
  return implicitExactPaths.has(file) || protectedPrefixes.some((prefix) => file.startsWith(prefix));
}

function hasReference(file) {
  const url = publicUrl(file);
  const relative = file.slice('public/'.length);
  const basename = relative.split('/').at(-1);
  for (const [sourceFile, source] of searchSources) {
    if (sourceFile === file) continue;
    if (source.includes(url) || source.includes(relative) || (basename && source.includes(basename))) {
      return true;
    }
  }
  return false;
}

const entries = publicFiles.map((file) => ({
  file,
  size: statSync(file).size,
  protected: isProtected(file),
  referenced: hasReference(file),
}));

const candidates = entries
  .filter((entry) => !entry.protected && !entry.referenced)
  .sort((a, b) => b.size - a.size || a.file.localeCompare(b.file));

const protectedUnreferenced = entries
  .filter((entry) => entry.protected && !entry.referenced)
  .sort((a, b) => b.size - a.size || a.file.localeCompare(b.file));

const totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
const candidateBytes = candidates.reduce((sum, entry) => sum + entry.size, 0);

console.log('PUBLIC_ASSET_AUDIT');
console.log(`public_files=${entries.length}`);
console.log(`public_bytes=${totalBytes}`);
console.log(`unreferenced_delete_candidates=${candidates.length}`);
console.log(`unreferenced_delete_candidate_bytes=${candidateBytes}`);
console.log(`protected_unreferenced=${protectedUnreferenced.length}`);
console.log('UNREFERENCED_DELETE_CANDIDATES_START');
for (const entry of candidates) console.log(`${entry.size}\t${entry.file}`);
console.log('UNREFERENCED_DELETE_CANDIDATES_END');
console.log('PROTECTED_UNREFERENCED_START');
for (const entry of protectedUnreferenced) console.log(`${entry.size}\t${entry.file}`);
console.log('PROTECTED_UNREFERENCED_END');
