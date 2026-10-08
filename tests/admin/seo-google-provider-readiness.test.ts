import assert from "node:assert/strict";
import test from "node:test";
import { getGoogleDataAccessToken } from "../../lib/admin/seo-intelligence/google-data-auth";
import { getSeoGoogleProviderReadiness } from "../../lib/admin/seo-intelligence/provider-readiness";

test("SEO Google provider readiness validates resource identifiers and never exposes values", () => {
  const missing = getSeoGoogleProviderReadiness("gsc", {});
  assert.equal(missing.status, "configuration-required");
  assert.equal(missing.refreshableConnectionReady, false);

  const gsc = getSeoGoogleProviderReadiness("gsc", {
    CCPUN_GOOGLE_DATA_CLIENT_ID: "redacted-client",
    CCPUN_GOOGLE_DATA_CLIENT_SECRET: "redacted-secret",
    CCPUN_GOOGLE_DATA_REFRESH_TOKEN: "redacted-refresh",
    CCPUN_GSC_SITE_URL: "sc-domain:ccpun.com",
  });
  assert.equal(gsc.status, "manual-sync-ready");
  assert.equal(gsc.refreshableConnectionReady, true);
  assert.equal(JSON.stringify(gsc).includes("redacted"), false);
  assert.equal(gsc.scope, "https://www.googleapis.com/auth/webmasters.readonly");
  assert.match(gsc.limitation, /independent owner-authorized write credential/);

  const ga4 = getSeoGoogleProviderReadiness("ga4", {
    CCPUN_GOOGLE_DATA_CLIENT_ID: "redacted-client",
    CCPUN_GOOGLE_DATA_CLIENT_SECRET: "redacted-secret",
    CCPUN_GOOGLE_DATA_REFRESH_TOKEN: "redacted-refresh",
    CCPUN_GA4_PROPERTY_ID: "G-BAD-ID",
  });
  assert.equal(ga4.status, "configuration-required");
  assert.equal(ga4.required.find((item) => item.name === "CCPUN_GA4_PROPERTY_ID")?.valid, false);
});

test("Google data OAuth exchanges a refresh token without exposing credentials", async () => {
  let requestBody = "";
  const token = await getGoogleDataAccessToken({
    CCPUN_GOOGLE_DATA_CLIENT_ID: "client-id",
    CCPUN_GOOGLE_DATA_CLIENT_SECRET: "client-secret",
    CCPUN_GOOGLE_DATA_REFRESH_TOKEN: "refresh-token",
  }, async (_input, init) => {
    requestBody = String(init?.body);
    return new Response(JSON.stringify({ access_token: "short-lived-access", expires_in: 3600 }), { status: 200 });
  });

  assert.equal(token, "short-lived-access");
  assert.match(requestBody, /grant_type=refresh_token/);
  assert.match(requestBody, /refresh_token=refresh-token/);
  await assert.rejects(() => getGoogleDataAccessToken({}, async () => new Response()), /GOOGLE_DATA_NOT_CONFIGURED/);
});
