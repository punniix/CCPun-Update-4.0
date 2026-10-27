import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {collisionSourcePins,collisionCssPredecessor} from '../qa/v5-uat-collision-source-successor.mjs';
const sha = text => createHash('sha256').update(text).digest('hex');
test('Collision CSS successor admits only the complete additive stylesheet and retains every original byte',()=>{
  for (const [file,pin] of Object.entries(collisionSourcePins)) {
    const current=readFileSync(file,'utf8'),prior=collisionCssPredecessor(file,current);
    assert.equal(sha(current),pin.after,file); assert.equal(sha(prior),pin.before,file);
    assert.equal(current,prior+pin.suffix,'Only the reviewed local CSS suffix was appended');
    assert.equal(collisionCssPredecessor(file,prior),prior);
    for (const mutation of [current+' ',current.replace(/\S/,'X'),current+pin.suffix,current.replace(pin.suffix,'')+pin.suffix+pin.suffix]) {
      assert.notEqual(mutation,current); assert.equal(collisionCssPredecessor(file,mutation),mutation,'Unknown source is never normalized');
    }
  }
  assert.equal(collisionCssPredecessor('unowned.css','body'),'body');
});
