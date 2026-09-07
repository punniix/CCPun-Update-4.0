import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

// Read-only regression: no SDK, cookies, tokens, content writes or raw-body logging.
const PROJECT = "kyfxgjnq";
const DATASET = "production";
const API_VERSION = "2026-08-20";
const OPERATIONAL_TYPES = [
  "auditLog", "researchSnapshot", "seoSuggestion",
  "ubersuggestAccountSnapshot", "ubersuggestGeoSnapshot",
];
const AUDIT_IDS = [
  "auditLog.6a654701-9c85-4003-b1bd-5a3e08a6256e",
  "auditLog.7cafedec-9c80-4fc9-b5cb-19252344ac34",
  "auditLog.a0-remediation-80b5eb80-b531-46d9-9d96-c2f1fc094850",
  "auditLog.production-taxonomy-1780b963b58092194d71a61e",
];
const PRIVATE_KEYS = ["operational", "drafts", "versions"];

export function checkControl(payload) {
  assert.ok(Number.isSafeInteger(payload?.result) && payload.result > 0,
    "CONTROL_FAILED: published articles must be anonymously readable");
  return { publishedArticleCount: payload.result };
}

export function checkPrivateQuery(payload) {
  for (const key of PRIVATE_KEYS) {
    assert.equal(payload?.result?.[key], 0,
      `PRIVACY_FAILED_OR_INVALID_RESPONSE: ${key}`);
  }
  return { operational: 0, drafts: 0, versions: 0 };
}

export function checkPrivateDocument(status, payload) {
  if (status === 401 || status === 403 || status === 404) {
    assert.ok(payload?.error, "INVALID_DENIAL_RESPONSE");
    return { readable: false, status };
  }
  assert.equal(status, 200, "UNEXPECTED_DOCUMENT_STATUS");
  assert.ok(Array.isArray(payload?.documents), "INVALID_DOCUMENT_RESPONSE");
  assert.equal(payload.documents.length, 0, "PRIVATE_DOCUMENT_READABLE");
  return { readable: false, status };
}

export function buildQueryUrl(host, query) {
  assert.ok([`${PROJECT}.api.sanity.io`, `${PROJECT}.apicdn.sanity.io`].includes(host),
    "UNAPPROVED_HOST");
  const url = new URL(`https://${host}/v${API_VERSION}/data/query/${DATASET}`);
  url.searchParams.set("query", query);
  url.searchParams.set("perspective", "raw");
  return url;
}

async function requestJson(url) {
  let lastFailure;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "GET", credentials: "omit", redirect: "error",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status >= 500 || response.status === 429) {
        throw new Error("UPSTREAM_UNAVAILABLE");
      }
      assert.ok(response.headers.get("content-type")?.includes("json"),
        "NON_JSON_RESPONSE");
      return { status: response.status, payload: await response.json() };
    } catch {
      // Never echo response bodies, operational data, URLs or ambient credentials.
      lastFailure = new Error("ANONYMOUS_PROBE_TRANSPORT_OR_FORMAT_FAILURE");
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastFailure;
}

export async function main() {
  const results = [];
  const privateQuery = `{
    "operational": count(*[_type in ${JSON.stringify(OPERATIONAL_TYPES)}]),
    "drafts": count(*[_id in path("drafts.**")]),
    "versions": count(*[_id in path("versions.**")])
  }`;
  for (const transport of ["api", "apicdn"]) {
    const host = `${PROJECT}.${transport}.sanity.io`;
    const control = await requestJson(buildQueryUrl(host,
      'count(*[_type == "article" && !(_id in path("drafts.**")) && !(_id in path("versions.**"))])'));
    assert.equal(control.status, 200, "CONTROL_HTTP_FAILED");
    results.push({ transport, check: "public-control", ...checkControl(control.payload) });
    const hidden = await requestJson(buildQueryUrl(host, privateQuery));
    assert.equal(hidden.status, 200, "PRIVATE_QUERY_HTTP_FAILED");
    results.push({ transport, check: "private-query", ...checkPrivateQuery(hidden.payload) });
  }
  for (const [index, id] of AUDIT_IDS.entries()) {
    const url = new URL(`https://${PROJECT}.api.sanity.io/v${API_VERSION}/data/doc/${DATASET}/${encodeURIComponent(id)}`);
    const response = await requestJson(url);
    results.push({ check: `known-audit-document-${index + 1}`,
      ...checkPrivateDocument(response.status, response.payload) });
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(),
    projectId: PROJECT, dataset: DATASET, authenticated: false,
    status: "passed", results }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("Sanity anonymous privacy probe FAILED. Treat as unresolved; never infer safety from a transport error. Raw response intentionally omitted.");
    process.exitCode = 1;
  });
}
