import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadFixtureModule } from "../../qa/phase1-fixture-loader.mjs";
import {
  articleBelongsToPhysicalCategory,
  buildCategoryRegistry,
  getCategoryCanonical,
  listCategoryMenuEntries,
  listPhysicalCategorySitemapEntries,
  loadCategoryRegistrySafe,
  parseCategoryRegistryResponse,
  resolveCategoryRoute,
  type RawCategoryRegistryRow,
} from "../../lib/content/category-registry";
import { isArticleInSemanticTopic } from "../../lib/content/taxonomy";

const productionSix: RawCategoryRegistryRow[] = [
  { _id: "category-personal-finance", title: "การเงินส่วนบุคคล", slug: "personal-finance", status: "active" },
  { _id: "category-life-insurance", title: "ประกันชีวิต", slug: "life-insurance", status: "active" },
  { _id: "category-health-insurance", title: "ประกันสุขภาพ", slug: "health-insurance", status: "active" },
  { _id: "category-investment", title: "การลงทุน", slug: "investment", status: "active" },
  { _id: "category-motor-insurance", title: "ประกันรถยนต์", slug: "motor-insurance", status: "active" },
  { _id: "category-critical-illness-insurance", title: "ประกันโรคร้ายแรง", slug: "critical-illness-insurance", status: "active" },
];

test("six current Production categories form the active physical registry", () => {
  const registry = buildCategoryRegistry(productionSix);
  assert.deepEqual(registry.active.map(({ slug }) => slug).sort(), [
    "critical-illness-insurance",
    "health-insurance",
    "investment",
    "life-insurance",
    "motor-insurance",
    "personal-finance",
  ]);
  assert.equal(resolveCategoryRoute(registry, "motor-insurance", { includeDrafts: false }).kind, "category");
});

test("draft category is hidden publicly but visible/noindex in preview and activation needs no code change", () => {
  const rows = [...productionSix, { _id: "travel", title: "ประกันเดินทาง", slug: "travel-insurance", status: "draft" }];
  const draftRegistry = buildCategoryRegistry(rows);
  assert.equal(resolveCategoryRoute(draftRegistry, "travel-insurance", { includeDrafts: false }).kind, "hidden");
  assert.deepEqual(resolveCategoryRoute(draftRegistry, "travel-insurance", { includeDrafts: true }), {
    kind: "category",
    category: draftRegistry.entries.find(({ slug }) => slug === "travel-insurance"),
    noindex: true,
  });
  assert.equal(listCategoryMenuEntries(draftRegistry, false).some(({ slug }) => slug === "travel-insurance"), false);
  assert.equal(listCategoryMenuEntries(draftRegistry, true).some(({ slug }) => slug === "travel-insurance"), true);

  const activeRegistry = buildCategoryRegistry(rows.map((row) => row._id === "travel" ? { ...row, status: "active" } : row));
  assert.equal(listCategoryMenuEntries(activeRegistry, false).some(({ slug }) => slug === "travel-insurance"), true);
});

test("deactivation of a referenced public category requires a direct redirect guard", () => {
  const unsafe = buildCategoryRegistry(
    [{ _id: "travel", title: "ประกันเดินทาง", slug: "travel-insurance", status: "draft" }],
    { referencedCategoryIds: ["travel"] },
  );
  assert.ok(unsafe.issues.some((issue) => issue.code === "deactivation-without-redirect"));
  assert.equal(unsafe.entries.length, 0);

  const safe = buildCategoryRegistry([
    { _id: "travel", title: "ประกันเดินทาง", slug: "travel-insurance", status: "draft", redirectToId: "motor", redirectToSlug: "motor-insurance" },
    { _id: "motor", title: "ประกันรถยนต์", slug: "motor-insurance", status: "active" },
  ], { referencedCategoryIds: ["travel"] });
  assert.deepEqual(resolveCategoryRoute(safe, "travel-insurance", { includeDrafts: false }), {
    kind: "redirect",
    destinationSlug: "motor-insurance",
  });
});

