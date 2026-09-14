import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const provider = readFileSync("lib/admin/ubersuggest.ts", "utf8");
const normalized = readFileSync("lib/admin/ubersuggest-dashboard-provider.ts", "utf8");
const snapshots = readFileSync("lib/admin/ubersuggest-dashboard.ts", "utf8");
const route = readFileSync("app/api/admin/providers/ubersuggest/sync/route.ts", "utf8");
const routes = readFileSync("lib/admin/routes.ts", "utf8");
const researchPage = readFileSync("features/admin/research/page.tsx", "utf8");
const layout = readFileSync("app/(control-plane)/layout.tsx", "utf8");
const schema = readFileSync("cms/sanity/admin/schema/ubersuggest-types.ts", "utf8");
const studioPolicy = readFileSync("cms/sanity/policy/studio-policy.ts", "utf8");
const studioConfig = readFileSync("sanity.config.ts", "utf8");
const schemaIndex = readFileSync("cms/sanity/schema/index.ts", "utf8");
const adminSchemaIndex = readFileSync("cms/sanity/admin/schema/index.ts", "utf8");

test("Ubersuggest provider remains local-authenticated and quota-conscious", () => {
  assert.match(provider, /\["development", "local-uat", "local-production"\]/);
  assert.match(provider, /PROVIDER_BATCH_MAX = 8/);
  assert.match(provider, /PROVIDER_TOOL_TIMEOUT_MS = 45_000/);
  assert.match(provider, /providerRequests|callUbersuggestTools|callTool/);
  assert.doesNotMatch(provider, /production-admin[^\n]*providerLaneAllowed/);
});

test("Ubersuggest account and GEO sync uses provider-reported limits", () => {
  assert.match(normalized, /name: "auth_status"/);
  assert.match(normalized, /name: "list_projects"/);
  assert.match(normalized, /name: "brand_config"/);
  assert.match(normalized, /name: "brand_visibility_overview"/);
  assert.match(normalized, /name: "brand_prompts"/);
  assert.match(normalized, /project\.limits\?\.keywords\?\.limit/);
  assert.match(normalized, /brandConfig\.limits\?\.prompts/);
  assert.match(normalized, /brandConfig\.limits\?\.brand_operations_limits/);
  assert.match(normalized, /remaining === 0 \? "full"/);
});

test("Ubersuggest snapshots contain no OAuth credentials and stay hidden from Studio", () => {
  assert.match(schema, /name: "ubersuggestAccountSnapshot"/);
  assert.match(schema, /name: "ubersuggestGeoSnapshot"/);
  assert.doesNotMatch(schema, /accessToken|refreshToken|access_token|refresh_token|clientSecret|client_secret/);
  assert.match(studioConfig, /schema:\s*\{ types: schemaTypes \}/);
  assert.match(schemaIndex, /\.\.\.adminIntelligenceSchemaTypes/);
  assert.match(adminSchemaIndex, /\.\.\.ubersuggestSchemaTypes/);
  assert.match(studioPolicy, /"ubersuggestAccountSnapshot"/);
  assert.match(studioPolicy, /"ubersuggestGeoSnapshot"/);
});

test("Ubersuggest keeps account GEO in Sanity and stores audit plus research history in Neon", () => {
  assert.match(snapshots, /getAdminSanityResearchWriteToken/);
  assert.match(snapshots, /transaction\(\)\.create\(accountDocument\)\.create\(geoDocument\)\.commit\(\)/);
  assert.match(snapshots, /insertAdminAudit\(auditDocument\)/);
  assert.match(snapshots, /readAdminResearch\(limit\)/);
  assert.doesNotMatch(snapshots, /_type == "researchSnapshot"/);
  assert.match(route, /SYNC_CACHE_HOURS = 1/);
  assert.match(route, /research:provider-query/);
  assert.match(route, /identity\.actorType !== "human"/);
  assert.match(route, /provider-sync-local-required/);
});

test("Research Intelligence owns keyword coverage Ubersuggest quota GEO prompt gaps and history", () => {
  assert.match(researchPage, /Research Intelligence/);
  assert.match(researchPage, /1 · เก็บข้อมูล/);
  assert.match(researchPage, /2 · Match บทความ/);
  assert.match(researchPage, /3 · Ubersuggest/);
  assert.match(researchPage, /4 · GEO \/ AEO/);
  assert.match(researchPage, /5 · History/);
  assert.match(researchPage, /Ubersuggest Intelligence \+ Account Quota/);
  assert.match(researchPage, /GEO \/ AEO — AI Search Visibility/);
  assert.match(researchPage, /AI Prompt Gaps/);
  assert.match(researchPage, /Research History \+ Decision Status/);
  assert.match(researchPage, /getUbersuggestDashboardData\(30\)/);
  assert.match(researchPage, /userVisibilityPercentage === 0/);
  assert.match(researchPage, /Research gap · โอกาสสูง/);
});

test("Production Research uses snapshots while Local lanes retain provider query and sync", () => {
  assert.match(researchPage, /environment === "production-admin"/);
  assert.match(researchPage, /Snapshot พร้อมใช้/);
  assert.match(researchPage, /Cloud Admin อ่าน Snapshot จาก Sanity เท่านั้น/);
  assert.match(researchPage, /UbersuggestResearchForm connected=\{ubersuggest\.connected\}/);
  assert.match(researchPage, /SyncUbersuggestButton/);
  assert.match(researchPage, /localProviderLane/);
});

test("legacy Ubersuggest route maps into unified Research and navigation has one canonical research entry", () => {
  assert.match(routes, /\["\/snt-admin\/ubersuggest", "\/content\/research\/"\]/);
  assert.match(layout, /href: "\/content\/research\/", label: "Research"/);
  assert.doesNotMatch(layout, /href: "\/snt-admin\/ubersuggest\/"/);
});
