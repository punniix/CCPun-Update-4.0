import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');

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
    const critical = 'weight: ["400", "500", "600", "700"]';
    assert.equal(current.split(critical).length, 2, 'one critical Thai Kanit 500 face');
    current = current.replace(critical, 'weight: ["400", "600", "700"]');
    assert.equal(current.split('display: "swap"').length, 3, 'both existing Kanit loaders swap late fonts');
    current = current.replaceAll('display: "swap"', 'display: "optional"');
  }
  if (file === 'apps/admin/app/(control-plane)/operations/health/page.tsx') {
    assert.equal(projection.candidateSha256, '984d7d0c447f6ad47af560dc2b90612cfaa37029734414edc8c40bc44aacb766', 'original Health composition remains frozen');
    assert.equal(sha(current), '4d0045767bdbfdf9ed410e0b1d1cb31b1969d07f74ea0fac02f62c26e447bcce', 'only reviewed numeric serving-runtime rows are admitted');
  } else assert.equal(sha(current), projection.candidateSha256, file + ': unreviewed route composition change');
  for (const [owner, digest] of Object.entries(proof.owners)) {
    const recheckOwner = owner === 'features/admin/components/SeoOverviewPage.tsx';
    const schedulerOwner = owner === 'lib/admin/article-schedule-handler.ts';
    if (recheckOwner) assert.equal(digest, '833dec440489b8f480239b633cfa3c16216259438ae40c4f7af90d939f99e3cb', 'original SEO page owner retained');
    if (schedulerOwner) assert.equal(digest, '13c6e324b87c425d9bd2a2a2cbcc2d735e32e18d9a018f48b6f2d6b8e463fa6a', 'original scheduler owner retained');
    assert.equal(sha(read(owner)), recheckOwner ? 'a5e1224db4db346ba38728535d4131a472f011c628ded09568a5f31db25d9c25' : schedulerOwner ? 'e732c0a3447753faf6b6750f06839d8b2d55c75769fb8466562d335884560b33' : digest, owner + ': shared owner changed without output review');
  }
  const original = proof.baselineSources[file];
  assert.equal(sha(original), projection.baselineSha256, file + ': original Production fixture drift');
  return original;
}
