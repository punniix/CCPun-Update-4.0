import assert from "node:assert/strict";
import {
  buildCategoryRegistry,
  listCategoryMenuEntries,
  resolveCategoryRoute,
  type RawCategoryRegistryRow,
} from "../lib/content/category-registry";

const current: RawCategoryRegistryRow[] = [
  { _id: "ccpun-wp-category-1", title: "การเงินส่วนบุคคล", slug: "personal-finance", status: "active" },
  { _id: "ccpun-wp-category-4", title: "ประกันชีวิต", slug: "life-insurance", status: "active" },
  { _id: "ccpun-wp-category-127", title: "ประกันสุขภาพ", slug: "health-insurance", status: "active" },
  { _id: "ccpun-category-investment", title: "การลงทุน", slug: "investment", status: "active" },
  { _id: "ccpun-category-motor-insurance", title: "ประกันรถยนต์", slug: "motor-insurance", status: "active" },
];

const registry = buildCategoryRegistry(current);
assert.equal(registry.issues.length, 0);
assert.equal(resolveCategoryRoute(registry, "motor-insurance", { includeDrafts: false }).kind, "category");
assert.ok(listCategoryMenuEntries(registry).some(({ slug }) => slug === "motor-insurance"));

const travelDraft = buildCategoryRegistry([
  ...current,
  { _id: "qa-travel", title: "ประกันเดินทาง", slug: "travel-insurance", status: "draft" },
]);
assert.equal(resolveCategoryRoute(travelDraft, "travel-insurance", { includeDrafts: false }).kind, "hidden");
assert.equal(resolveCategoryRoute(travelDraft, "travel-insurance", { includeDrafts: true }).kind, "category");
assert.equal(listCategoryMenuEntries(travelDraft).some(({ slug }) => slug === "travel-insurance"), false);

const travelActive = buildCategoryRegistry([
  ...current,
  { _id: "qa-travel", title: "ประกันเดินทาง", slug: "travel-insurance", status: "active" },
]);
assert.equal(resolveCategoryRoute(travelActive, "travel-insurance", { includeDrafts: false }).kind, "category");
assert.ok(listCategoryMenuEntries(travelActive).some(({ slug }) => slug === "travel-insurance"));

const travelDeactivated = buildCategoryRegistry([
  ...current,
  {
    _id: "qa-travel",
    title: "ประกันเดินทาง",
    slug: "travel-insurance",
    status: "draft",
    redirectToId: "ccpun-category-motor-insurance",
    redirectToSlug: "motor-insurance",
  },
], { referencedCategoryIds: ["qa-travel"] });
assert.deepEqual(resolveCategoryRoute(travelDeactivated, "travel-insurance", { includeDrafts: false }), {
  kind: "redirect",
  destinationSlug: "motor-insurance",
});

console.log(JSON.stringify({
  ok: true,
  motorInsurance: "active/menu/route",
  travelInsurance: ["draft-hidden-public-previewable", "active-auto-menu", "deactivated-direct-redirect"],
}, null, 2));
