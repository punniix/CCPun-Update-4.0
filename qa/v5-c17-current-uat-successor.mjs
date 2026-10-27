import {collisionCssPredecessor} from './v5-uat-collision-source-successor.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const sha = value => createHash('sha256').update(value).digest('hex');
const serialized = readFileSync(new URL('./v5-c17-current-uat-render-pins.json', import.meta.url), 'utf8');
assert.equal(sha(serialized), 'ea5dfb2674b727359043562bb04da62937bf6099ceab9056d05cea76d46f1c5f', 'Reviewed complete C17-on-C12-C16 render admission bytes');
export const c17CurrentUatPins = Object.freeze(JSON.parse(serialized));
// Only the complete reviewed integrated default output may lose the single label span.
// Unknown/CMS-edited output remains literal for the existing C15/C14/C11 guards to reject.
export function inverseC17OnCurrentUatHtml(html, key) {
  const pin = c17CurrentUatPins[String(key)];
  if (!pin || sha(html) !== pin.after || pin.after === pin.before) return html;
  const span = '<span class="triggerLabel">คุยกับปั้นทาง LINE</span>';
  assert.equal(html.split(span).length, 2, 'Exactly one unchanged label in its reviewed complete render');
  const prior = html.replace(span, 'คุยกับปั้นทาง LINE');
  assert.equal(sha(prior), pin.before, 'Reconstruct the complete previously accepted C12-C16 render');
  return prior;
}

// Peel only the two complete C17 calculator clearance insertions for C15's frozen source proof.
export function c17CurrentUatSourcePredecessor(file, source) {
  source = collisionCssPredecessor(file, source);
  if (file !== "components/layout/v5/V5Tool.module.css" || sha(source) !== "40bfbd86ebab9a382e6e148f03fd700ce297d0ea52157fa365264004aa0b8eb2") return source;
  for (const fragment of ["}\n/* C17b: reserve the tablet form's right edge for the fixed56px LINE corner control. */\n@media (min-width: 600px) and (max-width: 1023px) {\n  :global(:is(#ci-calculator, #fhc-calculator)) .calcScope { padding-right: 72px; }\n", "\n/* Keep only the first CI form description clear of the fixed mobile LINE control. */\n@media (max-width: 599px) {\n  :global(#ci-calculator) .calcScope :global(#ci-step-1-title) + p { padding-right: 40px; }\n}\n"]) {
    assert.equal(source.split(fragment).length, 2);
    source = source.replace(fragment, '');
  }
  assert.equal(sha(source), "b3a9423fc1020341f57b839d3a8530c5eaa32297d893318006e6d8f2336a8a80");
  return source;
}
