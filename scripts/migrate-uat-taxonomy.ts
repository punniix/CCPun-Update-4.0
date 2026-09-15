import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@sanity/client";
import { normalizeArticleTaxonomy } from "../lib/content/taxonomy";
import { appendScriptAdminAudit } from "./admin-operations-audit";

const UAT_PROJECT_ID = "ccb9lnw5";
const UAT_DATASET = "uat";
const ALLOWED_APP_ENVIRONMENTS = new Set(["local-uat", "development", "lab", "uat"]);
// Historical migration contract only. Runtime/public category availability is
// owned by Sanity Category Registry, not this compatibility fixture.
const LEGACY_UAT_MIGRATION_CATEGORIES = [
  { slug: "personal-finance", title: "การเงินส่วนบุคคล" },
  { slug: "life-insurance", title: "ประกันชีวิต" },
  { slug: "health-insurance", title: "ประกันสุขภาพ" },
  { slug: "critical-illness-insurance", title: "ประกันโรคร้ายแรง" },
  { slug: "investment", title: "การลงทุน" },
] as const;

type EnvironmentInput = Record<string, string | undefined>;

export type UatTaxonomyEnvironment = {
  appEnvironment: "local-uat" | "development" | "lab" | "uat";
  projectId: typeof UAT_PROJECT_ID;
  dataset: typeof UAT_DATASET;
  readToken?: string;
  writeToken?: string;
};

export type RawArticle = {
  _id: string;
  _rev: string;
  _type: "article";
  category?: {
    _ref?: string | null;
    title?: string | null;
    slug?: string | null;
  } | null;
  tags?: string[] | null;
};

export type RawCategory = {
  _id: string;
  _type: string;
  title?: string | null;
  slug?: string | null;
};

export type TaxonomyChange = {
  id: string;
  logicalId: string;
  revision: string;
  set: {
    category?: { _type: "reference"; _ref: string };
    tags?: string[];
  };
  changedFields: Array<"category" | "tags">;
  before: {
    category?: { ref: string | null; title: string | null; slug: string | null };
    tags?: string[];
  };
  after: {
    category?: { ref: string; title: string; slug: string };
    tags?: string[];
  };
};

export type CategoryCreate = {
  _id: string;
  _type: "category";
  title: string;
  slug: { _type: "slug"; current: string };
};

export type TaxonomyMigrationPlan = {
  logicalArticleCount: number;
  draftArticleCount: number;
  publishedOnlyCount: number;
  lifeInsuranceCategoryId: string;
  categoryCreates: CategoryCreate[];
  changes: TaxonomyChange[];
};

type PatchBuilder = {
  ifRevisionId(revision: string): PatchBuilder;
  set(fields: TaxonomyChange["set"]): PatchBuilder;
};

type Transaction = {
  patch(id: string, patch: (builder: PatchBuilder) => PatchBuilder): Transaction;
  createIfNotExists(document: Record<string, unknown>): Transaction;
  commit(options: { tag: string }): Promise<unknown>;
};

export type TransactionClient = {
  transaction(): Transaction;
};

function exactConfiguredValue<const Expected extends string>(
  environment: EnvironmentInput,
  names: string[],
  expected: Expected,
  label: string,
): Expected {
  const configured = names.map((name) => environment[name]?.trim()).filter((value): value is string => Boolean(value));
  if (!configured.length || configured.some((value) => value !== expected)) {
    throw new Error(`Refusing taxonomy migration: ${label} must be exactly ${expected}`);
  }
  return expected;
}

