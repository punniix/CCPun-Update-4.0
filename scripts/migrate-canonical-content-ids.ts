import { createClient } from "@sanity/client";

const API_VERSION = "2026-09-18";
const PROJECT_ID = "kyfxgjnq";
const DATASET = "production";
const APP_ENV = "local-production";
const APPLY_CONFIRM = "CCPUN-CONTENT-ID-NORMALIZE-PRODUCTION";
const LEGACY_ID_PATTERN = /(?:^|[.-])(wp|v41|published)(?:[.-]|$)/i;
const MIGRATABLE_TYPES = ["category", "author", "article"] as const;
const CANONICAL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type MigratableType = (typeof MIGRATABLE_TYPES)[number];

type RawDocument = Record<string, unknown> & {
  _id: string;
  _type: string;
  _rev: string;
};

type CreateDocument = Record<string, unknown> & {
  _id: string;
  _type: string;
};

type MigrationEntry = {
  type: MigratableType;
  oldId: string;
  newId: string;
  slug: string;
  variants: string[];
};

type PublicSnapshot = {
  categories: Array<{
    slug: string;
    status: string | null;
    title: string | null;
  }>;
  articles: Array<{
    slug: string;
    title: string | null;
    categorySlug: string | null;
    canonical: string | null;
    publishedAt: string | null;
    contentUpdatedAt: string | null;
  }>;
};

function logicalId(id: string) {
  return id.replace(/^drafts\./, "");
}

function slugOf(document: RawDocument) {
  const slug = (document.slug as { current?: unknown } | undefined)?.current;
  if (typeof slug !== "string" || !CANONICAL_SLUG_PATTERN.test(slug)) {
    throw new Error(`Refusing ID normalization: ${document._type} ${document._id} has no canonical a-z0-9 slug`);
  }
  return slug;
}

function targetId(type: MigratableType, slug: string) {
  return `ccpun-${type}-${slug}`;
}

function stripSystemFields(document: RawDocument, nextId: string) {
  const next = structuredClone(document) as Record<string, unknown>;
  for (const key of ["_createdAt", "_updatedAt", "_rev", "_originalId"]) delete next[key];
  next._id = nextId;
  return next;
}

function rewriteRefs(value: unknown, idMap: Map<string, string>): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const items = value.map((item) => {
      const rewritten = rewriteRefs(item, idMap);
      changed ||= rewritten.changed;
      return rewritten.value;
    });
    return { value: items, changed };
  }

  if (!value || typeof value !== "object") return { value, changed: false };

  const source = value as Record<string, unknown>;
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    if (key === "_ref" && typeof item === "string") {
      const replacement = idMap.get(logicalId(item));
      if (replacement) {
        next[key] = replacement;
        changed = true;
        continue;
      }
    }
    const rewritten = rewriteRefs(item, idMap);
    next[key] = rewritten.value;
    changed ||= rewritten.changed;
  }
  return { value: next, changed };
}

function topLevelReferencePatch(document: RawDocument, idMap: Map<string, string>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(document)) {
    if (key.startsWith("_")) continue;
    const rewritten = rewriteRefs(value, idMap);
    if (rewritten.changed) set[key] = rewritten.value;
  }
  return set;
}

