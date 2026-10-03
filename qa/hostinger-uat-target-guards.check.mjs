import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// No browser, network or output-directory write can occur in these checks.
const poison = 'data:text/javascript,' + encodeURIComponent(`
  import fs from 'node:fs/promises'; import http from 'node:http'; import https from 'node:https';
  import {syncBuiltinESMExports} from 'node:module';
  const deny=()=>{throw new Error('QA_CHECK_SIDE_EFFECT_DENIED')};
  globalThis.fetch=deny; globalThis.WebSocket=class{constructor(){deny()}};
  fs.mkdir=deny; fs.writeFile=deny; http.request=deny; http.get=deny; https.request=deny; https.get=deny;
  syncBuiltinESMExports();
`);
const syntheticSecret = 'SYNTHETIC_PREVIEW_SECRET_ONLY';
const uat = { CCPUN_UAT_MODE: '1', SANITY_API_PROJECT_ID: 'ccb9lnw5', SANITY_API_DATASET: 'uat' };
let checked = 0;
function check(script, env, allowed) {
  const result = spawnSync(process.execPath, ['--import', poison,
    fileURLToPath(new URL(script, import.meta.url)), '--check-target'], {
    env: { PATH: process.env.PATH, NODE_ENV: 'test', ...env }, encoding: 'utf8', timeout: 15_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status === 0, allowed);
  assert.equal(result.stdout.includes('_UAT_TARGET_OK'), allowed);
  assert.equal((result.stdout + result.stderr).includes(syntheticSecret), false);
  assert.equal((result.stdout + result.stderr).includes('QA_CHECK_SIDE_EFFECT_DENIED'), false);
  checked++;
}
const admin = (url, change = {}, allowed = false) => check('./admin-41-responsive-regression.mjs', {
  ADMIN_PREVIEW_URL: url, ADMIN_REVIEW_EXPECTATION: 'empty', ...change,
}, allowed);
const blog = (url, change = {}, allowed = false) => check('./blog-uat-regression.mjs', {
  ...uat, UAT_BASE_URL: url, ...change,
}, allowed);
for (const url of ['https://admin-test.ccpun.com', 'https://ccpun-admin-git-uat-example.vercel.app']) admin(url, {}, true);
for (const url of ['https://test.ccpun.com/', 'https://ccpun-web-git-uat-example.vercel.app', 'http://127.0.0.1:3001']) blog(url, {}, true);
for (const url of ['https://admin.ccpun.com', 'https://ccpun.com', 'https://test.ccpun.com', 'https://ccpun-admin.vercel.app',
  'https://ccpun-admin-git-v4-production-example.vercel.app', 'http://admin-test.ccpun.com', 'https://admin-test.ccpun.com:8443',
  'http://localhost:3100', `https://${syntheticSecret}@admin-test.ccpun.com`, `https://admin-test.ccpun.com/?secret=${syntheticSecret}`]) admin(url);
for (const url of ['https://ccpun.com', 'https://admin-test.ccpun.com', 'https://ccpun-web.vercel.app',
  'https://ccpun-web-git-v4-production-example.vercel.app', 'http://test.ccpun.com', 'https://test.ccpun.com:8443',
  `https://${syntheticSecret}@test.ccpun.com`, `https://test.ccpun.com/#${syntheticSecret}`]) blog(url);
admin('https://admin-test.ccpun.com', { VERCEL_ENV: 'production' });
for (const change of [{ CCPUN_UAT_MODE: undefined }, { CCPUN_UAT_MODE: '0' }, { VERCEL_ENV: 'production' },
  { CCPUN_APP_ENV: 'production' }, { SANITY_API_PROJECT_ID: 'kyfxgjnq' }, { SANITY_API_DATASET: 'production' },
  { NEXT_PUBLIC_SANITY_PROJECT_ID: 'kyfxgjnq' }, { NEXT_PUBLIC_SANITY_DATASET: 'production' }]) blog('https://test.ccpun.com', change);
const preview = `https://test.ccpun.com/api/preview/enable?sanity-preview-secret=${syntheticSecret}`;
blog('https://test.ccpun.com', { BLOG_UAT_PREVIEW_URL: preview }, true);
blog('https://test.ccpun.com', { BLOG_UAT_PREVIEW_URL: `${preview}&sanity-preview-pathname=%2Fblog%2F` }, true);
blog('https://test.ccpun.com', { BLOG_UAT_PREVIEW_URL: preview, SANITY_API_PROJECT_ID: 'kyfxgjnq' });
for (const url of [preview.replace('test.ccpun.com', 'ccpun.com'), preview.replace('test.ccpun.com', 'admin-test.ccpun.com'),
  preview.replace('/api/preview/enable', '/blog/'), preview.replace(syntheticSecret, ''), `${preview}#secret`,
  `${preview}&sanity-preview-secret=SECOND_SYNTHETIC`, `${preview}&sanity-preview-pathname=%2F&sanity-preview-pathname=%2Fblog%2F`,
  `${preview}&sanity-preview-pathname=https%3A%2F%2Fccpun.com%2F`, `${preview}&sanity-preview-pathname=%2F%2Fccpun.com%2F`,
  preview.replace('https://', `https://${syntheticSecret}@`), syntheticSecret]) {
  blog('https://test.ccpun.com', { BLOG_UAT_PREVIEW_URL: url });
}
console.log(`UAT target preflight checks passed: ${checked}; zero external or filesystem-output calls`);
