import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { firstValueFrom, from, of, Subject, throwError, type Observable } from "rxjs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { evaluate, parse } from "groq-js";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
class Pane {
  spec: { kind: string; id?: string; title?: string; filter?: string; schemaType?: string; child?: Pane; resolve?: () => Observable<Pane>; items?: Pane[]; params?: Record<string, string>; documentId?: string };
  constructor(kind: string) { this.spec = { kind }; }
  id(id: string) { this.spec.id = id; return this; }
  getId() { return this.spec.id; }
  title(title: string) { this.spec.title = title; return this; }
  schemaType(schemaType: string) { this.spec.schemaType = schemaType; return this; }
  filter(filter: string) { this.spec.filter = filter; return this; }
  child(child: Pane | (() => Observable<Pane>)) { if (typeof child === "function") this.spec.resolve = child; else this.spec.child = child; return this; }
  items(items: Pane[]) { this.spec.items = items; return this; }
  params(params: Record<string, string>) { this.spec.params = params; return this; }
  documentId(documentId: string) { this.spec.documentId = documentId; return this; }
  defaultOrdering() { return this; }
}
type PublishedArticle = { _type?: string; _id: string; title?: string; publishedAt?: string };
type ListenPublished = (query: { fetch: string; listen: string }, params: unknown, options: { perspective: string; tag: string }) => Observable<PublishedArticle[]>;
let resolver: (environment: string, types: string[], listen: ListenPublished) => Pane;
async function structure(environment = "production-admin", types = ["article", "category", "author", "blogSettings", "masterContent", "socialVariant", "lineDiscoveryConfig", "auditLog", "publishSchedule"], listen: ListenPublished = () => { throw new Error("Published client not provided"); }) {
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
    const plugin = context.module.exports as { createStudioStructurePlugin(environment: string): { structure(S: unknown, context: unknown): Pane } };
    resolver = (lane, names, listenPublished) => plugin.createStudioStructurePlugin(lane).structure({
      list: () => new Pane("list"), listItem: () => new Pane("item"), documentList: () => new Pane("documentList"),
      documentListItem: () => new Pane("documentListItem"), document: () => new Pane("document"), divider: () => new Pane("divider"),
      documentTypeListItems: () => names.map(name => new Pane("documentType").id(name).title(name)),
    }, {
      documentStore: { listenQuery: listenPublished },
    });
  }
  return resolver(environment, types, listen);
}
function find(root: Pane, id: string): Pane {
  if (root.spec.id === id && (root.spec.filter || root.spec.resolve)) return root;
  for (const child of [...(root.spec.items ?? []), ...(root.spec.child ? [root.spec.child] : [])]) {
    try { return find(child, id); } catch { /* Continue within this finite synthetic tree. */ }
  }
  throw new Error(`Missing filtered pane ${id}`);
}
async function results(root: Pane, id: string, dataset: Record<string, unknown>[]) {
  return await (await evaluate(parse(`*[${find(root, id).spec.filter}]`), { dataset })).get() as Record<string, unknown>[];
}

