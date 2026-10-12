import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
export const phase2FoundationPath = 'components/styles/global-foundation.css';
const ownBaseline = '8af261f3865c52a8065c69903d50338e3f09b010';
export const phase2RuntimeCssSources = ["../../components", "../../features", "../../app", "../../apps", "../../lib", "../../cms", "../../db", "../../types", "../../workers", "../../auth.ts", "../../proxy.ts", "../../next.config.ts", "../../sanity.config.ts", "../../sanity.cli.ts", "../../public/nav-config.json"];
const digest = value => createHash('sha256').update(value).digest('hex');
// Assert actual current stylesheet ownership. No historical source is returned
// to a reader, and declarations/style imports remain byte-exact.
export function assertPhase2FoundationSource(file, expectedOriginalDigest, {
  proof = JSON.parse(readFileSync(new URL('./phase2-css-delivery-parity.json', import.meta.url), 'utf8')),
  read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8'),
} = {}) {
  assert.equal(file, phase2FoundationPath);
  assert.equal(proof.baseline, ownBaseline);
  assert.equal(digest(proof.foundationSource), expectedOriginalDigest);
  assert.equal(proof.foundationSha256, expectedOriginalDigest);
  assert.ok(proof.foundationSource.startsWith('@import "tailwindcss";\n@source "../../components";\n@source "../../features";\n'));
  const expected = proof.foundationSource.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
    .replace('@source "../../features";\n', '@source "../../features";\n' + phase2RuntimeCssSources.slice(2).map(owner => '@source "' + owner + '";\n').join(''));
  assert.equal(read(file), expected, 'exact source directive registry and all remaining declarations/import order');
  return true;
}