export function validateUatTaxonomyEnvironment(environment: EnvironmentInput): UatTaxonomyEnvironment {
  const appEnvironment = environment.CCPUN_APP_ENV?.trim();
  if (!appEnvironment || !ALLOWED_APP_ENVIRONMENTS.has(appEnvironment)) {
    throw new Error("Refusing taxonomy migration: explicit UAT application environment is required");
  }

  const projectId = exactConfiguredValue(
    environment,
    ["SANITY_API_PROJECT_ID", "NEXT_PUBLIC_SANITY_PROJECT_ID", "SANITY_STUDIO_PROJECT_ID"],
    UAT_PROJECT_ID,
    "Sanity project",
  );
  const dataset = exactConfiguredValue(
    environment,
    ["SANITY_API_DATASET", "NEXT_PUBLIC_SANITY_DATASET", "SANITY_STUDIO_DATASET"],
    UAT_DATASET,
    "Sanity dataset",
  );

  return {
    appEnvironment: appEnvironment as UatTaxonomyEnvironment["appEnvironment"],
    projectId,
    dataset,
    readToken: environment.SANITY_API_READ_TOKEN?.trim() || undefined,
    writeToken: environment.SANITY_API_WRITE_TOKEN?.trim() || undefined,
  };
}

export function logicalArticleId(documentId: string) {
  return documentId.replace(/^drafts\./, "");
}

