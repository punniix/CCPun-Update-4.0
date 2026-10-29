import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
// Exact Web847 -> UAT text binding successor. Historical pins and default-output goldens remain unchanged.
// Complete-file gating plus positional byte inverses reject every unknown input; no baseline source copies.
export const cmsCopyScopePins = Object.freeze({
  "lib/content/public-copy-registry.ts": {
    "before": "a66dde0f33997b85b770cf62affac3141b9384ac6edfe8a221eedc8ae1c9d981",
    "after": "4a426876b5c37e45fcdc883bdcc38572e8c16a6f51a3aad3b1ced697939005ae",
    "edits": [
      [
        0,
        "import { ABOUT_COPY_DEFAULTS } from \"./about-copy-defaults\";\nimport { TOOLS_HUB_COPY_DEFAULTS } from \"./tools-hub-copy-defaults\";\n",
        ""
      ],
      [
        7260,
        "about: { label: \"รู้จักปั้น (ข้อความเดิมระหว่างตรวจ UAT)\", pathname: \"/about/\", defaults: ABOUT_COPY_DEFAULTS }, toolsHub: { label: \"รวมเครื่องมือ\", pathname: \"/tools/\", defaults: TOOLS_HUB_COPY_DEFAULTS }, ",
        ""
      ],
      [
        8454,
        "// Existing Production document IDs stay pinned; new v5 copy scopes are UAT-only.\nexport const PRODUCTION_PUBLIC_COPY_SCOPES = [\"site\", \"home\", \"ci\", \"fhc\", \"blog\", \"privacy\", \"cookies\", \"moneyStory\"] as const;\nexport function isPublicCopyScopeAvailable(scope: string, dataset: string | undefined): scope is PublicCopyScope {\n  return Object.hasOwn(PUBLIC_COPY_SCOPES, scope)\n    && (dataset === \"uat\" || (dataset === \"production\" && (PRODUCTION_PUBLIC_COPY_SCOPES as readonly string[]).includes(scope)));\n}\n",
        ""
      ],
      [
        9048,
        " keyof typeof ABOUT_COPY_DEFAULTS | keyof typeof TOOLS_HUB_COPY_DEFAULTS |",
        ""
      ],
      [
        9522,
        " ...ABOUT_COPY_DEFAULTS, ...TOOLS_HUB_COPY_DEFAULTS,",
        ""
      ]
    ]
  },
  "lib/content/public-copy.ts": {
    "before": "a06e7566796038415b36c95ab7ed455032b485c45a703f507c78f654c0e235b6",
    "after": "2d72b2498d9f9a6807456fc37d1b75a2a6a8c517f62cceccf2004656783255ca",
    "edits": [
      [
        108,
        "resolveContentEnvironment } from \"./sanity-lane\";\nimport { ",
        ""
      ],
      [
        185,
        ", isPublicCopyScopeAvailable",
        ""
      ],
      [
        491,
        "\n  // New page-copy scopes are reviewed in UAT only. Never request them from Production.\n  const environment = resolveContentEnvironment();\n  const dataset = [\"development\", \"web-uat\", \"local-uat\", \"admin-uat\"].includes(environment) ? \"uat\" : \"production\";\n  if (!isPublicCopyScopeAvailable(scope, dataset)) return {};",
        ""
      ]
    ]
  },
  "features/investment-allocation/page.tsx": {
    "before": "0aa2a72bd590fadfd62fe1a7e9899839a05dfed871c3d0f1c170c261c94e2239",
    "after": "89b9a8ff9876cc08ba27f76e43a1fb2fa70c1136ebfdc61370cc8e8e37a39bb5",
    "edits": [
      [
        2858,
        "return renderInvestmentAllocationContent(copy, siteCopy);\n}\n\n/** Same page content for the authenticated UAT text preview; its caller owns access/lane checks. */\nexport function renderInvestmentAllocationContent(copy: PublicCopyValues, siteCopy?: PublicCopyValues) {\n  ",
        ""
      ]
    ]
  },
  "package.json": {
    "before": "ee01c010642677549828599e2351391b717de7ac8a7dbaabb09bdb324721c871",
    "after": "f0efc61147dcfd1394c22f5613373e657c6c76633426f427d10f999366609fb2",
    "edits": [
      [
        4350,
        ".test.mjs && node --test tests/v5-public-copy-pages",
        ""
      ]
    ]
  }
});
export function cmsCopyScopePredecessor(file, source) {
  const pin = Object.hasOwn(cmsCopyScopePins, file) ? cmsCopyScopePins[file] : null;
  if (!pin || typeof source !== 'string' || sha(source) !== pin.after) return source;
  for (const [offset, current, prior] of [...pin.edits].reverse()) {
    assert.equal(source.slice(offset, offset + current.length), current, 'exact owned text binding bytes');
    source = source.slice(0, offset) + prior + source.slice(offset + current.length);
  }
  assert.equal(sha(source), pin.before, 'every reviewed Web847 predecessor byte retained');
  return source;
}

// Additive map ownership only: the original nine scope objects retain every byte.
export function cmsCopyLocationsPredecessor(source) {
  if (sha(source) !== 'f417f769d7b3a12ab7e5cb55da4af5db822916c044f6e2e3e7691f1b2089b94b') return source;
  const locations = JSON.parse(source);
  delete locations.about;
  delete locations.toolsHub;
  const prior = JSON.stringify(locations) + '\n';
  assert.equal(sha(prior), 'f1f110371ce02eb8dfb9e20360b71795d2c55e105c1603c5d95d1f637f6a6e79');
  return prior;
}
