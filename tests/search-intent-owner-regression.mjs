import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const registry = await readJson("qa/search-intent-owner-registry.json");
const legacyLedger = await readJson("qa/legacy-url-ledger.json");

const normalizeQuery = (value) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const allowedSemanticTopics = new Set([
  "personal-finance",
  "life-insurance",
  "health-insurance",
  "critical-illness-insurance",
  "investment",
]);
const allowedSearchIntents = new Set(["informational", "commercial", "transactional", "navigational", "mixed"]);
const allowedOwnershipBases = new Set(["existing-published-page", "approved-url-migration"]);
const allowedOwnerStates = new Set(["published", "planned"]);
const legacyById = new Map(legacyLedger.mappings.map((mapping) => [mapping.id, mapping]));
const legacySources = new Set(legacyLedger.mappings.map((mapping) => mapping.source));
const intentIds = new Set();
const queryOwners = new Map();

assert.equal(registry.version, 2);
assert.equal(registry.policy, "1 Search Intent = 1 Owner");
assert.ok(Array.isArray(registry.owners) && registry.owners.length > 0, "registry must contain at least one reviewed owner");

for (const owner of registry.owners) {
  assert.equal(typeof owner.intentId, "string");
  assert.ok(owner.intentId.length > 0, "intentId is required");
  assert.ok(!intentIds.has(owner.intentId), `duplicate intentId: ${owner.intentId}`);
  intentIds.add(owner.intentId);

  assert.equal(typeof owner.primaryQuery, "string");
  assert.ok(owner.primaryQuery.trim().length > 0, `${owner.intentId}: primaryQuery is required`);
  assert.ok(Array.isArray(owner.queryVariants), `${owner.intentId}: queryVariants must be an array`);
  assert.ok(allowedSearchIntents.has(owner.searchIntent), `${owner.intentId}: unsupported searchIntent`);
  assert.ok(allowedSemanticTopics.has(owner.semanticTopic), `${owner.intentId}: unsupported semanticTopic`);
  assert.ok(allowedOwnerStates.has(owner.ownerState), `${owner.intentId}: unsupported ownerState`);
  assert.ok(allowedOwnershipBases.has(owner.ownershipBasis), `${owner.intentId}: ownership basis must stay explicit`);

  const ownerUrl = new URL(owner.ownerUrl);
  assert.equal(ownerUrl.origin, "https://ccpun.com", `${owner.intentId}: owner must be on ccpun.com`);
  assert.equal(ownerUrl.search, "", `${owner.intentId}: owner URL must not contain query state`);
  assert.equal(ownerUrl.hash, "", `${owner.intentId}: owner URL must not contain a hash`);
  assert.ok(ownerUrl.pathname.endsWith("/"), `${owner.intentId}: owner URL must use trailing slash`);
  assert.ok(!legacySources.has(owner.ownerUrl), `${owner.intentId}: owner must not point to a legacy source URL`);

  assert.equal(typeof owner.legacyMappingId, "string");
  const mapping = legacyById.get(owner.legacyMappingId);
  assert.ok(mapping, `${owner.intentId}: legacy mapping ${owner.legacyMappingId} is missing`);
  const approvedDestination = mapping.plannedDestination ?? mapping.destination;
  assert.equal(approvedDestination, owner.ownerUrl, `${owner.intentId}: owner must match the approved migration destination`);

  if (owner.ownershipBasis === "existing-published-page") {
    assert.equal(owner.ownerState, "published", `${owner.intentId}: existing owner must be published`);
    assert.equal(mapping.state, "live", `${owner.intentId}: existing owner must have a live legacy mapping`);
    assert.equal(mapping.destination, owner.ownerUrl, `${owner.intentId}: live legacy destination must equal the owner`);
  }

  if (owner.ownershipBasis === "approved-url-migration") {
    assert.equal(mapping.plannedDestination, owner.ownerUrl, `${owner.intentId}: planned destination must equal the final owner`);
    assert.ok(["live", "planned"].includes(mapping.state), `${owner.intentId}: migration mapping must be live-current or planned-final`);
    if (owner.ownerState === "published") {
      assert.notEqual(mapping.destination, owner.ownerUrl, `${owner.intentId}: app owner is live while external legacy may still point to the former owner`);
    } else {
      assert.equal(owner.ownerState, "planned", `${owner.intentId}: pre-cutover migration owner must be planned`);
    }
  }

  for (const query of [owner.primaryQuery, ...owner.queryVariants]) {
    assert.equal(typeof query, "string");
    const normalized = normalizeQuery(query);
    assert.ok(normalized.length > 0, `${owner.intentId}: query must not be empty`);
    assert.ok(!queryOwners.has(normalized), `query is assigned more than once: ${query}`);
    queryOwners.set(normalized, owner.intentId);
  }
}

const healthCiHero = registry.owners.find((owner) => owner.intentId === "aia-health-ci-hero-definition");
assert.ok(healthCiHero, "Health CI Hero owner contract is required");
assert.equal(healthCiHero.semanticTopic, "health-insurance");
assert.equal(healthCiHero.ownerUrl, "https://ccpun.com/blog/health-insurance/aia-health-ci-hero-guide/");
assert.match(healthCiHero.protectedRule ?? "", /not critical-illness lump-sum/i);

const criticalIllness = registry.owners.find((owner) => owner.intentId === "critical-illness-insurance-definition");
assert.ok(criticalIllness, "Critical Illness definition owner contract is required");
assert.equal(criticalIllness.semanticTopic, "critical-illness-insurance");
assert.equal(criticalIllness.ownerUrl, "https://ccpun.com/blog/critical-illness-insurance/critical-illness-insurance/");
assert.equal(criticalIllness.ownerState, "published");
assert.equal(criticalIllness.ownershipBasis, "approved-url-migration");

console.log(`PASS: Search Intent Owner Registry (${registry.owners.length} owners, ${queryOwners.size} protected query forms)`);