function equalStringArrays(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function resolveActiveCategories(categories: readonly RawCategory[]) {
  const ids = new Map<string, string>();
  const creates: CategoryCreate[] = [];
  for (const active of LEGACY_UAT_MIGRATION_CATEGORIES) {
    const defaultId = `ccpun-category-${active.slug}`;
    if (categories.some((category) => category._id === defaultId && category._type !== "category")) {
      throw new Error(`Refusing taxonomy migration: target ID ${defaultId} belongs to another document type`);
    }
    const matching = categories.filter((category) => category._type === "category" && category.slug === active.slug);
    const logicalIds = [...new Set(matching.map((category) => logicalArticleId(category._id)))];
    if (logicalIds.length > 1) {
      throw new Error(`Refusing taxonomy migration: multiple ${active.slug} category references found`);
    }
    const id = logicalIds[0] ?? defaultId;
    ids.set(active.slug, id);
    if (!categories.some((category) => category._id === id)) {
      creates.push({
        _id: id,
        _type: "category",
        title: active.title,
        slug: { _type: "slug", current: active.slug },
      });
    }
  }
  return { ids, creates };
}

function resolveArticleCategory(article: RawArticle, categories: readonly RawCategory[]) {
  const referenceId = article.category?._ref ? logicalArticleId(article.category._ref) : null;
  const referenced = referenceId
    ? categories.filter((category) => logicalArticleId(category._id) === referenceId)
    : [];
  const referencedSlugs = [...new Set(referenced.map((category) => category.slug).filter((value): value is string => Boolean(value)))];
  const referencedTitles = [...new Set(referenced.map((category) => category.title).filter((value): value is string => Boolean(value)))];
  if (referencedSlugs.length > 1 || referencedTitles.length > 1) {
    throw new Error(`Refusing taxonomy migration: conflicting category revisions for Draft ${article._id}`);
  }
  const suppliedSlug = article.category?.slug ?? null;
  const suppliedTitle = article.category?.title ?? null;
  if ((suppliedSlug && referencedSlugs[0] && suppliedSlug !== referencedSlugs[0])
    || (suppliedTitle && referencedTitles[0] && suppliedTitle !== referencedTitles[0])) {
    throw new Error(`Refusing taxonomy migration: category reference mismatch for Draft ${article._id}`);
  }
  return {
    ref: article.category?._ref ?? null,
    title: suppliedTitle ?? referencedTitles[0] ?? null,
    slug: suppliedSlug ?? referencedSlugs[0] ?? null,
  };
}

export function buildTaxonomyMigrationPlan(
  articles: readonly RawArticle[],
  categories: readonly RawCategory[],
): TaxonomyMigrationPlan {
  const seenDocumentIds = new Set<string>();
  const articlesByLogicalId = new Map<string, RawArticle[]>();
  for (const article of articles) {
    if (!article._id || !article._rev || article._type !== "article" || seenDocumentIds.has(article._id)) {
      throw new Error("Refusing taxonomy migration: invalid or duplicate article document identity");
    }
    seenDocumentIds.add(article._id);
    const logicalId = logicalArticleId(article._id);
    const group = articlesByLogicalId.get(logicalId) ?? [];
    group.push(article);
    articlesByLogicalId.set(logicalId, group);
  }

  const activeCategories = resolveActiveCategories(categories);
  const lifeInsuranceCategoryId = activeCategories.ids.get("life-insurance");
  if (!lifeInsuranceCategoryId) throw new Error("Refusing taxonomy migration: life-insurance target is unavailable");
  const changes: TaxonomyChange[] = [];
  let draftArticleCount = 0;
  let publishedOnlyCount = 0;

  for (const [logicalId, documents] of articlesByLogicalId) {
    const drafts = documents.filter((article) => article._id.startsWith("drafts."));
    if (drafts.length > 1) throw new Error(`Refusing taxonomy migration: duplicate Draft identity ${logicalId}`);
    if (!drafts.length) {
      publishedOnlyCount += 1;
      continue;
    }

    draftArticleCount += 1;
    const draft = drafts[0];
    const currentCategory = resolveArticleCategory(draft, categories);
    const currentTags = Array.isArray(draft.tags) ? draft.tags : [];
    const normalized = normalizeArticleTaxonomy({
      categoryTitle: currentCategory.title,
      categorySlug: currentCategory.slug,
      tags: currentTags,
    });
    if (!normalized.categorySlug) {
      throw new Error(`Refusing taxonomy migration: unknown category for Draft ${draft._id}`);
    }

    const targetCategory = LEGACY_UAT_MIGRATION_CATEGORIES.find(({ slug }) => slug === normalized.categorySlug);
    if (!targetCategory) {
      throw new Error(`Refusing taxonomy migration: unknown category for Draft ${draft._id}`);
    }
    const targetCategoryId = activeCategories.ids.get(normalized.categorySlug);
    if (!targetCategoryId) {
      throw new Error(`Refusing taxonomy migration: missing target category for Draft ${draft._id}`);
    }
    const categoryChanged = logicalArticleId(currentCategory.ref ?? "") !== targetCategoryId
      || currentCategory.slug !== normalized.categorySlug;
    const tagsChanged = !equalStringArrays(currentTags, normalized.tags);
    if (!categoryChanged && !tagsChanged) continue;

    const set: TaxonomyChange["set"] = {};
    const before: TaxonomyChange["before"] = {};
    const after: TaxonomyChange["after"] = {};
    const changedFields: TaxonomyChange["changedFields"] = [];
    if (categoryChanged) {
      set.category = { _type: "reference", _ref: targetCategoryId };
      before.category = {
        ref: currentCategory.ref,
        title: currentCategory.title,
        slug: currentCategory.slug,
      };
      after.category = {
        ref: targetCategoryId,
        title: targetCategory.title,
        slug: targetCategory.slug,
      };
      changedFields.push("category");
    }
    if (tagsChanged) {
      set.tags = normalized.tags;
      before.tags = currentTags;
      after.tags = normalized.tags;
      changedFields.push("tags");
    }

    changes.push({ id: draft._id, logicalId, revision: draft._rev, set, changedFields, before, after });
  }

  return {
    logicalArticleCount: articlesByLogicalId.size,
    draftArticleCount,
    publishedOnlyCount,
    lifeInsuranceCategoryId,
    categoryCreates: activeCategories.creates,
    changes,
  };
}

function auditIdFor(plan: TaxonomyMigrationPlan) {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ creates: plan.categoryCreates, changes: plan.changes.map(({ id, revision, set }) => ({ id, revision, set })) }))
    .digest("hex")
    .slice(0, 24);
  return `auditLog.uat-taxonomy-${fingerprint}`;
}

