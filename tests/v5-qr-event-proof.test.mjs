import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { qrEventSource, qrEventPredecessor } from '../qa/v5-qr-event-proof.mjs';
import { websiteV5PredecessorDigest, isWebsiteV5ReviewedSuccessor } from '../qa/website-v5-phase-a-proof.mjs';
const source = readFileSync(qrEventSource.file, 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
test('C12 QR tracking reconstructs only the exact reviewed predecessor and preserves frozen pins', () => {
  assert.equal(qrEventSource.before, '534030c0144dd78e4c506a2c446d39c0746bda0cfc24ef6de1ccdb5d8be7dc67');
  assert.equal(sha(qrEventPredecessor(qrEventSource.file, source)), qrEventSource.before);
  assert.equal(isWebsiteV5ReviewedSuccessor(qrEventSource.file, source), true);
  assert.equal(websiteV5PredecessorDigest(qrEventSource.file, source), '4176646b29ae2614cc044fef35d9be7cdffe8cfb303c8519f86fe71c148cd90f');
  for (const mutation of [source + '\n// unrelated drift', source.replace("meta: 'none'", "meta: 'custom'"), source.replace("topic: new Set([", "topic: new Set(['unapproved', ")]) {
    assert.equal(qrEventPredecessor(qrEventSource.file, mutation), mutation);
    assert.equal(isWebsiteV5ReviewedSuccessor(qrEventSource.file, mutation), false);
  }
  assert.equal(qrEventPredecessor('lib/cookie-consent.ts', source), source);
});
