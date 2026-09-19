import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  META_MINIMUM_READ_SCOPES,
  normalizeMetaConnection,
  SYNTHETIC_META_CONNECTION,
} from "../../lib/admin/social/providers/meta/connection";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const discovery = {
  mode: "synthetic-uat" as const,
  authorizationState: "active" as const,
  grantedScopes: [...META_MINIMUM_READ_SCOPES] as ["pages_show_list", "pages_read_engagement", "instagram_basic"],
  selectedPageId: "page-1",
  pages: [
    { id: "page-1", name: "Page One", instagramAccount: { id: "ig-1", username: "page.one" } },
    { id: "page-2", name: "Page Two", instagramAccount: null },
  ],
};

test("Meta discovery normalizes Page selection and missing Instagram without provider access", () => {
  const connection = normalizeMetaConnection(discovery);
  assert.equal(connection.status, "connected");
  assert.equal(connection.pages[0]?.selected, true);
  assert.deepEqual(connection.pages[1]?.instagram, { status: "not-linked", username: null });
  assert.equal(connection.providerRequestAllowed, false);
  assert.deepEqual(connection.grantedScopes, ["pages_show_list", "pages_read_engagement", "instagram_basic"]);
  assert.equal(connection.grantedScopes.some((scope) => /publish|insights/i.test(scope)), false);
  assert.doesNotMatch(JSON.stringify(connection), /token|secret/i);
});

test("Multiple Pages require explicit selection and stale authorization requires reconnect", () => {
  assert.equal(normalizeMetaConnection({ ...discovery, selectedPageId: null }).status, "selection-required");
  assert.equal(normalizeMetaConnection({ ...discovery, authorizationState: "expired" }).status, "reconnect-required");
  assert.equal(normalizeMetaConnection({ ...discovery, authorizationState: "revoked" }).status, "reconnect-required");
  assert.equal(normalizeMetaConnection({ ...discovery, pages: [discovery.pages[0]!], selectedPageId: null }).selectedPageId, "page-1");
});

test("Synthetic Meta connection and GET route stay UAT-only and read-only", () => {
  assert.equal(SYNTHETIC_META_CONNECTION.mode, "synthetic-uat");
  const route = read("app/api/admin/social/providers/meta/connection/route.ts");
  const page = read("features/admin/social/meta-connection-page.tsx");
  const entry = read("app/(control-plane)/social/accounts/meta/page.tsx");
  const connections = read("features/admin/social/connections-page.tsx");
  const layout = read("apps/admin/app/(control-plane)/layout.tsx");
  const queue = read("features/admin/social/operations-page.tsx");
  assert.match(route, /getAdminIdentity\(\)/);
  assert.match(route, /hasAdminPermission\(identity\.role, "social:read"\)/);
  assert.match(route, /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/);
  assert.match(route, /getSocialOperationsRuntimeStatus\(\)\.enabled/);
  assert.match(route, /export async function GET\(request: Request\)/);
  assert.doesNotMatch(route, /export async function (?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /fetch\(|createClient|accessToken|refreshToken/);
  assert.match(page, /requireAdminPermission\("social:read"\)/);
  assert.match(page, /const showFixture = runtime\.environment === "admin-uat"/);
  assert.match(page, /\{showFixture \? <>/);
  assert.ok(page.indexOf("{showFixture ? <>") < page.indexOf("connection.pages.map"));
  assert.equal(entry.trim(), 'export { metadata, default } from "@/features/admin/social/meta-connection-page";');
  assert.match(connections, /href: "\/social\/accounts\/meta\/"/);
  assert.match(connections, /Facebook Page · บัญชี Instagram/);
  assert.match(layout, /href: "\/social\/accounts\/", label: "บัญชีที่เชื่อมต่อ"/);
  assert.doesNotMatch(queue, /\/social\/accounts\/meta\//);
});
