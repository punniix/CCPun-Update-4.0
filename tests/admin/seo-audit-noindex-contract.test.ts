import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("SEO audit follows the publication noindex contract without hiding live noindex", () => {
  const publication = readFileSync("cms/sanity/policy/article-publication.ts", "utf8");
  const audit = readFileSync("lib/admin/seo-audit.ts", "utf8");

  assert.match(publication, /\{ \.\.\.draft\.seo, noindex: false \}/);
  assert.match(audit, /const draftWillPublishIndexable = article\.id\.startsWith\("drafts\."\)/);
  assert.match(audit, /passed: draftWillPublishIndexable \|\| seo\.noindex !== true/);
  assert.match(audit, /Draft noindex=true; CCPun Publish workflow จะบังคับ Live เป็น false/);
  assert.match(audit, /Live noindex=true/);
});
