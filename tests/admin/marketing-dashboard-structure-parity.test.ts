import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Marketing Dashboard presentation split preserves every original statement and JSX token", () => {
  // Captured from Admin UAT 75d30352; no history fetch is required in shallow CI.
  const statements: string[] = [];
  for (const path of [
    "features/admin/social/SocialMarketingDashboard.tsx",
    "features/admin/social/MarketingDashboardVisuals.tsx",
    "features/admin/social/MarketingDashboardOverview.tsx",
  ]) {
    const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement) || ts.isExpressionStatement(statement)) continue;
      const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.JSX,
        statement.getText(source).replace(/^(?:export\s+)?(?:default\s+)?/, ""));
      const tokens: string[] = [];
      while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) tokens.push(scanner.getTokenText());
      statements.push(tokens.join("\0"));
    }
  }
  assert.equal(createHash("sha256").update(statements.sort().join("\n")).digest("hex"),
    "a7b0fc27c9630bc9d246f221165ffbbc8f0523cbfa8eafc2f01337c2f42fb2ae");
});

test("Shared CSS cleanup preserves the remaining declarations and their cascade order", () => {
  // Production-equivalent baseline projected only the nine traced inactive nodes.
  for (const [path, expected] of [
    ["components/styles/public-compat.css", "61d66ca2e05ba044c360cfb8e5927bbe1175b52a02ca46884a9b9a28d4e0ee9c"],
    ["components/styles/public-motion.css", "43219cc22c110351f609c72a5cf73eed620d7da2eab7698924266b8ca4461aa3"],
  ]) {
    const source = read(path).replace(/\n{3,}/g, "\n\n").trim();
    assert.equal(createHash("sha256").update(source).digest("hex"), expected, path);
  }
});