function parseArgs(args: string[]) {
  const apply = args.includes("--apply");
  const explicitDryRun = args.includes("--dry-run");
  const confirm = args.find((arg) => arg.startsWith("--confirm="))?.slice("--confirm=".length);
  const unknown = args.filter((arg) => arg !== "--apply" && arg !== "--dry-run" && !arg.startsWith("--confirm="));
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(", ")}`);
  if (apply && explicitDryRun) throw new Error("Choose only one of --dry-run or --apply");
  return { apply, confirm };
}

async function publicSnapshot(client: ReturnType<typeof createClient>): Promise<PublicSnapshot> {
  return client.fetch<PublicSnapshot>(`{
    "categories": *[_type == "category" && !(_id in path("drafts.**"))] | order(slug.current asc) {
      "slug": slug.current,
      "status": coalesce(status, null),
      "title": coalesce(title, null)
    },
    "articles": *[_type == "article" && !(_id in path("drafts.**")) && !(_id in path("versions.**"))]
      | order(slug.current asc) {
        "slug": slug.current,
        "title": coalesce(title, null),
        "categorySlug": coalesce(category->slug.current, null),
        "canonical": coalesce(seo.canonical, null),
        "publishedAt": coalesce(publishedAt, null),
        "contentUpdatedAt": coalesce(contentUpdatedAt, null)
      }
  }`);
}

function assertSamePublicSnapshot(before: PublicSnapshot, after: PublicSnapshot) {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error("Public URL/content ownership snapshot changed during ID normalization");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.SANITY_API_TOKEN?.trim() || process.env.SANITY_AUTH_TOKEN?.trim();
  if (!token) throw new Error("Missing Production Sanity write credential");
  if (process.env.CCPUN_APP_ENV !== APP_ENV) {
    throw new Error(`Refusing migration: expected CCPUN_APP_ENV=${APP_ENV}`);
  }
  if (process.env.NEXT_PUBLIC_SANITY_PROJECT_ID !== PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_DATASET !== DATASET) {
    throw new Error(`Refusing migration: expected ${PROJECT_ID}/${DATASET}`);
  }
  if (args.apply && args.confirm !== APPLY_CONFIRM) {
    throw new Error(`Refusing apply: pass --confirm=${APPLY_CONFIRM}`);
  }

  const client = createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: API_VERSION,
    useCdn: false,
    perspective: "raw",
    token,
    maxRetries: 0,
    requestTagPrefix: "ccpun.content-id-normalize",
  });

  const legacyTypeCount = await client.fetch<number>(
    `count(*[_type in ["articleV41","categoryV41"]])`,
  );
  if (legacyTypeCount !== 0) {
    throw new Error(`Refusing ID normalization while legacy V41 documents remain: ${legacyTypeCount}`);
  }

  const rawDocuments = await client.fetch<RawDocument[]>(
    `*[_type in $types && !(_id in path("versions.**"))]{...}`,
    { types: [...MIGRATABLE_TYPES] },
  );

  const grouped = new Map<string, RawDocument[]>();
  for (const document of rawDocuments) {
    const id = logicalId(document._id);
    const key = `${document._type}:${id}`;
    const group = grouped.get(key) ?? [];
    group.push(document);
    grouped.set(key, group);
  }

  const plan: MigrationEntry[] = [];
  for (const documents of grouped.values()) {
    const sample = documents[0];
    if (!sample || !MIGRATABLE_TYPES.includes(sample._type as MigratableType)) continue;
    const oldId = logicalId(sample._id);
    if (!LEGACY_ID_PATTERN.test(oldId)) continue;

    const type = sample._type as MigratableType;
    const slugs = new Set(documents.map(slugOf));
    if (slugs.size !== 1) {
      throw new Error(`Refusing ID normalization: variants for ${oldId} disagree on slug`);
    }
    const slug = [...slugs][0]!;
    const newId = targetId(type, slug);
    if (LEGACY_ID_PATTERN.test(newId)) {
      throw new Error(`Refusing ID normalization: generated target still looks legacy: ${newId}`);
    }
    plan.push({ type, oldId, newId, slug, variants: documents.map((doc) => doc._id).sort() });
  }

  plan.sort((left, right) => {
    const order: Record<MigratableType, number> = { category: 0, author: 1, article: 2 };
    return order[left.type] - order[right.type] || left.slug.localeCompare(right.slug);
  });

  const duplicateTargets = [...new Set(plan.map((entry) => entry.newId))]
    .filter((id) => plan.filter((entry) => entry.newId === id).length > 1);
  if (duplicateTargets.length) {
    throw new Error(`Refusing migration: duplicate canonical targets ${duplicateTargets.join(", ")}`);
  }

  const targetIds = plan.flatMap((entry) => [entry.newId, `drafts.${entry.newId}`]);
  const existingTargets = targetIds.length
    ? await client.fetch<string[]>(`*[_id in $ids]._id`, { ids: targetIds })
    : [];
  if (existingTargets.length) {
    throw new Error(`Refusing migration because target IDs already exist: ${existingTargets.join(", ")}`);
  }

  const currentLegacyIdsBefore = await client.fetch<string[]>(
    `*[_type in $types && !(_id in path("versions.**")) &&
      (_id match "*wp*" || _id match "*v41*" || _id match "*published*")]._id`,
    { types: [...MIGRATABLE_TYPES] },
  );
  const beforePublic = await publicSnapshot(client);

  console.log(JSON.stringify({
    mode: args.apply ? "apply" : "dry-run",
    projectId: PROJECT_ID,
    dataset: DATASET,
    logicalMigrationCount: plan.length,
    rawVariantCount: plan.reduce((sum, entry) => sum + entry.variants.length, 0),
    currentLegacyIdCount: currentLegacyIdsBefore.length,
    byType: Object.fromEntries(MIGRATABLE_TYPES.map((type) => [type, plan.filter((entry) => entry.type === type).length])),
    migrations: plan,
    historicalVersionDocumentsRenamed: false,
    historicalVersionReferencesWillBeRepointed: true,
  }, null, 2));

  if (!args.apply) {
    console.log("DRY RUN ONLY: no Sanity mutations were made.");
    return;
  }

  const migratedIdMap = new Map<string, string>();

  for (const entry of plan) {
    const variantIds = [entry.oldId, `drafts.${entry.oldId}`];
    const variants = await client.fetch<RawDocument[]>(`*[_id in $ids]{...}`, { ids: variantIds });
    if (!variants.length) continue;

    const referrers = await client.fetch<RawDocument[]>(
      `*[references($oldId) && !(_id in $variantIds)]{...}`,
      { oldId: entry.oldId, variantIds },
    );

    const currentIdMap = new Map(migratedIdMap);
    currentIdMap.set(entry.oldId, entry.newId);
    const currentOnlyMap = new Map([[entry.oldId, entry.newId]]);
    const mutations: Parameters<typeof client.mutate>[0] = [];

    for (const source of variants) {
      const nextRawId = source._id.startsWith("drafts.") ? `drafts.${entry.newId}` : entry.newId;
      const clone = stripSystemFields(source, nextRawId);
      const rewritten = rewriteRefs(clone, currentIdMap);
      mutations.push({ create: rewritten.value as CreateDocument });
    }

    for (const referrer of referrers) {
      const set = topLevelReferencePatch(referrer, currentOnlyMap);
      if (!Object.keys(set).length) continue;
      mutations.push({
        patch: {
          id: referrer._id,
          ifRevisionID: referrer._rev,
          set,
        },
      });
    }

    for (const source of variants) {
      mutations.push({
        patch: {
          id: source._id,
          ifRevisionID: source._rev,
          unset: ["_empty_action_guard_pseudo_field_"],
        },
      });
      mutations.push({ delete: { id: source._id } });
    }

    await client.mutate(mutations, {
      visibility: "sync",
      returnDocuments: false,
      tag: `ccpun.content-id-normalize.${entry.type}`,
    });

    const [oldRemaining, newVariants, oldRefCount] = await Promise.all([
      client.fetch<number>(`count(*[_id in $ids])`, { ids: variantIds }),
      client.fetch<string[]>(`*[_id in $ids]._id`, { ids: [entry.newId, `drafts.${entry.newId}`] }),
      client.fetch<number>(`count(*[references($oldId)])`, { oldId: entry.oldId }),
    ]);

    if (oldRemaining !== 0 || newVariants.length !== variants.length || oldRefCount !== 0) {
      throw new Error(`Readback failed after migrating ${entry.oldId}`);
    }

    migratedIdMap.set(entry.oldId, entry.newId);
    console.log(JSON.stringify({
      migrated: entry.oldId,
      to: entry.newId,
      variants: newVariants.sort(),
      repointedReferrers: referrers.length,
    }));
  }

  const remainingLegacyCurrentIds = await client.fetch<string[]>(
    `*[_type in $types && !(_id in path("versions.**")) &&
      (_id match "*wp*" || _id match "*v41*" || _id match "*published*")]._id`,
    { types: [...MIGRATABLE_TYPES] },
  );
  if (remainingLegacyCurrentIds.length) {
    throw new Error(`Migration finished with legacy current IDs remaining: ${remainingLegacyCurrentIds.join(", ")}`);
  }

  const oldIds = plan.map((entry) => entry.oldId);
  const oldReferenceCount = oldIds.length
    ? await client.fetch<number>(`count(*[references($oldIds)])`, { oldIds })
    : 0;
  if (oldReferenceCount !== 0) {
    throw new Error(`Migration finished with ${oldReferenceCount} references to retired IDs`);
  }

  const afterPublic = await publicSnapshot(client);
  assertSamePublicSnapshot(beforePublic, afterPublic);

  console.log(JSON.stringify({
    ok: true,
    migratedLogicalDocuments: plan.length,
    remainingLegacyCurrentIds: 0,
    referencesToRetiredIds: 0,
    publicSnapshotUnchanged: true,
    historicalVersionDocumentIdsPreserved: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
