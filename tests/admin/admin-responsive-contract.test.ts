import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

test("Admin layout contains wide content without widening the mobile viewport", () => {
  const layout = readSource("app/(control-plane)/layout.tsx");

  assert.match(layout, /<div className="[^"]*\boverflow-x-hidden\b[^"]*">/);
  assert.match(layout, /grid-cols-\[minmax\(0,1fr\)\]/);
  assert.match(layout, /lg:grid-cols-\[220px_minmax\(0,1fr\)\]/);
  assert.match(layout, /<aside className="[^"]*\bmin-w-0\b/);
  assert.match(layout, /<main[^>]*className="[^"]*\bmin-w-0\b/);
});

test("Admin data tables remain horizontally scrollable inside labelled regions", () => {
  const tablePages = [
    "app/(control-plane)/content/articles/page.tsx",
    "app/(control-plane)/seo/page.tsx",
    "features/admin/research/page.tsx",
    "app/(control-plane)/operations/audit-log/page.tsx",
  ];

  for (const page of tablePages) {
    const source = readSource(page);
    assert.match(source, /role="region"[^>]*className="overflow-x-auto"/, page);
  }
});

test("Research workflow links keep a 44px mobile touch target", () => {
  const research = readSource("features/admin/research/page.tsx");

  assert.match(research, /<a key=\{href\} href=\{href\} className="[^"]*\bmin-h-11\b[^"]*\bitems-center\b/);
});
