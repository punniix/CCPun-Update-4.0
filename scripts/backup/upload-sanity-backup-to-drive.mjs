import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getGoogleAccessToken, parseServiceAccount } from './google-service-account.mjs';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function bangkokTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${byType.year}-${byType.month}-${byType.day} ${byType.hour}:${byType.minute}:${byType.second} Asia/Bangkok`;
}

async function sha256(filePath) {
  const buffer = await readFile(filePath);
  return { buffer, digest: createHash('sha256').update(buffer).digest('hex') };
}

async function loadStats(filePath, projectId, dataset) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    throw new Error('Backup stats file is missing or invalid');
  }
  if (parsed?.projectId !== projectId || parsed?.dataset !== dataset) throw new Error('Backup stats source mismatch');
  for (const key of ['totalNonSystem', 'drafts', 'nonDrafts', 'imageAssets', 'fileAssets']) {
    if (!Number.isInteger(parsed?.[key]) || parsed[key] < 0) throw new Error(`Backup stats field is invalid: ${key}`);
  }
  if (!parsed?.typeCounts || typeof parsed.typeCounts !== 'object' || Array.isArray(parsed.typeCounts)) {
    throw new Error('Backup stats typeCounts are invalid');
  }
  return parsed;
}

async function uploadMultipart({ token, folderId, filePath, fileName, mimeType }) {
  const { buffer } = await sha256(filePath);
  const boundary = `ccpun-backup-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,size,webViewLink',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/related; boundary=${boundary}`,
        'content-length': String(body.length),
      },
      body,
    },
  );
  if (!response.ok) throw new Error(`Google Drive upload failed (${response.status})`);
  const result = await response.json();
  if (!result?.id) throw new Error('Google Drive upload returned no file id');
  if (Number(result.size) !== buffer.length) throw new Error(`Google Drive upload size mismatch for ${fileName}`);
  return result;
}

async function appendSnapshotRow({ token, spreadsheetId, values }) {
  const range = encodeURIComponent("'Snapshots'!A:K");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
  if (!response.ok) throw new Error(`Backup Registry append failed (${response.status})`);
  const result = await response.json();
  if (!result?.updates?.updatedRows) throw new Error('Backup Registry append did not update a row');
  return result;
}

async function writeGithubOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const { appendFile } = await import('node:fs/promises');
  await appendFile(outputPath, `${name}=${String(value).replaceAll('\n', ' ')}\n`);
}

async function main() {
  const archivePath = path.resolve(required('BACKUP_FILE'));
  const statsPath = path.resolve(required('BACKUP_STATS_FILE'));
  const folderId = required('GOOGLE_DRIVE_BACKUP_FOLDER_ID');
  const spreadsheetId = required('GOOGLE_BACKUP_REGISTRY_SHEET_ID');
  const projectId = required('SANITY_PROJECT_ID');
  const dataset = required('SANITY_DATASET');
  const snapshotId = required('BACKUP_SNAPSHOT_ID');
  const gitSha = required('BACKUP_GIT_SHA');
  const backupType = process.env.BACKUP_TYPE?.trim() || 'Full Sanity dataset export';
  const createdAt = bangkokTimestamp();

  const serviceAccount = parseServiceAccount(required('GOOGLE_BACKUP_SERVICE_ACCOUNT_JSON'));
  const token = await getGoogleAccessToken(serviceAccount, [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
  ]);

  const archiveInfo = await stat(archivePath);
  if (!archiveInfo.isFile() || archiveInfo.size <= 0) throw new Error('Sanity export archive is empty or missing');
  const archiveHash = await sha256(archivePath);
  const stats = await loadStats(statsPath, projectId, dataset);
  const manifestPath = `${archivePath}.manifest.json`;
  const manifest = {
    schemaVersion: 2,
    snapshotId,
    createdAt,
    type: backupType,
    sanity: { projectId, dataset, includesDrafts: true, includesAssets: true },
    source: {
      gitSha,
      githubRepository: process.env.GITHUB_REPOSITORY ?? null,
      githubRunId: process.env.GITHUB_RUN_ID ?? null,
      githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    },
    archive: {
      fileName: path.basename(archivePath),
      bytes: archiveInfo.size,
      sha256: archiveHash.digest,
    },
    stats,
    restoreStatus: 'NOT_TESTED',
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  const archiveUpload = await uploadMultipart({
    token,
    folderId,
    filePath: archivePath,
    fileName: path.basename(archivePath),
    mimeType: 'application/gzip',
  });
  const manifestUpload = await uploadMultipart({
    token,
    folderId,
    filePath: manifestPath,
    fileName: path.basename(manifestPath),
    mimeType: 'application/json',
  });

  await appendSnapshotRow({
    token,
    spreadsheetId,
    values: [
      snapshotId,
      createdAt,
      backupType,
      gitSha,
      '',
      projectId,
      dataset,
      `Full dataset incl. drafts (${stats.totalNonSystem} non-system docs; ${stats.drafts} drafts)`,
      `Included + strict asset verification (${stats.imageAssets} image; ${stats.fileAssets} file assets)`,
      `Drive archive ${archiveUpload.id}; manifest ${manifestUpload.id}`,
      'PENDING RESTORE TEST',
    ],
  });

  await writeGithubOutput('snapshot_id', snapshotId);
  await writeGithubOutput('drive_archive_id', archiveUpload.id);
  await writeGithubOutput('drive_manifest_id', manifestUpload.id);
  await writeGithubOutput('archive_sha256', archiveHash.digest);
  console.log(`Backup uploaded and registered: ${snapshotId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Backup upload failed');
  process.exitCode = 1;
});
