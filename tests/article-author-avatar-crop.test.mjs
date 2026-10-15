import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../components/layout/website-43/Website43.module.css', import.meta.url), 'utf8');

// The fallback author portrait is 2:3; a centered square crop cuts off the top of the head.
test('article author portraits keep the top of the head within the circle', () => {
  const rule = styles.match(/\.authorAvatar\s*\{([^}]*)\}/)?.[1];
  assert.ok(rule, 'author avatar rule exists');
  assert.match(rule, /object-fit:\s*cover\s*;/);
  assert.match(rule, /object-position:\s*center top\s*;/);
  assert.match(rule, /border-radius:\s*999px\s*;/);
  assert.match(rule, /border:\s*1px solid rgba\(224,201,133,\.4\)\s*;/);
  assert.match(styles, /\.authorAvatar\s*\{\s*grid-row:\s*auto;\s*width:\s*72px;\s*height:\s*72px;\s*\}/);
});
