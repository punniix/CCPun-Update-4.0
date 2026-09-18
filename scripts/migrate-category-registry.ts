import { createClient } from "@sanity/client";
import { getCliClient } from "sanity/cli";
import {
  buildCategoryRegistry,
  type RawCategoryRegistryRow,
} from "../lib/content/category-registry";

const API_VERSION = "2026-09-16";
const PRODUCTION = { projectId: "kyfxgjnq", dataset: "production", appEnv: "local-production" } as const;
const UAT = { projectId: "ccb9lnw5", dataset: "uat", appEnv: "local-uat" } as const;
const PRODUCTION_CONFIRM = "CCPUN-CATEGORY-REGISTRY-PRODUCTION-6";
const UAT_CONFIRM = "CCPUN-CATEGORY-REGISTRY-UAT";

const PRODUCTION_EXPECTED = [
  { slug: "personal-finance", title: "การเงินส่วนบุคคล", status: "active" },
  { slug: "life-insurance", title: "ประกันชีวิต", status: "active" },
  { slug: "health-insurance", title: "ประกันสุขภาพ", status: "active" },
  { slug: "investment", title: "การลงทุน", status: "active" },
  { slug: "motor-insurance", title: "ประกันรถยนต์", status: "active" },
  { slug: "critical-illness-insurance", title: "ประกันโรคร้ายแรง", status: "active" },
] as const;

const UAT_STATUS_BY_SLUG = new Map<string, "draft" | "active">([
  ["personal-finance", "active"],
  ["life-insurance", "active"],
  ["health-insurance", "active"],
  ["investment", "active"],
  ["motor-insurance", "active"],
  ["personal-finance-uat", "draft"],
  ["critical-illness", "draft"],
]);

type Target = "uat" | "production";
type Mode = "dry-run" | "apply";
type CategoryDoc = {
  _id: string;
  _type: "category";
  _rev?: string;
  title?: string;
  slug?: { current?: string };
  status?: "draft" | "active" | null;
  description?: string | null;
  redirectTo?: { _ref?: string } | null;
};

type CliArgs = { target: Target; mode: Mode; confirm?: string };

function logicalId(id: string) {
  return id.replace(/^drafts\./, "");
}