test("published and draft variants of the same logical category are not treated as duplicate slugs", () => {
  const registry = buildCategoryRegistry([
    { _id: "category-personal-finance", title: "การเงินส่วนบุคคล", slug: "personal-finance", status: "active", description: "Live" },
    { _id: "drafts.category-personal-finance", title: "การเงินส่วนบุคคล", slug: "personal-finance", status: "active", description: "Draft current" },
  ]);

  assert.equal(registry.issues.some((issue) => issue.code === "duplicate-slug"), false);
  assert.equal(registry.entries.length, 1);
  assert.equal(registry.entries[0]?.id, "category-personal-finance");
  assert.equal(registry.entries[0]?.description, "Draft current");
});

test("category registry preserves curated featured article order", () => {
  const registry = buildCategoryRegistry([
    {
      _id: "category-health-insurance",
      title: "ประกันสุขภาพ",
      slug: "health-insurance",
      status: "active",
      featuredArticleIds: ["article-third", "article-first", "article-second"],
    },
  ]);

  assert.deepEqual(registry.entries[0]?.featuredArticleIds, [
    "article-third",
    "article-first",
    "article-second",
  ]);
});

test("slug format, duplicate slug, route collision and canonical collision isolate only unsafe rows", () => {
  const registry = buildCategoryRegistry([
    { _id: "good", title: "ดี", slug: "good-category", status: "active" },
    { _id: "invalid", title: "Invalid", slug: "Bad Slug", status: "active" },
    { _id: "dup-a", title: "A", slug: "duplicate", status: "active" },
    { _id: "dup-b", title: "B", slug: "duplicate", status: "active" },
    { _id: "route", title: "Route", slug: "article-owner", status: "active" },
    { _id: "canonical", title: "Canonical", slug: "canonical-owner", status: "active" },
  ], {
    routeOwnerSlugs: ["article-owner"],
    canonicalOwnerUrls: [getCategoryCanonical("canonical-owner")],
  });

  assert.deepEqual(registry.active.map(({ slug }) => slug), ["good-category"]);
  assert.ok(registry.issues.some((issue) => issue.id === "invalid" && issue.code === "invalid-record"));
  assert.equal(registry.issues.filter((issue) => issue.code === "duplicate-slug").length, 2);
  assert.ok(registry.issues.some((issue) => issue.code === "route-collision"));
  assert.ok(registry.issues.some((issue) => issue.code === "canonical-collision"));
});

test("redirect self, chain and multi-node loop are rejected while a direct active target is safe", () => {
  const unsafe = buildCategoryRegistry([
    { _id: "self", title: "Self", slug: "self", status: "draft", redirectToId: "self", redirectToSlug: "self" },
    { _id: "a", title: "A", slug: "a", status: "draft", redirectToId: "b", redirectToSlug: "b" },
    { _id: "b", title: "B", slug: "b", status: "draft", redirectToId: "a", redirectToSlug: "a" },
  ]);
  assert.ok(unsafe.issues.some((issue) => issue.code === "redirect-self"));
  assert.ok(unsafe.issues.some((issue) => issue.code === "redirect-loop"));
  assert.ok(unsafe.issues.some((issue) => issue.code === "redirect-chain"));

  const safe = buildCategoryRegistry([
    { _id: "old", title: "Old", slug: "old", status: "draft", redirectToId: "final", redirectToSlug: "final" },
    { _id: "final", title: "Final", slug: "final", status: "active" },
  ]);
  assert.equal(safe.issues.length, 0);
  assert.deepEqual(resolveCategoryRoute(safe, "old", { includeDrafts: false }), { kind: "redirect", destinationSlug: "final" });
});

test("one malformed category and registry request failure fail soft", async () => {
  const registry = buildCategoryRegistry([
    ...productionSix,
    { _id: "broken", title: "Broken", slug: "broken", status: "wrong" },
  ]);
  assert.equal(registry.active.length, 6);
  assert.ok(registry.issues.some((issue) => issue.id === "broken" && issue.code === "invalid-record"));

  const unavailable = await loadCategoryRegistrySafe(async () => { throw new Error("Sanity unavailable"); });
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.entries.length, 0);
  assert.deepEqual(resolveCategoryRoute(unavailable, "health-insurance", { includeDrafts: false }), { kind: "unavailable" });
});

