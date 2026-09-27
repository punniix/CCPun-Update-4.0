import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../lib/admin/seo-audit.ts", import.meta.url), "utf8");

test("SEO audit keeps its governed schema inline and accepts legacy null markDefs", () => {
  assert.match(
    source,
    /markDefs: z\.array\(markDefSchema\)\.nullish\(\)\.transform\(\(value\) => value \?\? \[\]\)/,
  );
  assert.match(
    source,
    /faqQuestions: z\.array\(z\.string\(\)\)\.nullish\(\)\.transform\(\(value\) => value \?\? \[\]\)/,
  );
  assert.doesNotMatch(source, /markDefs: z\.array\(markDefSchema\)\.optional\(\)/);
});
