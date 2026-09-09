import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

type ObjectValue = Record<string, unknown>;
type Change = { path: string; before: unknown; after: unknown };
const object = (value: unknown): value is ObjectValue => Boolean(value && typeof value === "object" && !Array.isArray(value));
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function validateTarget(projectId: unknown, dataset: unknown) {
  if (!(projectId === "ccb9lnw5" && dataset === "uat") && !(projectId === "kyfxgjnq" && dataset === "production")) {
    throw new Error("Only ccb9lnw5/uat or kyfxgjnq/production is allowed; legacy live/uat is forbidden");
  }
}

export function normalizeArticle(input: ObjectValue, auditOnly = false) {
  if (input._type !== "article" || typeof input._id !== "string" || typeof input._rev !== "string" || !input._rev) {
    throw new Error("Each article requires its exact raw _id and nonempty _rev");
  }
  if (!/^(drafts\.)?[a-zA-Z0-9_-]+$/.test(input._id) && !(auditOnly && /^versions\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(input._id))) throw new Error("Unsupported document ID (release/version documents are excluded)");
  const document = structuredClone(input);
  const changes: Change[] = [];
  const warnings: { path: string; issue: string }[] = [];
  const record = (path: string, before: unknown, after: unknown) => changes.push({ path, before: before ?? null, after });

  function array(parent: ObjectValue, field: string, path: string, rows = false) {
    const values = parent[field];
    if (!Array.isArray(values)) return;
    const keys = new Set<string>();
    for (const [index, value] of values.entries()) {
      if (object(value) && typeof value._key === "string" && value._key) {
        if (keys.has(value._key)) warnings.push({ path: `${path}[${index}]._key`, issue: "Duplicate existing key; preserved for manual review" });
        keys.add(value._key);
      }
    }
    values.forEach((original, index) => {
      const itemPath = `${path}[${index}]`;
      let value = original;
      if (rows && Array.isArray(value)) {
        if (!value.every((cell) => typeof cell === "string")) {
          warnings.push({ path: itemPath, issue: "Legacy row has non-string cells; preserved for manual review" });
          return;
        }
        value = { _type: "tableRow", cells: value };
        values[index] = value;
      }
      if (!object(value)) {
        warnings.push({ path: itemPath, issue: "Expected object array member; preserved" });
        return;
      }
      if (value._key === undefined || value._key === null || value._key === "") {
        const previousKey = value._key;
        let counter = 0;
        let key: string;
        do { key = `norm${hash([input._id, itemPath, counter++]).slice(0, 20)}`; } while (keys.has(key));
        value._key = key;
        keys.add(key);
        if (value === original) record(`${itemPath}._key`, previousKey, key);
      } else if (typeof value._key !== "string") {
        warnings.push({ path: `${itemPath}._key`, issue: "Invalid existing key; preserved for manual review" });
      }
      if (value !== original) record(itemPath, original, structuredClone(value));
      // ponytail: follow schema-owned arrays only; add explicit paths when the schema gains nested arrays.
      if (value._type === "block") {
        array(value, "children", `${itemPath}.children`);
        array(value, "markDefs", `${itemPath}.markDefs`);
      }
      if (value._type === "simpleTable") array(value, "rows", `${itemPath}.rows`, true);
      if (value._type === "imageGallery") array(value, "images", `${itemPath}.images`);
    });
  }
  for (const field of ["body", "faq", "sources"]) array(document, field, field);
  const set: ObjectValue = {};
  for (const field of ["body", "faq", "sources"]) {
    if (JSON.stringify(input[field]) !== JSON.stringify(document[field])) set[field] = document[field];
  }
  const bodyText = JSON.stringify(input.body ?? []).normalize("NFKC").toLowerCase();
  for (const [index, faq] of (Array.isArray(input.faq) ? input.faq : []).entries()) {
    if (object(faq) && typeof faq.question === "string" && faq.question.trim() && bodyText.includes(faq.question.normalize("NFKC").toLowerCase())) {
      warnings.push({ path: `faq[${index}]`, issue: "Possible FAQ duplication in body; read-only signal, renderer/JSON-LD review required before removal" });
    }
  }
  for (const field of ["author", "category"]) {
    if (object(input[field]) && input[field]._weak === true) warnings.push({ path: field, issue: `Weak reference to ${String(input[field]._ref)}; target existence requires separate read-only audit` });
  }
  return { document, changes, warnings, patch: !auditOnly && Object.keys(set).length ? { id: input._id, ifRevisionID: input._rev, set } : null };
}