test("registry envelope must include all collision inputs before categories become available", () => {
  const valid = {
    categories: productionSix,
    routeOwnerSlugs: [],
    canonicalOwnerUrls: [],
    referencedCategoryIds: [],
  };
  const parsed = parseCategoryRegistryResponse(valid);
  assert.equal(buildCategoryRegistry(parsed.rows, parsed.context).active.length, 6);
  for (const broken of [null, {}, { ...valid, categories: null }, { ...valid, routeOwnerSlugs: null }, { ...valid, canonicalOwnerUrls: [42] }]) {
    assert.throws(() => parseCategoryRegistryResponse(broken));
  }
});

test("physical category filtering is independent from semantic topic filtering", () => {
  const health = buildCategoryRegistry(productionSix).active.find(({ slug }) => slug === "health-insurance")!;
  const lifeArticle = {
    articleSlug: "life-with-health-tag",
    categoryTitle: "ประกันชีวิต",
    categorySlug: "life-insurance",
    tags: ["ประกันสุขภาพ"],
  };
  assert.equal(articleBelongsToPhysicalCategory(lifeArticle, health), false);
  assert.equal(isArticleInSemanticTopic(lifeArticle, "health-insurance"), true);
});

test("physical sitemap entries include active categories with indexable articles only", () => {
  const registry = buildCategoryRegistry([
    ...productionSix,
    { _id: "travel", title: "ประกันเดินทาง", slug: "travel-insurance", status: "draft" },
  ]);
  const entries = listPhysicalCategorySitemapEntries(registry, [
    { categorySlug: "motor-insurance" },
    { categorySlug: "travel-insurance" },
  ]);
  assert.deepEqual(entries, [{ loc: "https://ccpun.com/blog/motor-insurance/" }]);
});

test("travel-insurance lifecycle: draft -> active -> safe deactivate/redirect", () => {
  const draft = buildCategoryRegistry([
    ...productionSix,
    { _id: "travel", title: "ประกันเดินทาง", slug: "travel-insurance", status: "draft" },
  ]);
  assert.equal(resolveCategoryRoute(draft, "travel-insurance", { includeDrafts: false }).kind, "hidden");

  const active = buildCategoryRegistry([
    ...productionSix,
    { _id: "travel", title: "ประกันเดินทาง", slug: "travel-insurance", status: "active" },
  ]);
  assert.equal(resolveCategoryRoute(active, "travel-insurance", { includeDrafts: false }).kind, "category");

  const deactivated = buildCategoryRegistry([
    ...productionSix,
    { _id: "travel", title: "ประกันเดินทาง", slug: "travel-insurance", status: "draft", redirectToId: "category-motor-insurance", redirectToSlug: "motor-insurance" },
  ], { referencedCategoryIds: ["travel"] });
  assert.deepEqual(resolveCategoryRoute(deactivated, "travel-insurance", { includeDrafts: false }), {
    kind: "redirect",
    destinationSlug: "motor-insurance",
  });
});

