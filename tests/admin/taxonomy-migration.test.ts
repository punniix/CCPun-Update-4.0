import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
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
  const result = await applyTaxonomyMigration(client, plan, "2026-08-22T00:00:00.000Z", async (audit) => { audits.push(audit); });
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

test("WordPress preparation and Draft import use the shared taxonomy API and preserve source provenance", async () => {
  const [preparer, importer] = await Promise.all([
    readFile(path.join(root, "scripts/prepare-wordpress-published-migration.mjs"), "utf8"),
    readFile(path.join(root, "scripts/import-wordpress-drafts-to-sanity.mjs"), "utf8"),
  ]);
  for (const source of [preparer, importer]) {
    assert.match(source, /normalizeArticleTaxonomy/);
    assert.match(source, /sourceCategories/);
    assert.match(source, /sourceTags/);
  }
  assert.match(preparer, /'life-insurance': 'ccpun-wp-category-4'/);
  assert.doesNotMatch(preparer, /ccpun-category-(?:health-insurance|critical-illness)/);
  assert.match(importer, /tags: taxonomy\.tags/);
});