export async function applyTaxonomyMigration(
  client: TransactionClient,
  plan: TaxonomyMigrationPlan,
  timestamp = new Date().toISOString(),
  appendAudit: typeof appendScriptAdminAudit | undefined = undefined,
) {
  if (!plan.changes.length && !plan.categoryCreates.length) return { changed: 0, categoriesCreated: 0, auditLogCreated: false };
  if (!appendAudit) throw new Error("Refusing taxonomy mutation without Neon Admin audit");

  const auditId = auditIdFor(plan);
  const requestId = randomUUID();
  await appendAudit({
    id: `${auditId}.intent`, action: "uat-taxonomy:normalize-intent", objectId: `uat-taxonomy:${plan.changes.length}`,
    requestId, timestamp, after: { status: "started" },
  });

  let transaction = client.transaction();
  for (const category of plan.categoryCreates) transaction = transaction.createIfNotExists(category);
  for (const change of plan.changes) {
    if (!change.id.startsWith("drafts.")) throw new Error("Refusing taxonomy migration: only Draft documents may be patched");
    transaction = transaction.patch(change.id, (patch) => patch.ifRevisionId(change.revision).set(change.set));
  }

  await transaction.commit({ tag: "ccpun.uat.taxonomy-normalization" });
  await appendAudit({
    id: `${auditId}.success`, action: "uat-taxonomy:normalize-success", objectId: `uat-taxonomy:${plan.changes.length}`,
    requestId, timestamp, after: { status: "succeeded" },
  });
  return { changed: plan.changes.length, categoriesCreated: plan.categoryCreates.length, auditLogCreated: true };
}

function parseMode(args: readonly string[]) {
  const allowed = new Set(["--dry-run", "--apply"]);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length) throw new Error(`Unknown argument: ${unknown.join(", ")}`);
  if (args.includes("--dry-run") && args.includes("--apply")) throw new Error("Choose either --dry-run or --apply");
  return args.includes("--apply") ? "apply" : "dry-run";
}

export async function main(args = process.argv.slice(2), environment: EnvironmentInput = process.env) {
  const mode = parseMode(args);
  const config = validateUatTaxonomyEnvironment(environment);
  const token = mode === "apply" ? config.writeToken : config.readToken ?? config.writeToken;
  if (!token) throw new Error(`Refusing taxonomy migration: ${mode === "apply" ? "write" : "read"} token is required`);

  const client = createClient({
    projectId: config.projectId,
    dataset: config.dataset,
    token,
    apiVersion: "2026-08-22",
    useCdn: false,
    perspective: "raw",
  });
  const [articles, categories] = await Promise.all([
    client.fetch<RawArticle[]>(`*[_type == "article"]{
      _id,
      _rev,
      _type,
      tags,
      "category": {
        "_ref": category._ref,
        "title": category->title,
        "slug": category->slug.current
      }
    }`),
    client.fetch<RawCategory[]>(`*[_type == "category" || _id in ["ccpun-category-personal-finance", "ccpun-category-life-insurance", "ccpun-category-investment"]]{
      _id,
      _type,
      title,
      "slug": slug.current
    }`),
  ]);
  const plan = buildTaxonomyMigrationPlan(articles, categories);
  const report = {
    mode,
    projectId: config.projectId,
    dataset: config.dataset,
    logicalArticles: plan.logicalArticleCount,
    draftArticles: plan.draftArticleCount,
    publishedOnlyArticles: plan.publishedOnlyCount,
    lifeInsuranceCategoryId: plan.lifeInsuranceCategoryId,
    categoryCreates: plan.categoryCreates,
    changedArticles: plan.changes.length,
    changes: plan.changes.map(({ id, logicalId, changedFields, before, after }) => ({
      id,
      logicalId,
      changedFields,
      before,
      after,
    })),
    mutationAttempted: mode === "apply",
  };

  if (mode === "dry-run") {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  const result = await applyTaxonomyMigration(client as unknown as TransactionClient, plan, new Date().toISOString(), appendScriptAdminAudit);
  console.log(JSON.stringify({ ...report, ...result }, null, 2));
  return { ...report, ...result };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("Taxonomy migration failed; details redacted");
    process.exitCode = 1;
  });
}
