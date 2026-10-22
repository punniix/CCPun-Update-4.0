import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { loadFixtureModule } from "../../qa/phase1-fixture-loader.mjs";
import { parse, evaluate } from "groq-js";
import { fileURLToPath } from "node:url";
import {
  applyTaxonomyMigration,
  buildTaxonomyMigrationPlan,
  logicalArticleId,
  validateUatTaxonomyEnvironment,
  type RawArticle,
  type RawCategory,
  type TransactionClient,
} from "../../scripts/migrate-uat-taxonomy";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lifeCategory: RawCategory = {
  _id: "ccpun-wp-category-4",
  _type: "category",
  title: "ประกันชีวิต",
  slug: "life-insurance",
};

const uatEnvironment = {
  CCPUN_APP_ENV: "local-uat",
  SANITY_API_PROJECT_ID: "ccb9lnw5",
  SANITY_API_DATASET: "uat",
};

test("taxonomy migration accepts only the explicit isolated UAT data plane", () => {
  assert.deepEqual(validateUatTaxonomyEnvironment(uatEnvironment), {
    appEnvironment: "local-uat",
    projectId: "ccb9lnw5",
    dataset: "uat",
    readToken: undefined,
    writeToken: undefined,
  });
  for (const appEnvironment of ["development", "lab", "uat"]) {
    assert.equal(validateUatTaxonomyEnvironment({ ...uatEnvironment, CCPUN_APP_ENV: appEnvironment }).appEnvironment, appEnvironment);
  }

  for (const environment of [
    { ...uatEnvironment, CCPUN_APP_ENV: undefined },
    { ...uatEnvironment, CCPUN_APP_ENV: "production" },
    { ...uatEnvironment, SANITY_API_PROJECT_ID: undefined },
    { ...uatEnvironment, SANITY_API_PROJECT_ID: "kyfxgjnq" },
    { ...uatEnvironment, SANITY_API_DATASET: undefined },
    { ...uatEnvironment, SANITY_API_DATASET: "production" },
    { ...uatEnvironment, NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq" },
    { ...uatEnvironment, NEXT_PUBLIC_SANITY_DATASET: "production" },
  ]) {
    assert.throws(() => validateUatTaxonomyEnvironment(environment), /Refusing taxonomy migration/);
  }
});

test("draft and published variants resolve to one logical article and only the Draft changes", () => {
  const articles: RawArticle[] = [
    {
      _id: "drafts.article-1",
      _rev: "draft-rev-1",
      _type: "article",
      category: {
        _ref: "legacy-health",
        title: "ประกันสุขภาพและโรคร้ายแรง",
        slug: "health-insurance",
      },
      tags: [" Existing ", "existing", "ประกันสุขภาพ"],
    },
    {
      _id: "article-1",
      _rev: "published-rev-1",
      _type: "article",
      category: {
        _ref: "legacy-health",
        title: "ประกันสุขภาพและโรคร้ายแรง",
        slug: "health-insurance",
      },
      tags: [],
    },
  ];

  const plan = buildTaxonomyMigrationPlan(articles, [lifeCategory]);
  assert.equal(logicalArticleId("drafts.article-1"), "article-1");
  assert.equal(plan.logicalArticleCount, 1);
  assert.equal(plan.draftArticleCount, 1);
  assert.equal(plan.publishedOnlyCount, 0);
  assert.equal(plan.changes.length, 1);
  assert.equal(plan.changes[0].id, "drafts.article-1");
  assert.deepEqual(plan.changes[0].set, {
    category: { _type: "reference", _ref: "ccpun-wp-category-4" },
    tags: ["Existing", "ประกันสุขภาพ"],
  });
});

test("already-normalized taxonomy is idempotent and published-only articles are preserved", () => {
  const normalizedDraft: RawArticle = {
    _id: "drafts.article-1",
    _rev: "draft-rev-2",
    _type: "article",
    category: { _ref: "ccpun-wp-category-4", title: "ประกันชีวิต", slug: "life-insurance" },
    tags: ["Existing", "ประกันสุขภาพ", "ประกันโรคร้ายแรง"],
  };
  const publishedOnly: RawArticle = {
    _id: "article-2",
    _rev: "published-rev-2",
    _type: "article",
    category: { _ref: "ccpun-wp-category-4", title: "ประกันชีวิต", slug: "life-insurance" },
    tags: [],
  };
  const plan = buildTaxonomyMigrationPlan([normalizedDraft, publishedOnly], [lifeCategory]);
  assert.equal(plan.logicalArticleCount, 2);
  assert.equal(plan.draftArticleCount, 1);
  assert.equal(plan.publishedOnlyCount, 1);
  assert.deepEqual(plan.changes, []);
  assert.equal(plan.categoryCreates.length, 4);
});

test("an empty UAT taxonomy plans deterministic active categories and normalizes the UAT fixture", () => {
  const plan = buildTaxonomyMigrationPlan([{
    _id: "drafts.uat-article",
    _rev: "uat-rev",
    _type: "article",
    category: {
      _ref: "uat-category-personal-finance",
      title: "การเงินส่วนบุคคล UAT",
      slug: "personal-finance-uat",
    },
    tags: ["UAT"],
  }], [{
    _id: "uat-category-personal-finance",
    _type: "category",
    title: "การเงินส่วนบุคคล UAT",
    slug: "personal-finance-uat",
  }]);

  assert.deepEqual(plan.categoryCreates.map(({ _id }) => _id), [
    "ccpun-category-personal-finance",
    "ccpun-category-life-insurance",
    "ccpun-category-health-insurance",
    "ccpun-category-critical-illness-insurance",
    "ccpun-category-investment",
  ]);
  assert.deepEqual(plan.changes[0].set, {
    category: { _type: "reference", _ref: "ccpun-category-personal-finance" },
  });
});

test("raw Sanity category references resolve from Draft category documents without dereference fallback", () => {
  const plan = buildTaxonomyMigrationPlan([{
    _id: "drafts.article-raw-reference",
    _rev: "draft-rev-raw",
    _type: "article",
    category: { _ref: "legacy-health" },
    tags: [],
  }], [
    lifeCategory,
    { _id: "drafts.legacy-health", _type: "category", title: "ประกันสุขภาพ", slug: "health-insurance" },
  ]);
  assert.deepEqual(plan.changes[0].set, {
    tags: ["ประกันสุขภาพ"],
  });
});

test("duplicate identity, unknown categories, and ambiguous target references fail closed", () => {
  const draft: RawArticle = {
    _id: "drafts.article-1",
    _rev: "draft-rev-1",
    _type: "article",
    category: { _ref: "legacy", title: "ประกันสุขภาพ", slug: "health-insurance" },
    tags: [],
  };
  assert.throws(() => buildTaxonomyMigrationPlan([draft, draft], [lifeCategory]), /duplicate article document identity/);
  assert.throws(
    () => buildTaxonomyMigrationPlan([{ ...draft, category: { _ref: "unknown", title: "Unknown", slug: "unknown" } }], [lifeCategory]),
    /unknown category/,
  );
  assert.equal(buildTaxonomyMigrationPlan([draft], []).lifeInsuranceCategoryId, "ccpun-category-life-insurance");
  assert.throws(
    () => buildTaxonomyMigrationPlan([draft], [lifeCategory, { ...lifeCategory, _id: "another-life-category" }]),
    /multiple life-insurance category references/,
  );
  assert.throws(
    () => buildTaxonomyMigrationPlan([draft], [{
      _id: "ccpun-category-personal-finance",
      _type: "article",
    }]),
    /belongs to another document type/,
  );
});

test("apply requires durable Neon intent and success audits around the revision-guarded Sanity mutation", async () => {
  const operations: Array<Record<string, unknown>> = [];
  let transactionCount = 0;
  let commitCount = 0;
  const transaction = {
    patch(id: string, factory: (patch: { ifRevisionId(revision: string): unknown }) => unknown) {
      const patchState: Record<string, unknown> = { kind: "patch", id };
      const builder = {
        ifRevisionId(revision: string) {
          patchState.revision = revision;
          return {
            set(fields: Record<string, unknown>) {
              patchState.set = fields;
              return builder;
            },
          };
        },
      };
      factory(builder);
      operations.push(patchState);
      return transaction;
    },
    createIfNotExists(document: Record<string, unknown>) {
      operations.push({ kind: "createIfNotExists", document });
      return transaction;
    },
    async commit(options: { tag: string }) {
      commitCount += 1;
      operations.push({ kind: "commit", options });
      return {};
    },
  };
  const client = {
    transaction() {
      transactionCount += 1;
      return transaction;
    },
  } as unknown as TransactionClient;
  const plan = buildTaxonomyMigrationPlan([{
    _id: "drafts.article-1",
    _rev: "draft-rev-1",
    _type: "article",
    category: { _ref: "legacy-health", title: "ประกันสุขภาพ", slug: "health-insurance" },
    tags: [],
  }], [lifeCategory]);

  const audits: Array<Record<string, unknown>> = [];
  const result = await applyTaxonomyMigration(client, plan, "2026-08-22T00:00:00.000Z", async (audit) => { audits.push(audit); }, async () => {});
  assert.deepEqual(result, { changed: 1, categoriesCreated: 4, auditLogCreated: true });
  assert.equal(transactionCount, 1);
  assert.equal(commitCount, 1);
  assert.equal(operations.filter((operation) => operation.kind === "patch").length, 1);
  assert.equal(operations.filter((operation) => operation.kind === "createIfNotExists").length, 4);
  const articlePatch = operations.find((operation) => operation.kind === "patch");
  assert.deepEqual(articlePatch, {
    kind: "patch",
    id: "drafts.article-1",
    revision: "draft-rev-1",
    set: {
      category: { _type: "reference", _ref: "ccpun-category-health-insurance" },
      tags: ["ประกันสุขภาพ"],
    },
  });
  assert.deepEqual(audits.map((audit) => audit.action), ["uat-taxonomy:normalize-intent", "uat-taxonomy:normalize-success"]);
  assert.doesNotMatch(JSON.stringify(operations), /body|publishedAt|delete|createOrReplace/);
});

test("package dry-run is explicit and never loads an env file", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const command = packageJson.scripts["cms:taxonomy:uat:dry-run"];
  assert.match(command, /CCPUN_APP_ENV=local-uat/);
  assert.match(command, /SANITY_API_PROJECT_ID=ccb9lnw5/);
  assert.match(command, /SANITY_API_DATASET=uat/);
  assert.match(command, /migrate-uat-taxonomy\.ts --dry-run/);
  assert.doesNotMatch(command, /env-file|kyfxgjnq|production/);
});

