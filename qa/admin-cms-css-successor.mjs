import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
// The text preview reuses the reviewed v5 renderers. Six unused Tailwind utility
// blocks and one audited unused compatibility rule leave the old Root/Web outputs; all other bytes stay identical.
export const previewRemovedUtilityTokens = Object.freeze(['mb-4', 'w-1.5', 'w-36', 'basis-40', 'divide-border/20', 'not-italic']);
export const previewRetiredCompatClass = "section-divider";
export const adminPreviewCompilerPins = Object.freeze({
  "root": {
    "before": "67638ca5fa86d3698aca48ee320f7e9eb3652b307d2b7bfc6febf82e4f5e3cb4",
    "after": "0d7b953540af0ecdcd6d8b8e52db43030267685188353a006405734d17041ddf",
    "edits": [
      [
        10005,
        "",
        "  .mb-4 {\n    margin-bottom: calc(var(--spacing) * 4);\n  }\n"
      ],
      [
        13852,
        "",
        "  .w-1\\.5 {\n    width: calc(var(--spacing) * 1.5);\n  }\n"
      ],
      [
        14672,
        "",
        "  }\n  .w-36 {\n    width: calc(var(--spacing) * 36);\n"
      ],
      [
        16859,
        "",
        "  }\n  .basis-40 {\n    flex-basis: calc(var(--spacing) * 40);\n"
      ],
      [
        22918,
        "",
        "    }\n  }\n  .divide-border\\/20 {\n    :where(& > :not(:last-child)) {\n      border-color: hsl(var(--border));\n      @supports (color: color-mix(in lab, red, red)) {\n        border-color: color-mix(in oklab, hsl(var(--border)) 20%, transparent);\n      }\n"
      ],
      [
        77523,
        "",
        "  .not-italic {\n    font-style: normal;\n  }\n"
      ],
      [
        120670,
        "",
        "  .section-divider {\n    margin-inline: auto;\n    height: calc(var(--spacing) * 1);\n    width: calc(var(--spacing) * 20);\n    border-radius: calc(infinity * 1px);\n    background: linear-gradient(90deg, transparent, hsl(42,50%,55%), transparent);\n  }\n"
      ]
    ]
  },
  "web": {
    "before": "251ccb344a8056f190916ad06eb9a806b72affa352a3398cd72247842e6a23db",
    "after": "75773b5eb056e8ac1482e435963c8c8787fdd4ad50b797b4c1ce703c5c524c09",
    "edits": [
      [
        9480,
        "",
        "  .mb-4 {\n    margin-bottom: calc(var(--spacing) * 4);\n  }\n"
      ],
      [
        13122,
        "",
        "  .w-1\\.5 {\n    width: calc(var(--spacing) * 1.5);\n  }\n"
      ],
      [
        13942,
        "",
        "  }\n  .w-36 {\n    width: calc(var(--spacing) * 36);\n"
      ],
      [
        16073,
        "",
        "  }\n  .basis-40 {\n    flex-basis: calc(var(--spacing) * 40);\n"
      ],
      [
        22020,
        "",
        "    }\n  }\n  .divide-border\\/20 {\n    :where(& > :not(:last-child)) {\n      border-color: hsl(var(--border));\n      @supports (color: color-mix(in lab, red, red)) {\n        border-color: color-mix(in oklab, hsl(var(--border)) 20%, transparent);\n      }\n"
      ],
      [
        75385,
        "",
        "  .not-italic {\n    font-style: normal;\n  }\n"
      ],
      [
        114294,
        "",
        "  .section-divider {\n    margin-inline: auto;\n    height: calc(var(--spacing) * 1);\n    width: calc(var(--spacing) * 20);\n    border-radius: calc(infinity * 1px);\n    background: linear-gradient(90deg, transparent, hsl(42,50%,55%), transparent);\n  }\n"
      ]
    ]
  }
});
export function adminPreviewCompilerPredecessor(context, css) {
  const pin = Object.hasOwn(adminPreviewCompilerPins, context) ? adminPreviewCompilerPins[context] : null;
  if (!pin || sha(css) !== pin.after) return css;
  for (const [offset, current, prior] of [...pin.edits].reverse()) {
    assert.equal(css.slice(offset, offset + current.length), current, 'exact reviewed utility delta');
    css = css.slice(0, offset) + prior + css.slice(offset + current.length);
  }
  assert.equal(sha(css), pin.before, 'all original compiled declarations and order reconstructed');
  return css;
}
