import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

// Exact Admin-only retirement after the actual V5 renderer transfer. Historical
// manifests retain their original values; no old source text is reconstructed.
export const retiredAdminToolUi = Object.freeze({
  'features/ci-planning/components/CILandingIntro.tsx': ['634ffdf75d18bfe63a110c3d798b164fe0cbb4410dd56d8845be411e5ff52d0b', '571aa84c26251f12779f34df925f7e1b259878225844409bd2dfc48689b2b0b0', '60aeafd97e1f4c672bf1c684d385ae8a86e5b2fa7b66f291e4b0feab80682aa0'],
  'features/financial-health-check/components/ClientFHC.tsx': ['538f6c88e61caf04056a62a70cb3ae8ebdf940cc3e8750e71f7f22999b0a2644', '88f007c1e6c33d83bd4befdd69985363609f6c2ddb230861d548cba49c7e0fa2', '65873c493f37e12346019470201fe20ded0ca346b6c1cb2411b2645718260b00', 'e8aaad6993e0228917a2d5da7e4a2e2a537ef1d2546bc4962e5cfa404b4db212'],
  'features/financial-health-check/components/FHCLandingIntro.tsx': ['8740261ccd02f6bff6da64a83c3ba175ddf3d30bbbc85198fb08c325b05e6b76', '647eea6bf3bd725939857b54454fa9e8affea3bfc4a95a19a9aa4938ca554b2c', '8db52b3f04aace2318c53278c223ec4a77cdf189c6796d2a420e282f7ff61298'],
  'components/layout/website-43/Website43ToolHero.tsx': ['09688e184bac6522038cdd52d6326a86561d389597b2423f57cc2779e4a3ff92', 'bfd8593bf862935f0215c1c11c6da2a16c6665c959e80d17c7e521dba3611446'],
});
export const retiredAdminToolAssets = Object.freeze([
  'public/assets/ci-story-coverage-v6.webp',
  'public/assets/ci-story-debt-v6.webp',
  'public/assets/ci-story-income-v6.webp',
]);

export function assertRetiredAdminToolUi(file, historicalDigest, exists = existsSync) {
  if (!Object.hasOwn(retiredAdminToolUi, file)) return false;
  assert.equal(exists(file), false, `${file}: reviewed retired UI cannot be reintroduced`);
  if (historicalDigest !== undefined) assert.ok(retiredAdminToolUi[file].includes(historicalDigest), `${file}: original historical provenance must remain frozen`);
  return true;
}
