import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, extname } from "node:path";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
  encoding: "utf8",
}).split("\0").filter(Boolean).filter((file) => !file.startsWith("node_modules/"));
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const read = (file) => readFileSync(file, "utf8");
const sourceFiles = files.filter((file) => sourceExtensions.has(extname(file)));

for (const pointer of ["HANDOFF.md", "docs/current-work.md", "docs/architecture.md"]) {
  assert.ok(files.includes(pointer), `missing repository pointer: ${pointer}`);
}

const allowedTopLevelDirectories = new Set([
  ".agents", ".github", ".impeccable", ".qwen", ".windsurf", "app", "apps", "cms", "components",
  "db", "docs", "features", "hooks", "lib", "public", "qa", "scripts", "skills", "tests", "tools",
  "types", "workers",
]);
for (const directory of new Set(files.filter((file) => file.includes("/")).map((file) => file.split("/")[0]))) {
  assert.ok(allowedTopLevelDirectories.has(directory), `unexpected top-level directory: ${directory}`);
}

const applicationOwners = [...new Set(
  files
    .filter((file) => file.startsWith("apps/") && file.split("/").length > 2)
    .map((file) => file.split("/")[1]),
)].sort();
assert.deepEqual(applicationOwners, ["admin", "web"], "apps/ may contain only the locked Web and Admin application roots");
for (const owner of applicationOwners) {
  for (const requiredFile of ["package.json", "next.config.ts", "tsconfig.json", "app/layout.tsx"]) {
    assert.ok(files.includes(`apps/${owner}/${requiredFile}`), `missing ${owner} application boundary: ${requiredFile}`);
  }
}

assert.equal(
  files.some((file) => !file.includes("/") && /\.(?:gif|jpe?g|png|webp)$/i.test(file)),
  false,
  "runtime/debug images must not be added at the repository root",
);
assert.deepEqual(
  sourceFiles.filter((file) => dirname(file) === "components"),
  [],
  "shared components belong in components/layout or components/ui; feature components belong in features",
);

for (const directory of new Set(files.filter((file) => file.startsWith("features/")).map((file) => file.split("/")[1]))) {
  assert.match(directory, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `feature directory must use kebab-case: ${directory}`);
}

const rootLibAllowlist = new Set([
  "lib/acquisition.ts", "lib/analytics.ts", "lib/cookie-consent.ts", "lib/deployment-environment.ts",
  "lib/sanity-live.ts", "lib/security-policy.ts", "lib/utils.ts",
]);
for (const file of sourceFiles.filter((file) => dirname(file) === "lib")) {
  assert.ok(rootLibAllowlist.has(file), `new lib code needs a domain owner instead of root lib/: ${file}`);
}

for (const file of sourceFiles.filter((file) => file.startsWith("lib/"))) {
  const source = read(file);
  assert.doesNotMatch(source, /from\s+["']@\/(?:app|features)\//, `shared infrastructure cannot import routes/features: ${file}`);
}
for (const file of sourceFiles.filter((file) => file.startsWith("features/"))) {
  const owner = file.split("/")[1];
  for (const match of read(file).matchAll(/@\/features\/([^/'"]+)/g)) {
    assert.equal(match[1], owner, `cross-feature import from ${file} to ${match[1]}`);
  }
}

for (const file of sourceFiles) {
  assert.doesNotMatch(
    read(file),
    /SANITY_[A-Z0-9_]*READ_TOKEN\s*\|\|\s*process\.env\.SANITY_[A-Z0-9_]*WRITE_TOKEN/,
    `read credentials must never fall back to write credentials: ${file}`,
  );
}

assert.equal(read("lib/nav-config.json"), read("public/nav-config.json"), "public nav compatibility mirror drifted");

const editorialFiles = files.filter((file) => /^cms\/sanity\/schema\/(?:documents|objects)\/[^/]+\.ts$/.test(file));
const adminSchemaFiles = files.filter((file) => /^cms\/sanity\/admin\/schema\/[^/]+\.ts$/.test(file));
const schemaSources = [...editorialFiles, ...adminSchemaFiles].map((file) => [file, read(file)]);
const schemaTypeNames = schemaSources.flatMap(([file, source]) =>
  [...source.matchAll(/defineType\(\{\s*name:\s*["']([^"']+)["']/g)].map((match) => [match[1], file]),
);
const names = schemaTypeNames.map(([name]) => name);
for (const requiredName of [
  "article", "author", "category", "faqItem", "sourceReference", "reviewMetadata", "migrationSource",
  "seoMetadata", "geoMetadata", "imageWithAlt", "migratedImage", "tableRow", "simpleTable", "divider",
  "callout", "imageGallery", "ctaBlock", "pdfDownload", "detailsBlock", "portableText",
  "masterContent", "socialVariant", "socialCommentSeriesItem",
]) {
  assert.ok(names.includes(requiredName), `missing persisted Sanity schema type: ${requiredName}`);
}
for (const name of new Set(names)) {
  const owners = schemaTypeNames.filter(([candidate]) => candidate === name).map(([, file]) => file);
  assert.equal(owners.length, 1, `duplicate Sanity schema type ${name}: ${owners.join(", ")}`);
}
for (const file of editorialFiles) {
  assert.match(file.split("/").at(-1), /^(?:[a-z0-9]+-)*[a-z0-9]+\.ts$/, `Sanity schema file must use kebab-case: ${file}`);
  const count = (read(file).match(/defineType\(\{/g) ?? []).length;
  assert.ok(count <= (file.endsWith("/table.ts") ? 2 : 1), `split persisted schema types into focused files: ${file}`);
}

const article = read("cms/sanity/schema/documents/article.ts");
assert.match(article, /name:\s*["']slug["'][\s\S]*?readOnly:\s*\(\{ document \}\)\s*=>\s*Boolean\(document\?\.publishedAt\)/);
assert.match(article, /name:\s*["']category["'][\s\S]*?readOnly:\s*\(\{ document \}\)\s*=>\s*Boolean\(document\?\.publishedAt\)/);
assert.match(article, /isReservedArticleSlug/);
assert.match(article, /review\?\.status\s*===\s*["']approved["']/);
const seoMetadata = read("cms/sanity/schema/objects/seo-metadata.ts");
for (const field of ["canonical", "noindex"]) {
  assert.match(seoMetadata, new RegExp(`name:\\s*["']${field}["'][\\s\\S]*?readOnly:`), `${field} must remain protected`);
}

const studioPolicy = read("cms/sanity/policy/studio-policy.ts");
for (const requiredExport of [
  "filterStudioAuthProviders", "filterStudioDocumentActions", "protectProductionContentLifecycleActions",
  "filterStudioNewDocumentOptions", "filterStudioStructureItems",
]) {
  assert.match(studioPolicy, new RegExp(`export function ${requiredExport}\\b`), `Studio policy export missing: ${requiredExport}`);
}
const sanityConfig = read("sanity.config.ts");
assert.match(sanityConfig, /isStudioDataPlaneAllowed/);
assert.match(sanityConfig, /resolveSanityConfigEnvironment/);
assert.match(sanityConfig, /createStudioPresentationPlugin/);
assert.match(sanityConfig, /createStudioStructurePlugin/);
assert.doesNotMatch(read("cms/sanity/schema/index.ts"), /defineType\(/, "schema index must remain composition-only");

console.log(`Repository architecture contract passed (${files.length} files, ${names.length} Sanity schema types).`);