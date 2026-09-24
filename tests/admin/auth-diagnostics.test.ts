import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminAuthDiagnostic,
  shouldObserveAdminAuthExchange,
} from "../../lib/admin/auth-diagnostics";

test("Auth diagnostics expose callback boundary evidence without cookie values", () => {
  const namespace = "__Secure-ccpun-admin.authjs";
  const secretPkce = "very-secret-pkce-value";
  const secretState = "very-secret-state-value";
  const request = new Request("https://admin.ccpun.com/api/auth/callback/google?code=secret-code", {
    headers: {
      host: "admin.ccpun.com",
      "x-forwarded-host": "admin.ccpun.com",
      "x-forwarded-proto": "https",
      cookie: [
        namespace + ".pkce.code_verifier=" + secretPkce,
        namespace + ".state=" + secretState,
        namespace + ".callback-url=https%3A%2F%2Fadmin.ccpun.com%2Fdashboard%2F",
      ].join("; "),
    },
  });
  const response = new Response(null, {
    status: 302,
    headers: { location: "https://admin.ccpun.com/dashboard/" },
  });

  const diagnostic = buildAdminAuthDiagnostic({
    request,
    response,
    environment: "production-admin",
    authUrl: "https://admin.ccpun.com/",
    cookieNamespace: namespace,
  });

  assert.equal(diagnostic.event, "callback");
  assert.equal(diagnostic.configuredOriginMatch, true);
  assert.equal(diagnostic.cookiePresence.pkce, true);
  assert.equal(diagnostic.cookiePresence.state, true);
  assert.equal(diagnostic.redirectOriginMatchesRequest, true);

  const serialized = JSON.stringify(diagnostic);
  assert.doesNotMatch(serialized, /very-secret|secret-code|dashboard%2F/);
});

test("Auth diagnostics reveal an alias/custom-domain mismatch without trusting the alias", () => {
  const request = new Request("https://ccpun-admin-example.vercel.app/api/auth/callback/google");
  const diagnostic = buildAdminAuthDiagnostic({
    request,
    response: new Response(null, {
      status: 302,
      headers: { location: "https://admin.ccpun.com/login/?error=Configuration" },
    }),
    environment: "production-admin",
    authUrl: "https://admin.ccpun.com/",
    cookieNamespace: "__Secure-ccpun-admin.authjs",
  });

  assert.equal(diagnostic.configuredOriginMatch, false);
  assert.equal(diagnostic.redirectHasError, true);
  assert.equal(diagnostic.redirectOriginMatchesRequest, false);
});

test("Auth diagnostics observe callbacks and failures but ignore ordinary successful session reads", () => {
  assert.equal(
    shouldObserveAdminAuthExchange(
      new Request("https://admin.ccpun.com/api/auth/callback/google"),
      new Response(null, { status: 302 }),
    ),
    true,
  );
  assert.equal(
    shouldObserveAdminAuthExchange(
      new Request("https://admin.ccpun.com/api/auth/session"),
      new Response("{}", { status: 200 }),
    ),
    false,
  );
  assert.equal(
    shouldObserveAdminAuthExchange(
      new Request("https://admin.ccpun.com/api/auth/session"),
      new Response("{}", { status: 500 }),
    ),
    true,
  );
});