function categoryMigrationFixture(options: { missingRevision?: boolean; concurrentEdit?: boolean; pending?: boolean; noChanges?: boolean; dryRun?: boolean } = {}) {
  const file = "scripts/migrate-category-registry.ts";
  const source = readFileSync(file, "utf8");
  const marker = '\nmain().catch((error) => {';
  assert.equal(source.split(marker).length, 2);
  const docs: Array<{ _id: string; _type: string; _rev?: string; title: string; slug: { current: string }; status: string; description: string }> = [
    { _id: "category-personal", _type: "category", _rev: "read-rev-1", title: "การเงินส่วนบุคคล", slug: { current: "personal-finance" }, status: options.noChanges ? "active" : "draft", description: "Existing description" },
    { _id: "category-motor", _type: "category", _rev: "read-rev-motor", title: "ประกันรถยนต์", slug: { current: "motor-insurance" }, status: "active", description: "Motor description" },
  ];
  if (options.missingRevision) delete docs[0]!._rev;
  const operations: Array<{ id: string; patch: { ifRevisionID?: string; set: { status: string } } }> = [];
  let transactionCount = 0, commitCount = 0, pendingChecks = 0;
  const tx = {
    patch(id: string, patch: { ifRevisionID?: string; set: { status: string } }) { operations.push({ id, patch }); return tx; },
    createIfNotExists() { throw new Error("UNEXPECTED_CREATE"); },
    async commit() {
      commitCount += 1;
      if (options.concurrentEdit) { docs[0]!._rev = "concurrent-rev"; docs[0]!.description = "Concurrent editor value"; }
      // Sanity applies the complete transaction only when all revision preconditions match.
      for (const operation of operations) if (docs.find(doc => doc._id === operation.id)?._rev !== operation.patch.ifRevisionID) throw new Error("REVISION_CONFLICT");
      for (const operation of operations) Object.assign(docs.find(doc => doc._id === operation.id)!, operation.patch.set, { _rev: "committed-rev" });
    },
  };
  const client = {
    config: () => ({ projectId: "ccb9lnw5", dataset: "uat" }),
    withConfig() { return client; },
    async fetch(query: string) { return query.startsWith('*[_type == "category"]') ? structuredClone(docs) : []; },
    transaction() { transactionCount += 1; return tx; },
  };
  const { main } = loadFixtureModule(file, {
    // Disable only the process entry in this in-memory fixture; actual main, lane,
    // plan, transaction and readback code execute unchanged.
    sources: new Map([[file, source.split(marker)[0] + '\nexport { main };\n']]),
    mocks: new Map<string, unknown>([
      ["sanity/cli", { getCliClient: () => client }],
      ["@sanity/client", { createClient() { throw new Error("UNEXPECTED_PRODUCTION_READ"); } }],
      ["@/scripts/admin-operations-audit", { async assertNoPendingScriptAdminAudit() {
        pendingChecks += 1;
        if (options.pending) throw new Error("UAT_TAXONOMY_RECONCILIATION_REQUIRED");
      } }],
    ]),
    globals: { process: { env: { CCPUN_APP_ENV: "local-uat" },
      argv: ["node", file, "--target=uat", options.dryRun ? "--dry-run" : "--apply", "--confirm=CCPUN-CATEGORY-REGISTRY-UAT"],
      exit(code: number) { throw new Error(`FIXTURE_EXIT_${code}`); } }, console: { log() {} } },
  });
  return { run: () => main(), docs, operations, state: () => ({ transactionCount, commitCount, pendingChecks }) };
}

test("registry migration status writes bind the exact fetched revision and retain identity/content", async () => {
  const fixture = categoryMigrationFixture();
  await fixture.run();
  assert.deepEqual(fixture.operations, [{ id: "category-personal", patch: { ifRevisionID: "read-rev-1", set: { status: "active" } } }]);
  assert.equal(fixture.docs[0]!.description, "Existing description");
  assert.equal(fixture.docs[0]!.status, "active");
  assert.deepEqual(fixture.state(), { transactionCount: 1, commitCount: 1, pendingChecks: 1 });
});

test("registry migration refuses missing revision before transaction and a concurrent edit cannot be overwritten", async () => {
  const missing = categoryMigrationFixture({ missingRevision: true });
  await assert.rejects(missing.run(), /revision is required/);
  assert.deepEqual(missing.state(), { transactionCount: 0, commitCount: 0, pendingChecks: 0 });
  const concurrent = categoryMigrationFixture({ concurrentEdit: true });
  await assert.rejects(concurrent.run(), /REVISION_CONFLICT/);
  assert.equal(concurrent.docs[0]!.status, "draft");
  assert.equal(concurrent.docs[0]!.description, "Concurrent editor value");
  assert.equal(concurrent.state().commitCount, 1, "no automatic provider retry");
});

test("registry UAT apply checks unresolved taxonomy intents even for no changes, while dry-run stays mutation-free", async () => {
  for (const noChanges of [false, true]) {
    const fixture = categoryMigrationFixture({ pending: true, noChanges });
    await assert.rejects(fixture.run(), /UAT_TAXONOMY_RECONCILIATION_REQUIRED/);
    assert.deepEqual(fixture.state(), { transactionCount: 0, commitCount: 0, pendingChecks: 1 });
  }
  const dry = categoryMigrationFixture({ pending: true, dryRun: true });
  await assert.rejects(dry.run(), /FIXTURE_EXIT_0/);
  assert.deepEqual(dry.state(), { transactionCount: 0, commitCount: 0, pendingChecks: 0 });
});