test("Published includes all seven canonical articles while dated and new Drafts stay accessible", async () => {
  const canonical = [...Array.from({ length: 5 }, (_, i) => ({ _type: "article", _id: `live-${i}`, title: `Live ${i}`, publishedAt: "2026-09-01" })),
    ...["paired-1", "paired-2"].map(_id => ({ _type: "article", _id, title: _id, publishedAt: "2026-09-01" }))];
  const root = await structure("production-admin", undefined, (query, params, options) => {
    assert.match(query.fetch, /_type == "article" && defined\(publishedAt\)/);
    assert.match(query.fetch, /order\(publishedAt desc, _id asc\)/);
    assert.match(query.fetch, /\{ _id, title \}/); assert.deepEqual({ ...params as object }, {});
    assert.equal(options.perspective, "published");
    assert.match(query.listen, /!\(_id in path\("drafts\.\*\*"\)\)/);
    assert.match(query.listen, /!\(_id in path\("versions\.\*\*"\)\)/);
    return from((async () => await (await evaluate(parse(query.fetch), { dataset: [...canonical,
      { _type: "category", _id: "category", publishedAt: "2026-09-01" },
      { _type: "article", _id: "never-published" },
    ] })).get() as PublishedArticle[])());
  });
  const dataset = [
    ...Array.from({ length: 5 }, (_, i) => ({ _type: "article", _id: `live-${i}`, _originalId: `live-${i}`, publishedAt: "2026-09-01" })),
    ...["paired-1", "paired-2", "orphan-dated"].map(id => ({ _type: "article", _id: id, _originalId: `drafts.${id}`, publishedAt: "2026-09-01" })),
    ...Array.from({ length: 55 }, (_, i) => ({ _type: "article", _id: `new-${i}`, _originalId: `drafts.new-${i}` })),
  ];
  const published = await firstValueFrom(find(root, "articles-production").spec.resolve!());
  assert.equal(published.spec.kind, "list"); assert.equal(published.spec.id, "articles-production");
  assert.equal(published.spec.title, "เผยแพร่แล้ว · รวมบทความที่มีร่างแก้ไข");
  assert.deepEqual(Array.from(published.spec.items ?? [], item => item.spec.id), canonical.map(article => article._id));
  assert.equal(published.spec.items?.every(item => item.spec.kind === "documentListItem" && item.spec.schemaType === "article"), true);
  const drafts = await Promise.all(["articles-optimize", "articles-never-published"].map(id => results(root, id, dataset)));
  const groups = [canonical, ...drafts];
  assert.deepEqual(groups.map(rows => rows.length), [7, 3, 55]);
  assert.equal(new Set(groups.flat().map(row => row._id)).size, 63);
  assert.equal(groups[1].some(row => row._id === "orphan-dated"), true);
  assert.equal((await results(root, "articles-all", dataset)).length, 63);
});

