import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { evaluate, parse } from "groq-js";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
class Pane {
  spec: { kind: string; id?: string; title?: string; filter?: string; schemaType?: string; child?: Pane; items?: Pane[]; params?: Record<string, string>; documentId?: string };
  constructor(kind: string) { this.spec = { kind }; }
  id(id: string) { this.spec.id = id; return this; }
  getId() { return this.spec.id; }
  title(title: string) { this.spec.title = title; return this; }
  schemaType(schemaType: string) { this.spec.schemaType = schemaType; return this; }
  filter(filter: string) { this.spec.filter = filter; return this; }
  child(child: Pane) { this.spec.child = child; return this; }
  items(items: Pane[]) { this.spec.items = items; return this; }
  params(params: Record<string, string>) { this.spec.params = params; return this; }
  documentId(documentId: string) { this.spec.documentId = documentId; return this; }
  defaultOrdering() { return this; }
}
let resolver: (environment: string, types?: string[]) => Pane;
async function structure(environment = "production-admin", types = ["article", "category", "author", "blogSettings", "masterContent", "socialVariant", "lineDiscoveryConfig", "auditLog", "publishSchedule"]) {
  if (!resolver) {
    // Execute the actual Structure resolver and its existing access filter.
    // Only the Sanity plugin registration is stubbed; no CMS/provider is called.
    const compiled = await build({ entryPoints: [fileURLToPath(new URL("../../cms/sanity/config/structure.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "cjs",
      plugins: [{ name: "offline-structure-registration", setup(build) {
        build.onResolve({ filter: /^sanity\/structure$/ }, () => ({ path: "structure", namespace: "offline" }));
        build.onLoad({ filter: /.*/, namespace: "offline" }, () => ({ contents: "export const structureTool = options => options;" }));
      } }] });
    const context = { module: { exports: {} }, process: { env: {} } };
    runInNewContext(compiled.outputFiles[0].text, context);
    const plugin = context.module.exports as { createStudioStructurePlugin(environment: string): { structure(S: unknown): Pane } };
    resolver = (lane, names = []) => plugin.createStudioStructurePlugin(lane).structure({
      list: () => new Pane("list"), listItem: () => new Pane("item"), documentList: () => new Pane("documentList"),
      document: () => new Pane("document"), divider: () => new Pane("divider"),
      documentTypeListItems: () => names.map(name => new Pane("documentType").id(name).title(name)),
    });
  }
  return resolver(environment, types);
}
function find(root: Pane, id: string): Pane {
  if (root.spec.id === id && root.spec.filter) return root;
  for (const child of [...(root.spec.items ?? []), ...(root.spec.child ? [root.spec.child] : [])]) {
    try { return find(child, id); } catch { /* Continue within this finite synthetic tree. */ }
  }
  throw new Error(`Missing filtered pane ${id}`);
}
async function results(root: Pane, id: string, dataset: Record<string, unknown>[]) {
  return await (await evaluate(parse(`*[${find(root, id).spec.filter}]`), { dataset })).get() as Record<string, unknown>[];
}

test("current draft perspective partitions all 63 synthetic articles without hiding dated orphan drafts", async () => {
  const root = await structure();
  const dataset = [
    ...Array.from({ length: 5 }, (_, i) => ({ _type: "article", _id: `live-${i}`, _originalId: `live-${i}`, publishedAt: "2026-09-01" })),
    ...["paired-1", "paired-2", "orphan-dated"].map(id => ({ _type: "article", _id: id, _originalId: `drafts.${id}`, publishedAt: "2026-09-01" })),
    ...Array.from({ length: 55 }, (_, i) => ({ _type: "article", _id: `new-${i}`, _originalId: `drafts.new-${i}` })),
  ];
  const groups = await Promise.all(["articles-production", "articles-optimize", "articles-never-published"].map(id => results(root, id, dataset)));
  assert.deepEqual(groups.map(rows => rows.length), [5, 3, 55]);
  assert.equal(new Set(groups.flat().map(row => row._id)).size, 63);
  assert.equal(groups[1].some(row => row._id === "orphan-dated"), true);
  assert.equal((await results(root, "articles-all", dataset)).length, 63);
});

test("raw ID fallback preserves status filters and keeps release versions out of current publication buckets", async () => {
  const root = await structure();
  const dataset = [
    { _type: "article", _id: "live", publishedAt: "2026-09-01" },
    { _type: "article", _id: "drafts.dated", publishedAt: "2026-09-01" },
    { _type: "article", _id: "drafts.new" },
    { _type: "article", _id: "versions.release.live", publishedAt: "2026-09-01" },
  ];
  for (const [id, expected] of [["articles-production", "live"], ["articles-optimize", "drafts.dated"], ["articles-never-published", "drafts.new"]]) {
    assert.deepEqual((await results(root, id, dataset)).map(row => row._id), [expected]);
  }
  assert.equal((await results(root, "articles-all", dataset)).length, 4);
});

test("native menu keeps article first, groups support and other channels, and retains allowed document IDs", async () => {
  const root = await structure();
  assert.deepEqual(Array.from(root.spec.items ?? [], item => item.getId()), ["article-workspace", "support-data", "other-channels", "lineDiscoveryConfig"]);
  const support = root.spec.items?.find(item => item.getId() === "support-data")?.spec.child?.spec.items;
  assert.deepEqual(Array.from(support ?? [], item => item.getId()), ["category-workspace", "author", "blog-settings"]);
  const channels = root.spec.items?.find(item => item.getId() === "other-channels")?.spec.child?.spec.items;
  assert.deepEqual(Array.from(channels ?? [], item => item.getId()), ["masterContent", "socialVariant"]);
  assert.deepEqual(Array.from(root.spec.items?.[0].spec.child?.spec.items?.slice(0, 3) ?? [], item => item.spec.title), ["เผยแพร่แล้ว", "แก้ไขรอเผยแพร่", "ร่างใหม่"]);
  assert.equal(root.spec.items?.some(item => ["auditLog", "publishSchedule"].includes(item.getId() ?? "")), false);
  assert.equal((await structure("production", ["article", "masterContent", "socialVariant", "author"])).spec.items?.some(item => item.getId() === "other-channels"), false);
  assert.deepEqual(Array.from((await structure("production-admin", ["author"])).spec.items ?? [], item => item.getId()), ["support-data"]);
});

test("every document list has a unique stable ASCII pane ID, including Thai review lists", async () => {
  const root = await structure(); const ids: string[] = [];
  function visit(node: Pane) {
    if (node.spec.kind === "documentList") { assert.match(node.spec.id ?? "", /^[a-z][a-z0-9-]+$/); ids.push(node.spec.id!); }
    for (const child of [...(node.spec.items ?? []), ...(node.spec.child ? [node.spec.child] : [])]) visit(child);
    const siblings = node.spec.items?.filter(child => child.spec.id).map(child => child.spec.id);
    if (siblings) assert.equal(new Set(siblings).size, siblings.length);
  }
  visit(root); assert.equal(new Set(ids).size, ids.length); assert.equal(ids.length, 11);
  for (const stage of ["content-review", "ready-for-coo", "approved"]) {
    assert.deepEqual({ ...find(root, `article-review-${stage}`).spec.params }, { reviewStatus: stage });
  }
});

test("category prefix filters handle draft perspective and raw documents without treating every originalId as a Draft", async () => {
  const root = await structure(); const dataset = [
    { _type: "category", _id: "live", _originalId: "live" },
    { _type: "category", _id: "active", _originalId: "drafts.active", status: "active" },
    { _type: "category", _id: "new", _originalId: "drafts.new" },
  ];
  assert.equal((await results(root, "categories-production", dataset)).length, 1);
  assert.equal((await results(root, "categories-optimize", dataset)).length, 1);
  assert.equal((await results(root, "categories-never-published", dataset)).length, 1);
});

test("dated Draft preview does not claim a canonical published counterpart and retains review labels", () => {
  const source = read("cms/sanity/schema/documents/article.ts");
  assert.match(source, /id: "_id"/); assert.match(source, /originalId: "_originalId"/); assert.match(source, /publishedAt: "publishedAt"/);
  assert.match(source, /ฉบับร่างแก้ไข · รอเผยแพร่/); assert.doesNotMatch(source, /เผยแพร่แล้ว · มีฉบับร่างแก้ไข/);
  assert.match(source, /ฉบับร่างใหม่/); assert.match(source, /เผยแพร่แล้ว · ฉบับ Live/); assert.match(source, /reviewLabels\[reviewStatus\]/);
});
