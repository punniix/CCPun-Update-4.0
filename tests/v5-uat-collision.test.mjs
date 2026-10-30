import { ownerReviewVisualSourcePredecessor, visualLocationsPredecessor } from "../qa/v5-owner-review-source-successor.mjs";
import { aboutToolsLayoutPins, aboutToolsLayoutPredecessor, ownerReviewLocationsPredecessor, ownerReviewStoryV2SourcePredecessor } from '../qa/v5-owner-review-source-successor.mjs';
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
    const source = fullCountdownSourcePredecessor(file, ownerReviewVisualSourcePredecessor(file, readFileSync(file, 'utf8')));
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

// Native parity admission accepts the complete two-file patch only, never a partial or unknown variant.
test('About and Tools layout inverses preserve the complete prior CSS and reject unknown or partial edits', () => {
  for (const [file, pin] of Object.entries(aboutToolsLayoutPins)) {
    const current = readFileSync(file, 'utf8');
    const source = ownerReviewStoryV2SourcePredecessor(file, current);
    if (current !== source) {
      assert.equal(ownerReviewStoryV2SourcePredecessor(file, current + ' '), current + ' ', 'Unknown About changes cannot be normalized');
    }
    assert.equal(sha(source), pin.after, file);
    const prior = aboutToolsLayoutPredecessor(file, source);
    assert.equal(sha(prior), pin.before, file);
    assert.equal(aboutToolsLayoutPredecessor(file, prior), prior);
    for (const [current, old] of pin.edits) {
      for (const mutation of [source + ' ', source.replace(/\S/, 'X'), source.replace(current, old), source.replace(current, current + current)]) {
        assert.notEqual(mutation, source);
        assert.equal(aboutToolsLayoutPredecessor(file, mutation), mutation, 'Unknown, partial or duplicate layout bytes are not admitted');
      }
    }
  }
  assert.equal(aboutToolsLayoutPredecessor('unowned.css', 'body'), 'body');
});

test('About helper metadata reorder retains all existing fields and rejects partial or unknown map bytes', () => {
  const source = visualLocationsPredecessor(readFileSync('lib/content/public-copy-locations.json', 'utf8'));
  assert.equal(sha(source), '7cfa3100a07771cb4e3c946c25a651ad57b7653b76f0c795990273af9eadaa30', 'Exact Story V2 successor map with eight reviewed copy fields');
  const map = JSON.parse(source);
  assert.equal(Object.keys(map).length, 11);
  assert.equal(Object.values(map).reduce((n, scope) => n + Object.keys(scope.entries).length, 0), 1823);
  assert.equal(sha(ownerReviewLocationsPredecessor(source)), '41ac751407cc2c2d5556db517d40ba7243363b81d02ac56eed73ae345ab96bc0');
  const partial = JSON.parse(source); partial.home.entries['home.p6'].order = 81;
  const missing = JSON.parse(source); delete missing.home.entries['home.p6'];
  for (const mutation of [source + ' ', JSON.stringify(partial) + '\n', JSON.stringify(missing) + '\n', source.replace('"home":{', '"home":{},"home":{')]) {
    assert.notEqual(mutation, source);
    assert.equal(ownerReviewLocationsPredecessor(mutation), mutation, 'No unknown/partial/duplicate map is admitted');
  }
});
