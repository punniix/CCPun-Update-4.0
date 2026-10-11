import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const toc = readFileSync('features/blog/website-43/Website43ArticleToc.tsx', 'utf8');

test('separate desktop and mobile article TOCs cannot reuse aria-controls IDs', () => {
  assert.match(toc, /import \{ useId, useState \} from 'react';/);
  assert.match(toc, /const instanceId = useId\(\);/);
  assert.match(toc, /const sublistId = `\$\{instanceId\}-toc-children-\$\{group\.primary\.id\}`;/);
  assert.match(toc, /aria-controls=\{sublistId\}/);
  assert.match(toc, /id=\{sublistId\}/);
});
