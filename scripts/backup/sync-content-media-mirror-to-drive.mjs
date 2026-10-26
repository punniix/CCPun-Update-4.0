import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { getGoogleAccessToken, parseServiceAccount } from './google-service-account.mjs';

const CONTENT_FOLDER_ID = '1NgXE5MAi6VYzI74POcikJH_MCpyBDwad';
const MEDIA_FOLDER_ID = '1PVl4yvJ8rHAqQf_jwVUogEvewwMsQq-o';
const root = path.resolve(process.env.MIRROR_ROOT?.trim() || '.ccpun-backup-mirror');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
function escapeDriveQuery(value) { return String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'"); }

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) throw new Error(`Google Drive request failed (${response.status})`);
  return body;
}

async function findChild(token, parentId, name) {
  const params = new URLSearchParams({
    q: `'${escapeDriveQuery(parentId)}' in parents and name = '${escapeDriveQuery(name)}' and trashed = false`,
    spaces: 'drive',
    pageSize: '100',
    fields: 'files(id,name,mimeType,size)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const body = await jsonFetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const files = body?.files ?? [];
  if (files.length > 1) throw new Error(`Drive mirror collision: ${parentId}/${name}`);
  return files[0] ?? null;
}

async function ensureFolder(token, parentId, name) {
  const existing = await findChild(token, parentId, name);
  if (existing) {
    if (existing.mimeType !== 'application/vnd.google-apps.folder') throw new Error(`Expected Drive folder: ${name}`);
    return existing.id;
  }
  const body = await jsonFetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,mimeType', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  if (!body?.id) throw new Error(`Failed to create Drive folder: ${name}`);
  return body.id;
}

function mimeTypeFor(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.json') return 'application/json';
  if (ext === '.md') return 'text/markdown';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

async function createFile(token, parentId, name, mimeType, buffer) {
  const boundary = `ccpun-mirror-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const metadata = JSON.stringify({ name, parents: [parentId] });
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return jsonFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,size,mimeType', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${boundary}` },
    body: payload,
  });
}

async function updateFile(token, fileId, mimeType, buffer) {
  return jsonFetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&supportsAllDrives=true&fields=id,name,size,mimeType`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': mimeType },
    body: buffer,
  });
}

async function syncFile(token, parentId, localPath, name) {
  const buffer = await readFile(localPath);
  if (!buffer.length) throw new Error(`Refusing empty mirror file: ${localPath}`);
  const mimeType = mimeTypeFor(name);
  const existing = await findChild(token, parentId, name);
  if (existing?.mimeType === 'application/vnd.google-apps.folder') throw new Error(`Drive file/folder collision: ${name}`);
  const result = existing
    ? await updateFile(token, existing.id, mimeType, buffer)
    : await createFile(token, parentId, name, mimeType, buffer);
  if (!result?.id || Number(result.size) !== buffer.length) throw new Error(`Drive mirror size verification failed: ${name}`);
  return result.id;
}

async function syncDirectory(token, localDir, driveFolderId) {
  const info = await stat(localDir);
  if (!info.isDirectory()) throw new Error(`Mirror directory missing: ${localDir}`);
  let files = 0;
  let folders = 0;
  const entries = await readdir(localDir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const localPath = path.join(localDir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing symlink in mirror: ${localPath}`);
    if (entry.isDirectory()) {
      const childId = await ensureFolder(token, driveFolderId, entry.name);
      folders += 1;
      const nested = await syncDirectory(token, localPath, childId);
      files += nested.files;
      folders += nested.folders;
    } else if (entry.isFile()) {
      await syncFile(token, driveFolderId, localPath, entry.name);
      files += 1;
    } else {
      throw new Error(`Unsupported filesystem entry in mirror: ${localPath}`);
    }
  }
  return { files, folders };
}

const serviceAccount = parseServiceAccount(required('GOOGLE_BACKUP_SERVICE_ACCOUNT_JSON'));
const token = await getGoogleAccessToken(serviceAccount, ['https://www.googleapis.com/auth/drive']);
const content = await syncDirectory(token, path.join(root, 'content'), CONTENT_FOLDER_ID);
const media = await syncDirectory(token, path.join(root, 'media'), MEDIA_FOLDER_ID);
await syncFile(token, CONTENT_FOLDER_ID, path.join(root, 'manifest.json'), 'mirror-manifest.json');
console.log(JSON.stringify({ content, media, policy: 'upsert-only; no Drive deletions' }, null, 2));
