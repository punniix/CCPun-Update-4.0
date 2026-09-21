import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CCPUN_VERCEL_TEAM_ID,
  CCPUN_VERCEL_TEAM_SLUG,
  CCPUN_WEB_PRODUCTION_OIDC_SUBJECT,
  CCPUN_WEB_PROJECT_ID,
  CCPUN_WEB_PROJECT_NAME,
  isProductionWebOidcClaims,
} from "../../lib/admin/line/web-service-identity";

const valid = {
  iss: `https://oidc.vercel.com/${CCPUN_VERCEL_TEAM_SLUG}`,
  aud: `https://vercel.com/${CCPUN_VERCEL_TEAM_SLUG}`,
  sub: CCPUN_WEB_PRODUCTION_OIDC_SUBJECT,
  owner: CCPUN_VERCEL_TEAM_SLUG,
  owner_id: CCPUN_VERCEL_TEAM_ID,
  project: CCPUN_WEB_PROJECT_NAME,
  project_id: CCPUN_WEB_PROJECT_ID,
  environment: "production",
};

test("Web service OIDC claims require the exact CCPun Web Production identity", () => {
  assert.equal(isProductionWebOidcClaims(valid), true);
  for (const [key, value] of [
    ["project_id", "prj_wrong"],
    ["project", "ccpun-admin"],
    ["owner_id", "team_wrong"],
    ["owner", "wrong-team"],
    ["environment", "preview"],
    ["sub", "owner:wrong"],
  ] as const) {
    assert.equal(isProductionWebOidcClaims({ ...valid, [key]: value }), false, key);
  }
});

test("Admin LINE service routes authenticate before parsing or persisting payloads", () => {
  for (const file of [
    "apps/admin/app/api/internal/line/ingest-event/route.ts",
    "apps/admin/app/api/internal/line/public-event/route.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    const authAt = source.indexOf("isProductionWebServiceRequestAuthorized(request)");
    const bodyAt = source.indexOf("request.text()");
    assert.ok(authAt >= 0, file);
    assert.ok(bodyAt > authAt, file);
  }
  const verifier = readFileSync("lib/admin/line/web-service-auth.ts", "utf8");
  assert.match(verifier, /createRemoteJWKSet/);
  assert.match(verifier, /algorithms: \["RS256"\]/);
  assert.match(verifier, /CCPUN_WEB_PRODUCTION_OIDC_SUBJECT/);
  assert.match(verifier, /isProductionWebOidcClaims/);
});