function parseArgs(args: string[]): CliArgs {
  const targetArg = args.find((arg) => arg.startsWith("--target="));
  const target = targetArg?.slice("--target=".length);
  if (target !== "uat" && target !== "production") {
    throw new Error("Use --target=uat or --target=production");
  }
  const hasApply = args.includes("--apply");
  const hasDryRun = args.includes("--dry-run");
  if (hasApply && hasDryRun) throw new Error("Choose only one of --dry-run or --apply");
  const unknown = args.filter((arg) => !arg.startsWith("--target=") && !arg.startsWith("--confirm=") && arg !== "--apply" && arg !== "--dry-run");
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(", ")}`);
  return {
    target,
    mode: hasApply ? "apply" : "dry-run",
    confirm: args.find((arg) => arg.startsWith("--confirm="))?.slice("--confirm=".length),
  };
}

function assertLane(target: Target, mode: Mode, confirm: string | undefined, client: ReturnType<typeof getCliClient>) {
  const expected = target === "production" ? PRODUCTION : UAT;
  const config = client.config();
  if (config.projectId !== expected.projectId || config.dataset !== expected.dataset || process.env.CCPUN_APP_ENV !== expected.appEnv) {
    throw new Error(`Refusing Category Registry migration: expected ${expected.appEnv} ${expected.projectId}/${expected.dataset}`);
  }
  if (mode === "apply") {
    const required = target === "production" ? PRODUCTION_CONFIRM : UAT_CONFIRM;
    if (confirm !== required) throw new Error(`Refusing apply: pass --confirm=${required}`);
  }
}

async function fetchProductionMotorSource() {
  const client = createClient({ projectId: PRODUCTION.projectId, dataset: PRODUCTION.dataset, apiVersion: API_VERSION, useCdn: false });
  const motor = await client.fetch<CategoryDoc | null>(
    `*[_type == "category" && slug.current == "motor-insurance"][0]{_id,_type,title,slug,description}`,
  );
  if (!motor || motor.title !== "ประกันรถยนต์" || motor.slug?.current !== "motor-insurance") {
    throw new Error("Refusing UAT motor seed: exact Production motor-insurance source is unavailable");
  }
  return motor;
}

function toRegistryRows(categories: CategoryDoc[], plannedStatus: (doc: CategoryDoc) => "draft" | "active" | null): RawCategoryRegistryRow[] {
  return categories.map((doc) => ({
    _id: doc._id,
    title: doc.title,
    slug: doc.slug?.current,
    status: plannedStatus(doc),
    description: doc.description,
    redirectToId: doc.redirectTo?._ref,
  }));
}

async function fetchCollisionContext(client: ReturnType<typeof getCliClient>) {
  const [routeOwnerSlugs, canonicalOwnerUrls, referencedCategoryIds] = await Promise.all([
    client.fetch<string[]>(`*[_type == "article" && defined(slug.current)].slug.current`),
    client.fetch<string[]>(`*[_type == "article" && defined(seo.canonical)].seo.canonical`),
    client.fetch<string[]>(`*[_type == "article" && defined(publishedAt) && defined(category._ref)].category._ref`),
  ]);
  return { routeOwnerSlugs, canonicalOwnerUrls, referencedCategoryIds };
}

function assertProductionIdentity(categories: CategoryDoc[]) {
  const published = categories.filter((doc) => !doc._id.startsWith("drafts."));
  const logicalIds = new Set(published.map((doc) => logicalId(doc._id)));
  if (logicalIds.size !== PRODUCTION_EXPECTED.length || published.length !== PRODUCTION_EXPECTED.length) {
    throw new Error(`Refusing Production migration: expected exactly ${PRODUCTION_EXPECTED.length} published Category documents, found ${published.length}`);
  }
  for (const expected of PRODUCTION_EXPECTED) {
    const doc = published.find((candidate) => candidate.slug?.current === expected.slug);
    if (!doc || doc.title !== expected.title) {
      throw new Error(`Refusing Production migration: identity mismatch for ${expected.slug}`);
    }
  }
}

function snapshotIdentity(doc: CategoryDoc) {
  return JSON.stringify({
    id: doc._id,
    type: doc._type,
    title: doc.title ?? null,
    slug: doc.slug ?? null,
    description: doc.description ?? null,
  });
}

async function main() {
const args = parseArgs(process.argv.slice(2));
const expectedLane = args.target === "production" ? PRODUCTION : UAT;
const client = getCliClient({ apiVersion: API_VERSION }).withConfig({ useCdn: false, perspective: "raw" });
assertLane(args.target, args.mode, args.confirm, client);

const rawCategoriesAll = await client.fetch<CategoryDoc[]>(`*[_type == "category"] | order(_id asc){_id,_type,_rev,title,slug,status,description,redirectTo}`);
// `perspective: raw` can return both `drafts.<id>` and the published document.
// Registry migration owns published Category documents only; including both
// variants would manufacture duplicate-slug collisions during preflight.
const rawCategories = rawCategoriesAll.filter((doc) => !doc._id.startsWith("drafts."));
if (args.target === "production") assertProductionIdentity(rawCategories);

let motorSeed: CategoryDoc | null = null;
if (args.target === "uat" && !rawCategories.some((doc) => doc.slug?.current === "motor-insurance")) {
  motorSeed = await fetchProductionMotorSource();
}

const categoriesForPreflight = motorSeed
  ? [...rawCategories, { ...motorSeed, status: "active" as const }]
  : rawCategories;
const context = await fetchCollisionContext(client);
const statusFor = (doc: CategoryDoc): "draft" | "active" | null => {
  if (args.target === "production") {
    return PRODUCTION_EXPECTED.some((expected) => expected.slug === doc.slug?.current) ? "active" : doc.status ?? null;
  }
  return UAT_STATUS_BY_SLUG.get(doc.slug?.current ?? "") ?? doc.status ?? null;
};
const registry = buildCategoryRegistry(toRegistryRows(categoriesForPreflight, statusFor), context);
const managedIds = new Set(
  args.target === "production"
    ? categoriesForPreflight.filter((doc) => PRODUCTION_EXPECTED.some((expected) => expected.slug === doc.slug?.current)).map((doc) => logicalId(doc._id))
    : categoriesForPreflight.filter((doc) => UAT_STATUS_BY_SLUG.has(doc.slug?.current ?? "")).map((doc) => logicalId(doc._id)),
);
const blockingIssues = registry.issues.filter((issue) => managedIds.has(logicalId(issue.id)));
if (blockingIssues.length) {
  throw new Error(`Refusing Category Registry migration: preflight issues ${JSON.stringify(blockingIssues)}`);
}

const plannedPatches = rawCategories.flatMap((doc) => {
  const desired = statusFor(doc);
  if (!desired || doc.status === desired) return [];
  if (args.target === "uat" && !UAT_STATUS_BY_SLUG.has(doc.slug?.current ?? "")) return [];
  if (args.target === "production" && !PRODUCTION_EXPECTED.some((expected) => expected.slug === doc.slug?.current)) return [];
  return [{ id: doc._id, from: doc.status ?? null, to: desired, beforeIdentity: snapshotIdentity(doc) }];
});

const plan = {
  target: args.target,
  lane: expectedLane.appEnv,
  projectId: expectedLane.projectId,
  dataset: expectedLane.dataset,
  mode: args.mode,
  patchCount: plannedPatches.length,
  createMotorFromProduction: Boolean(motorSeed),
  patches: plannedPatches.map(({ id, from, to }) => ({ id, from, to })),
  registryActiveSlugs: registry.active.map(({ slug }) => slug).sort(),
};
console.log(JSON.stringify(plan, null, 2));

if (args.mode === "dry-run") {
  console.log("DRY RUN ONLY: no Sanity mutations were made.");
  process.exit(0);
}

const tx = client.transaction();
for (const patch of plannedPatches) tx.patch(patch.id, { set: { status: patch.to } });
if (motorSeed) {
  tx.createIfNotExists({
    _id: motorSeed._id,
    _type: "category",
    title: motorSeed.title,
    slug: motorSeed.slug,
    ...(motorSeed.description ? { description: motorSeed.description } : {}),
    status: "active",
  });
}
if (plannedPatches.length || motorSeed) {
  await tx.commit({ visibility: "sync" });
}

const afterAll = await client.fetch<CategoryDoc[]>(`*[_type == "category"] | order(_id asc){_id,_type,_rev,title,slug,status,description,redirectTo}`);
const after = afterAll.filter((doc) => !doc._id.startsWith("drafts."));
for (const patch of plannedPatches) {
  const doc = after.find((candidate) => candidate._id === patch.id);
  if (!doc || doc.status !== patch.to) throw new Error(`Readback failed: ${patch.id} did not reach ${patch.to}`);
  if (snapshotIdentity(doc) !== patch.beforeIdentity) throw new Error(`Readback failed: identity/content changed unexpectedly for ${patch.id}`);
}
if (motorSeed) {
  const seeded = after.find((doc) => doc._id === motorSeed?._id);
  if (!seeded || seeded.title !== motorSeed.title || seeded.slug?.current !== motorSeed.slug?.current || seeded.description !== motorSeed.description || seeded.status !== "active") {
    throw new Error("Readback failed: UAT motor-insurance does not match Production source identity/content");
  }
}
if (args.target === "production") assertProductionIdentity(after);

const afterRegistry = buildCategoryRegistry(toRegistryRows(after, (doc) => doc.status ?? null), await fetchCollisionContext(client));
const afterBlocking = afterRegistry.issues.filter((issue) => managedIds.has(logicalId(issue.id)));
if (afterBlocking.length) throw new Error(`Readback registry validation failed: ${JSON.stringify(afterBlocking)}`);

console.log(JSON.stringify({
  ok: true,
  target: args.target,
  appliedPatches: plannedPatches.length,
  createdMotor: Boolean(motorSeed),
  activeSlugs: afterRegistry.active.map(({ slug }) => slug).sort(),
}, null, 2));

}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