test("WordPress published preparation pins frozen redirect ownership while Draft import keeps shared taxonomy normalization", async () => {
  const [preparer, importer] = await Promise.all([
    readFile(path.join(root, "scripts/prepare-wordpress-published-migration.mjs"), "utf8"),
    readFile(path.join(root, "scripts/import-wordpress-drafts-to-sanity.mjs"), "utf8"),
  ]);
  assert.match(preparer, /legacyUrlLedger/);
  assert.match(preparer, /ledgerById/);
  assert.doesNotMatch(preparer, /ACTIVE_ARTICLE_CATEGORIES/);
  assert.doesNotMatch(preparer, /normalizeArticleTaxonomy/);
  assert.match(preparer, /sourceCategories/);
  assert.match(preparer, /sourceTags/);
  assert.match(preparer, /ccpun-category-life-insurance/);
  assert.match(preparer, /ccpun-wp-category-127/);
  assert.match(preparer, /ccpun-category-critical-illness/);
  assert.match(preparer, /ccpun-prod-mirror-author-ccpun/);
  assert.match(importer, /normalizeArticleTaxonomy/);
  assert.match(importer, /sourceCategories/);
  assert.match(importer, /sourceTags/);
  assert.match(importer, /tags: taxonomy.tags/);
});

test("all five deterministic category IDs are checked for wrong-type collisions by the actual CLI query", async () => {
  const file = "scripts/migrate-uat-taxonomy.ts";
  const source = await readFile(path.join(root, file), "utf8");
  const marker = '\nif (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {';
  assert.equal(source.split(marker).length, 2);
  for (const slug of ["health-insurance", "critical-illness-insurance"]) {
    const queries: Array<{ query: string; params: Record<string, unknown> }> = [];
    const docs = [{ _id: `ccpun-category-${slug}`, _type: "unexpected-document" }];
    const client = { async fetch(query: string, params: Record<string, unknown> = {}) {
      queries.push({ query, params });
      return (await evaluate(parse(query), { dataset: docs, params })).get();
    } };
    const { main } = loadFixtureModule(file, {
      sources: new Map([[file, source.split(marker)[0]!]]),
      mocks: new Map([["@sanity/client", { createClient: () => client }]]),
      globals: { process: { env: {}, argv: [] } },
    });
    await assert.rejects(main(["--dry-run"], { ...uatEnvironment, SANITY_API_READ_TOKEN: "synthetic-read-only" }), /belongs to another document type/);
    assert.equal(queries.length, 2);
    assert.deepEqual(queries[1]!.params.categoryIds, ["ccpun-category-personal-finance", "ccpun-category-life-insurance",
      "ccpun-category-health-insurance", "ccpun-category-critical-illness-insurance", "ccpun-category-investment"]);
  }
});

