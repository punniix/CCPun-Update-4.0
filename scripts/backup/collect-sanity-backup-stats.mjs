import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@sanity/client';

const PROJECT_ID = 'kyfxgjnq';
const DATASET = 'production';
const token = process.env.SANITY_AUTH_TOKEN?.trim();
const outputPath = path.resolve(process.env.BACKUP_STATS_FILE?.trim() || '.ccpun-backup-stats.json');

if (!token) throw new Error('SANITY_AUTH_TOKEN is required');
if ((process.env.SANITY_PROJECT_ID?.trim() || PROJECT_ID) !== PROJECT_ID) throw new Error('Backup stats are pinned to kyfxgjnq');
if ((process.env.SANITY_DATASET?.trim() || DATASET) !== DATASET) throw new Error('Backup stats are pinned to production');

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  token,
  apiVersion: '2026-08-24',
  useCdn: false,
  perspective: 'raw',
});

const documents = await client.fetch(`*[]{_id,_type}`);
if (!Array.isArray(documents) || !documents.length) throw new Error('Production dataset returned no documents');

const nonSystem = documents.filter((document) => typeof document?._id === 'string' && !document._id.startsWith('_.'));
const typeCounts = {};
for (const document of nonSystem) {
  const type = String(document?._type || 'unknown');
  typeCounts[type] = (typeCounts[type] ?? 0) + 1;
}
const sortedTypeCounts = Object.fromEntries(Object.entries(typeCounts).sort(([a], [b]) => a.localeCompare(b)));
const drafts = nonSystem.filter((document) => document._id.startsWith('drafts.')).length;
const stats = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  projectId: PROJECT_ID,
  dataset: DATASET,
  totalNonSystem: nonSystem.length,
  drafts,
  nonDrafts: nonSystem.length - drafts,
  imageAssets: typeCounts['sanity.imageAsset'] ?? 0,
  fileAssets: typeCounts['sanity.fileAsset'] ?? 0,
  typeCounts: sortedTypeCounts,
};

await writeFile(outputPath, `${JSON.stringify(stats, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({
  output: outputPath,
  totalNonSystem: stats.totalNonSystem,
  drafts: stats.drafts,
  imageAssets: stats.imageAssets,
  fileAssets: stats.fileAssets,
  types: Object.keys(stats.typeCounts).length,
}, null, 2));
