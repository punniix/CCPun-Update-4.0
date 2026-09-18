import { createHash } from "node:crypto";
import { getCliClient } from "sanity/cli";

const API_VERSION = "2026-09-18";
const PROJECT_ID = "kyfxgjnq";
const DATASET = "production";
const APP_ENV = "local-production";
const APPLY_CONFIRM = "CCPUN-CONTENT-ID-NORMALIZE-PRODUCTION";
const LEGACY_ID_PATTERN = /(?:^|[.-])(wp|v41|published)(?:[.-]|$)/i;
const MIGRATABLE_TYPES = ["category", "author", "article"] as const;

type MigratableType = (typeof MIGRATABLE_TYPES)[number];
type RawDocument = Record<string, unknown> & {
  _id: string;
  _type: string;
  _rev: string;
};

type MigrationEntry = {
  type: MigratableType;
  oldId: string;
  newId: string;
  variants: string[];
};

function logicalId(id: string) {
  return id.replace(/^drafts\./, "");
}

function targetId(type: MigratableType, oldId: string) {
  const digest = createHash("sha256").update(`${type}:${oldId}`).digest("hex").slice(0, 24);
  return `ccpun-${type}-${digest}`;
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
  const dryRun = args.includes("--dry-run") || !apply;
  const confirm = args.find((arg) => arg.startsWith("--confirm="))?.slice("--confirm=".length);
  const unknown = args.filter((arg) => arg !== "--apply" && arg !== "--dry-run" && !arg.startsWith("--confirm="));
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(", ")}`);
  if (apply && dryRun && args.includes("--dry-run")) throw new Error("Choose only one of --dry-run or --apply");
  return { apply, confirm };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = getCliClient({ apiVersion: API_VERSION }).withConfig({ useCdn: false, perspective: "raw" });
  const config = client.config();
  if (config.projectId !== PROJECT_ID || config.dataset !== DATASET || process.env.CCPUN_APP_ENV !== APP_ENV) {
    throw new Error(`Refusing migration: expected ${APP_ENV} ${PROJECT_ID}/${DATASET}`);
  }
  if (args.apply && args.confirm !== APPLY_CONFIRM) {
    throw new Error(`Refusing apply: pass --confirm=${APPLY_CONFIRM}`);
  }

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
    const newId = targetId(type, oldId);
    plan.push({ type, oldId, newId, variants: documents.map((doc) => doc._id).sort() });
  }

  plan.sort((left, right) => {
    const order: Record<MigratableType, number> = { category: 0, author: 1, article: 2 };
    return order[left.type] - order[right.type] || left.oldId.localeCompare(right.oldId);
  });

  const targetIds = plan.flatMap((entry) => [entry.newId, `drafts.${entry.newId}`]);
  const existingTargets = targetIds.length
    ? await client.fetch<string[]>(`*[_id in $ids]._id`, { ids: targetIds })
    : [];
  if (existingTargets.length) {
    throw new Error(`Refusing migration because target IDs already exist: ${existingTargets.join(", ")}`);
  }

  console.log(JSON.stringify({
    mode: args.apply ? "apply" : "dry-run",
    projectId: PROJECT_ID,
    dataset: DATASET,
    migrationCount: plan.length,
    byType: Object.fromEntries(MIGRATABLE_TYPES.map((type) => [type, plan.filter((entry) => entry.type === type).length])),
    migrations: plan,
    historicalVersionsExcluded: true,
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
      `*[references($oldId) && !(_id in path("versions.**")) && !(_id in $variantIds)]{...}`,
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
      mutations.push({ create: rewritten.value });
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
          setIfMissing: { _ccpunMigrationGuard: entry.newId },
        },
      });
      mutations.push({ delete: { id: source._id } });
    }

    await client.mutate(mutations, { visibility: "sync", returnDocuments: false });

    const [oldRemaining, newVariants, oldRefCount] = await Promise.all([
      client.fetch<number>(`count(*[_id in $ids])`, { ids: variantIds }),
      client.fetch<string[]>(`*[_id in $ids]._id`, { ids: [entry.newId, `drafts.${entry.newId}`] }),
      client.fetch<number>(`count(*[references($oldId) && !(_id in path("versions.**"))])`, { oldId: entry.oldId }),
    ]);
    if (oldRemaining !== 0 || newVariants.length !== variants.length || oldRefCount !== 0) {
      throw new Error(`Readback failed after migrating ${entry.oldId}`);
    }
    migratedIdMap.set(entry.oldId, entry.newId);
    console.log(JSON.stringify({ migrated: entry.oldId, to: entry.newId, variants: newVariants.sort() }));
  }

  const remainingLegacyCurrentIds = await client.fetch<string[]>(
    `*[_type in $types && !(_id in path("versions.**")) && (_id match "*wp*" || _id match "*v41*" || _id match "*published*")]._id`,
    { types: [...MIGRATABLE_TYPES] },
  );
  if (remainingLegacyCurrentIds.length) {
    throw new Error(`Migration finished with legacy current IDs remaining: ${remainingLegacyCurrentIds.join(", ")}`);
  }

  console.log("Content ID normalization complete. Historical release versions were intentionally preserved.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