test("audit failure after a successful Sanity commit never succeeds and blocks an unchanged rerun", async () => {
  let commits = 0;
  let transactions = 0;
  let pending = false;
  const audits: Array<{ id: string; action: string }> = [];
  const tx = { createIfNotExists() { return tx; }, async commit() { commits += 1; } };
  const client = { transaction() { transactions += 1; return tx; } } as unknown as TransactionClient;
  const plan = buildTaxonomyMigrationPlan([], []);
  const append = async (audit: { id: string; action: string }) => {
    if (audit.action.endsWith("normalize-success")) throw new Error("synthetic-private-failure-payload");
    audits.push(audit);
    if (audit.action.endsWith("normalize-intent")) pending = true;
  };
  const check = async () => { if (pending) throw new Error("UAT_TAXONOMY_RECONCILIATION_REQUIRED"); };
  await assert.rejects(applyTaxonomyMigration(client, plan, "2026-10-23T00:00:00Z", append, check),
    { message: "UAT_TAXONOMY_RECONCILIATION_REQUIRED" });
  assert.equal(commits, 1);
  assert.deepEqual(audits.map(row => row.action), ["uat-taxonomy:normalize-intent", "uat-taxonomy:normalize-reconciliation-required"]);
  assert.equal(audits[1]!.id, audits[0]!.id.replace(/\.intent$/, ".reconciliation-required"));
  const unchanged = { ...plan, categoryCreates: [], changes: [] };
  await assert.rejects(applyTaxonomyMigration(client, unchanged, "2026-10-23T00:01:00Z", append, check),
    { message: "UAT_TAXONOMY_RECONCILIATION_REQUIRED" });
  assert.equal(commits, 1);
  assert.equal(transactions, 1, "unchanged rerun must inspect pending audit before its old early return");
  assert.equal(audits.length, 2, "no success inference, automatic clearing or CMS retry");
});