test("raw ID fallback preserves Draft status filters and keeps release versions out of working buckets", async () => {
  const root = await structure();
  const dataset = [
    { _type: "article", _id: "live", publishedAt: "2026-09-01" },
    { _type: "article", _id: "drafts.dated", publishedAt: "2026-09-01" },
    { _type: "article", _id: "drafts.new" },
    { _type: "article", _id: "versions.release.live", publishedAt: "2026-09-01" },
  ];
  for (const [id, expected] of [["articles-optimize", "drafts.dated"], ["articles-never-published", "drafts.new"]]) {
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
  visit(root); assert.equal(new Set(ids).size, ids.length); assert.equal(ids.length, 10); assert.equal(typeof find(root, "articles-production").spec.resolve, "function");
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


test("Published native resolver reconnects on reopen and propagates query failure", async () => {
  let count = 0;
  const root = await structure("production-admin", undefined, (_query, _params, options) => {
    assert.equal(options.perspective, "published");
    if (++count === 3) return throwError(() => new Error("published-query-failed"));
    return of(Array.from({ length: count }, (_, i) => ({ _id: `canonical-${i}`, title: `Published ${i}` })));
  });
  const resolve = find(root, "articles-production").spec.resolve!;
  assert.equal((await firstValueFrom(resolve())).spec.items?.length, 1);
  assert.equal((await firstValueFrom(resolve())).spec.items?.length, 2);
  await assert.rejects(firstValueFrom(resolve()), /published-query-failed/);
  assert.equal(count, 3);
});

test("open Published pane follows publish, re-edit, discard and unpublish without duplicate canonical IDs", async () => {
  const raw: PublishedArticle[] = [
    ...Array.from({ length: 7 }, (_, i) => ({ _type: "article", _id: `live-${i}`, title: `Live ${i}`, publishedAt: "2026-09-01" })),
    ...["live-0", "live-1", "orphan"].map(id => ({ _type: "article", _id: `drafts.${id}`, title: `Draft ${id}`, publishedAt: "2026-09-01" })),
    ...Array.from({ length: 55 }, (_, i) => ({ _type: "article", _id: `drafts.new-${i}`, title: `New ${i}` })),
  ];
  const stream = new Subject<PublishedArticle[]>();
  let query: { fetch: string; listen: string } | undefined;
  const root = await structure("production-admin", undefined, (queries, _params, options) => {
    assert.equal(options.perspective, "published");
    assert.equal(options.tag, "studio-published-articles");
    query = queries; return stream;
  });
  const seen: Pane[] = [];
  const subscription = find(root, "articles-production").spec.resolve!().subscribe(pane => seen.push(pane));
  async function refreshCanonical() {
    const published = raw.filter(row => !row._id.startsWith("drafts.") && !row._id.startsWith("versions."));
    stream.next(await (await evaluate(parse(query!.fetch), { dataset: published })).get() as PublishedArticle[]);
  }
  async function assertMembership(published: number, dated: number, newDrafts: number) {
    const ids = Array.from(seen.at(-1)!.spec.items ?? [], item => item.spec.id);
    assert.equal(ids.length, published); assert.equal(new Set(ids).size, published);
    assert.equal(ids.every(id => id && !id.startsWith("drafts.") && !id.startsWith("versions.")), true);
    const drafts = raw.filter(row => row._id.startsWith("drafts."));
    assert.equal((await results(root, "articles-optimize", drafts)).length, dated);
    assert.equal((await results(root, "articles-never-published", drafts)).length, newDrafts);
    assert.equal(drafts.some(row => row._id === "drafts.orphan"), true);
  }
  await refreshCanonical(); await assertMembership(7, 3, 55);
  // Saving an existing working copy is outside the canonical listener filter.
  raw.find(row => row._id === "drafts.live-0")!.title = "Edited title";
  assert.equal((await (await evaluate(parse(query!.listen), { dataset: raw })).get() as PublishedArticle[]).some(row => row._id === "drafts.live-0"), false);
  await assertMembership(7, 3, 55); assert.equal(seen.length, 1);
  // Native publish replaces the same canonical document and removes its Draft.
  raw.find(row => row._id === "live-0")!.title = "Edited title";
  raw.splice(raw.findIndex(row => row._id === "drafts.live-0"), 1);
  await refreshCanonical(); await assertMembership(7, 2, 55);
  assert.equal(seen.at(-1)!.spec.items?.find(item => item.spec.id === "live-0")?.spec.title, "Edited title");
  raw.push({ ...raw.find(row => row._id === "live-0")!, _id: "drafts.live-0", title: "Further edit" });
  await assertMembership(7, 3, 55);
  raw.splice(raw.findIndex(row => row._id === "drafts.live-0"), 1);
  await assertMembership(7, 2, 55);
  // First publication adds one real canonical article while the already open pane updates.
  const newDraft = raw.find(row => row._id === "drafts.new-0")!;
  raw.push({ ...newDraft, _id: "new-0", publishedAt: "2026-10-01" });
  raw.splice(raw.findIndex(row => row._id === "drafts.new-0"), 1);
  await refreshCanonical(); await assertMembership(8, 2, 54);
  // Native unpublish preserves a working Draft and removes only canonical membership.
  const newlyPublished = raw.find(row => row._id === "new-0")!;
  raw.push({ ...newlyPublished, _id: "drafts.new-0" });
  raw.splice(raw.findIndex(row => row._id === "new-0"), 1);
  await refreshCanonical(); await assertMembership(7, 3, 54);
  // Reconnect delivers a fresh query result through the same open subscription.
  await refreshCanonical(); await assertMembership(7, 3, 54);
  const beforeUnsubscribe = seen.length; subscription.unsubscribe(); stream.next([]);
  assert.equal(seen.length, beforeUnsubscribe);
});