export function planMigration(input: unknown) {
  if (!object(input)) throw new Error("Expected export envelope {projectId,dataset,documents}");
  validateTarget(input.projectId, input.dataset);
  if (!Array.isArray(input.documents)) throw new Error("documents must be an array of raw articles");
  const seen = new Set();
  const skipped: { id: unknown; reason: string }[] = [];
  const plans = input.documents.flatMap((doc) => {
    if (!object(doc)) throw new Error("Invalid document");
    if (seen.has(doc._id)) throw new Error("Duplicate document ID in export");
    seen.add(doc._id);
    if (doc._type !== "article") {
      skipped.push({ id: doc._id, reason: "Non-article reference target; no normalization" });
      return [];
    }
    return [normalizeArticle(doc, typeof doc._id === "string" && doc._id.startsWith("versions."))];
  });
  const report = {
    projectId: input.projectId as string, dataset: input.dataset as string,
    documentsScanned: plans.length, skipped,
    documents: plans.map((plan) => ({
      id: plan.document._id, revision: plan.document._rev,
      readOnly: String(plan.document._id).startsWith("versions."),
      changes: plan.changes, warnings: plan.warnings,
    })),
  };
  return { report, confirmation: hash([report, plans.map((plan) => plan.patch)]), patches: plans.flatMap((plan) => plan.patch ? [plan.patch] : []) };
}

export function guardApply(plan: ReturnType<typeof planMigration>, confirmation: string | undefined, productionConfirmation: string | undefined) {
  if (confirmation !== plan.confirmation) throw new Error("Apply requires --confirm-report with the exact dry-run confirmation hash");
  if (plan.report.projectId === "kyfxgjnq" && productionConfirmation !== "kyfxgjnq/production") {
    throw new Error("Production content mutation requires explicit approval and --confirm-production kyfxgjnq/production");
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    input: { type: "string" }, "dry-run": { type: "boolean" }, apply: { type: "boolean" },
    "confirm-report": { type: "string" }, "confirm-production": { type: "string" },
  } });
  if (!values.input) throw new Error("Usage: node --import tsx scripts/normalize-article-structures.ts --input export.json [--dry-run | --apply --confirm-report HASH]");
  if (values.apply && values["dry-run"]) throw new Error("Choose --dry-run or --apply");
  const plan = planMigration(JSON.parse(readFileSync(values.input, "utf8")));
  console.log(JSON.stringify({ mode: "dry-run", ...plan.report, confirmation: plan.confirmation }, null, 2));
  if (!values.apply) return;
  guardApply(plan, values["confirm-report"], values["confirm-production"]);
  if (!plan.patches.length) return;
  const token = process.env.SANITY_API_TOKEN;
  if (!token) throw new Error("Apply requires SANITY_API_TOKEN in environment; no credential files are loaded");
  const { createClient } = await import("@sanity/client");
  const client = createClient({ projectId: plan.report.projectId, dataset: plan.report.dataset, apiVersion: "2026-09-01", useCdn: false, token });
  // Each transaction preserves the exact raw document identity and aborts on concurrent editing.
  for (const patch of plan.patches) {
    await client.mutate([{ patch }], { visibility: "sync", returnDocuments: false });
    console.log(JSON.stringify({ applied: patch.id, expectedRevision: patch.ifRevisionID }));
  }
  console.log("Apply complete. Re-export raw documents and dry-run again to verify zero changes.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : "Migration failed"); process.exitCode = 1; });
}