test("uncertain Sanity commit and failed reconciliation audit still produce only a closed failure", async () => {
  let commits = 0;
  const tx = { createIfNotExists() { return tx; }, async commit() { commits += 1; throw new Error("synthetic-uncertain-provider-payload"); } };
  const client = { transaction: () => tx } as unknown as TransactionClient;
  const actions: string[] = [];
  await assert.rejects(applyTaxonomyMigration(client, buildTaxonomyMigrationPlan([], []), "2026-10-23T00:00:00Z", async audit => {
    actions.push(audit.action);
    if (audit.action.endsWith("reconciliation-required")) throw new Error("synthetic-audit-unavailable");
  }, async () => {}), { message: "UAT_TAXONOMY_RECONCILIATION_REQUIRED" });
  assert.equal(commits, 1);
  assert.deepEqual(actions, ["uat-taxonomy:normalize-intent", "uat-taxonomy:normalize-reconciliation-required"]);
});

test("apply requires a pending-audit gate even for a no-op and intent failure occurs before CMS", async () => {
  let transactions = 0;
  const client = { transaction() { transactions += 1; throw new Error("CMS_MUST_NOT_START"); } } as unknown as TransactionClient;
  const plan = { ...buildTaxonomyMigrationPlan([], []), categoryCreates: [] };
  await assert.rejects(applyTaxonomyMigration(client, plan), /pending-audit reconciliation check/);
  const changed = buildTaxonomyMigrationPlan([], []);
  await assert.rejects(applyTaxonomyMigration(client, changed, "2026-10-23T00:00:00Z", async () => {
    throw new Error("synthetic-intent-denied");
  }, async () => {}), /synthetic-intent-denied/);
  assert.equal(transactions, 0);
});

