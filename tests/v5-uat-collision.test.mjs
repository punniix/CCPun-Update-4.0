import { ownerReviewSourcePins, ownerReviewSourcePredecessor, fullCountdownSourcePredecessor, oneRowCountdownSourcePredecessor } from '../qa/v5-owner-review-source-successor.mjs';
import {websiteV5InvestmentCopyPredecessor} from '../qa/website-v5-phase-a-proof.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {collisionSourcePins,collisionCssPredecessor} from '../qa/v5-uat-collision-source-successor.mjs';
const sha = text => createHash('sha256').update(text).digest('hex');
test('Collision CSS successor admits only the complete additive stylesheet and retains every original byte',()=>{
  for (const [file,pin] of Object.entries(collisionSourcePins)) {
    const raw=readFileSync(file,'utf8'),current=websiteV5InvestmentCopyPredecessor(file,ownerReviewSourcePredecessor(file,raw)),prior=collisionCssPredecessor(file,current);
    assert.equal(websiteV5InvestmentCopyPredecessor(file,raw+' '),raw+' ','unreviewed source is never admitted');
    assert.equal(sha(current),pin.after,file); assert.equal(sha(prior),pin.before,file);
    assert.equal(current,prior+pin.suffix,'Only the reviewed local CSS suffix was appended');
    assert.equal(collisionCssPredecessor(file,prior),prior);
    for (const mutation of [current+' ',current.replace(/\S/,'X'),current+pin.suffix,current.replace(pin.suffix,'')+pin.suffix+pin.suffix]) {
      assert.notEqual(mutation,current); assert.equal(collisionCssPredecessor(file,mutation),mutation,'Unknown source is never normalized');
    }
  }
  assert.equal(collisionCssPredecessor('unowned.css','body'),'body');
});


test('Owner review source inverses retain every prior byte and reject partial, duplicated or unrelated changes', () => {
  for (const [file, pin] of Object.entries(ownerReviewSourcePins)) {
    const source = fullCountdownSourcePredecessor(file, readFileSync(file, 'utf8'));
    assert.equal(sha(source), pin.after, file);
    const prior = ownerReviewSourcePredecessor(file, source);
    assert.equal(sha(prior), pin.before, file);
    assert.equal(ownerReviewSourcePredecessor(file, prior), prior);
    const [current, old] = pin.edits[0];
    for (const changed of [source + ' ', source.replace(/\S/, 'X'), source.replace(current, old), source.replace(current, current + current)]) {
      assert.notEqual(changed, source);
      assert.equal(ownerReviewSourcePredecessor(file, changed), changed, 'Unknown bytes are never normalized');
    }
  }
  assert.equal(ownerReviewSourcePredecessor('unowned.css', 'body'), 'body');
  const css = readFileSync('components/layout/v5/V5.module.css', 'utf8');
  assert.doesNotMatch(css, /\.articleCardBody[^{}]*\{[^}]*aspect-ratio:/, 'A text body never inherits an image ratio');
  assert.match(css, /:is\(\.cardGrid, \.cardGrid2\) > \.articleCard:only-child > \.articleCardBody, :is\(\.cardGrid, \.cardGrid2\) > :only-child > \.articleCard > \.articleCardBody \{ justify-content: center; padding: 24px 32px; \}/, 'Only lone card bodies receive the wide padding');
  assert.match(css, /\.articleCardImage:not\(img\) \{ aspect-ratio: 1200 \/ 630; \}/, 'Only missing-image placeholders reserve the standard ratio');
});


test('Full countdown action successor restores only the old hide block and refuses unrelated CSS', () => {
  const file = 'components/layout/v5/V5.module.css', source = readFileSync(file, 'utf8');
  const prior = fullCountdownSourcePredecessor(file, source);
  assert.notEqual(prior, source);
  assert.equal(sha(prior), ownerReviewSourcePins[file].after);
  assert.doesNotMatch(source, /\.countdownSlot :global\(\[data-campaign-action="line"\]\) \{ display: none; \}/);
  assert.match(source, /:global\(html\[data-v5-countdown-ended\]\) \.countdownSlot \{ display: none; \}/);
  for (const changed of [source+' ', source.replace('countdown-ended','countdown-altered'), source.replace('display: block','display: none')]) {
    assert.notEqual(changed, source);
    assert.equal(fullCountdownSourcePredecessor(file, changed), changed);
  }
  const timerFile = 'components/ui/health-happy/HealthHappyCountdown.module.css';
  const timer = readFileSync(timerFile, 'utf8');
  assert.equal(sha(fullCountdownSourcePredecessor(timerFile, timer)), ownerReviewSourcePins[timerFile].after);
  for (const changed of [timer+' ', timer.replace('repeat(4, minmax(0, 1fr))','repeat(3, minmax(0, 1fr))')]) {
    assert.notEqual(changed, timer);
    assert.equal(fullCountdownSourcePredecessor(timerFile, changed), changed);
  }
  assert.equal(fullCountdownSourcePredecessor('unowned.css', source), source);
});


test('Owner-approved countdown keeps four columns and rejects unreviewed mobile row/font changes', () => {
  const file = 'components/ui/health-happy/HealthHappyCountdown.module.css', source = readFileSync(file,'utf8');
  const prior = oneRowCountdownSourcePredecessor(file,source);
  assert.notEqual(prior,source);
  assert.equal(sha(prior),'bdf0ab886e7c3076913299ab605db68f9e11abd9838482ce26ea5149c9983fda');
  assert.match(source,/\.splitDigits \.timer \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(source,/\.splitDigits \.timer \{ grid-template-columns: repeat\(2/);
  assert.match(source,/font-size: clamp\(18px, 6vw, 24px\)/);
  for (const changed of [source+' ',source.replace('repeat(4, minmax(0, 1fr))','repeat(2, minmax(0, 1fr))'),source.replace('clamp(18px, 6vw, 24px)','clamp(12px, 6vw, 24px)')]) {
    assert.notEqual(changed,source);
    assert.equal(oneRowCountdownSourcePredecessor(file,changed),changed);
  }
  assert.equal(oneRowCountdownSourcePredecessor('unowned.css',source),source);
});