test("pending-intent reader is UAT identity guarded, parameterized and read-only", async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  let pending: unknown = false;
  let identityGood = true;
  const sql = { async query(statement: string, params: unknown[]) {
    queries.push({ sql: statement, params });
    return statement.includes("AS identity_current")
      ? [{ database_name: "neondb", role_name: "ccpun_admin_runtime", identity_current: identityGood, ledger_current: true }]
      : [{ pending }];
  } };
  const { assertNoPendingScriptAdminAudit } = loadFixtureModule("scripts/admin-operations-audit.ts", {
    mocks: new Map([["@neondatabase/serverless", { neon: () => sql }]]),
    globals: { process: { env: {} } },
  });
  const environment = { CCPUN_APP_ENV: "local-uat", CCPUN_NEON_PROJECT_ID: "young-term-47483330",
    CCPUN_NEON_BRANCH_ID: "br-crimson-mouse-az7ajkv8", CCPUN_NEON_DATABASE: "neondb",
    CCPUN_ADMIN_DATABASE_URL: "postgresql://ccpun_admin_runtime:synthetic-only@ep-mute-frost-aztvz394-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" };
  await assertNoPendingScriptAdminAudit(environment);
  assert.equal(queries.length, 2);
  assert.match(queries[1]!.sql, /success\.request_id=intent\.request_id/);
  assert.match(queries[1]!.sql, /success\.object_id=intent\.object_id/);
  assert.deepEqual(queries[1]!.params, ["taxonomy-migration", "uat-taxonomy:normalize-intent", "auditLog.uat-taxonomy-%.intent", "uat-taxonomy:normalize-success"]);
  assert.doesNotMatch(queries.map(row => row.sql).join("\n"), /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP)\b/i);
  for (const value of [true, null, "false"]) {
    pending = value;
    await assert.rejects(assertNoPendingScriptAdminAudit(environment), { message: "UAT_TAXONOMY_RECONCILIATION_REQUIRED" });
  }
  pending = false; identityGood = false;
  const count = queries.length;
  await assert.rejects(assertNoPendingScriptAdminAudit(environment), /identity mismatch/);
  assert.equal(queries.length, count + 1, "no audit lookup after failed database identity proof");
  identityGood = true;
  for (const patch of [{ CCPUN_APP_ENV: "production-admin" }, { CCPUN_NEON_PROJECT_ID: "lively-bar-43618798" },
    { CCPUN_NEON_BRANCH_ID: "br-long-resonance-b3ys5xrv" }, { CCPUN_NEON_DATABASE: "other" }]) {
    const before: number = queries.length;
    await assert.rejects(assertNoPendingScriptAdminAudit({ ...environment, ...patch }), /UAT_TAXONOMY_AUDIT_TARGET_DENIED/);
    assert.equal(queries.length, before);
  }
});
