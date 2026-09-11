import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const API_VERSION = "2026-08-20";
const OPERATIONAL_TYPES = [
  "auditLog",
  "researchSnapshot",
  "seoSuggestion",
  "ubersuggestAccountSnapshot",
  "ubersuggestGeoSnapshot",
];

export const TARGETS = [
  {
    key: "production",
    projectId: "kyfxgjnq",
    dataset: "production",
    transports: ["api", "apicdn"],
    requirePublishedArticles: true,
    requireNoPublishedArticles: false,
    requireNoPublicEditorialMetadata: false,
  },
  {
    key: "active-uat",
    projectId: "ccb9lnw5",
    dataset: "uat",
    transports: ["api", "apicdn"],
    requirePublishedArticles: false,
    requireNoPublishedArticles: true,
    requireNoPublicEditorialMetadata: false,
  },
  {
    key: "legacy-uat",
    projectId: "kyfxgjnq",
    dataset: "uat",
    transports: ["api", "apicdn"],
    requirePublishedArticles: false,
    requireNoPublishedArticles: true,
    requireNoPublicEditorialMetadata: false,
  },
  {
    key: "recovery-placeholder",
    projectId: "ccb9lnw5",
    dataset: "recovery",
    transports: ["api", "apicdn"],
    requirePublishedArticles: false,
    requireNoPublishedArticles: true,
    requireNoPublicEditorialMetadata: true,
  },
];

const KNOWN_FORMERLY_PUBLIC_OPERATIONAL_IDS = [
  { projectId: "ccb9lnw5", dataset: "uat", id: "PRE3q7eScK0PyOENLK4lnx" },
  { projectId: "ccb9lnw5", dataset: "uat", id: "nmeDT4bEHD3BvK9bccGxL0" },
  { projectId: "ccb9lnw5", dataset: "uat", id: "PRE3q7eScK0PyOENLK9eYN" },
  { projectId: "kyfxgjnq", dataset: "uat", id: "PRE3q7eScK0PyOENLK4lnx" },
  { projectId: "kyfxgjnq", dataset: "uat", id: "nmeDT4bEHD3BvK9bccGxL0" },
  { projectId: "kyfxgjnq", dataset: "uat", id: "PRE3q7eScK0PyOENLK9eYN" },
];

export function buildQueryUrl(target, transport, query) {
  assert.ok(TARGETS.some((candidate) =>
    candidate.projectId === target.projectId && candidate.dataset === target.dataset), "UNAPPROVED_TARGET");
  assert.ok(["api", "apicdn"].includes(transport), "UNAPPROVED_TRANSPORT");
  const url = new URL(`https://${target.projectId}.${transport}.sanity.io/v${API_VERSION}/data/query/${target.dataset}`);
  url.searchParams.set("query", query);
  url.searchParams.set("perspective", "raw");
  return url;
}

export function buildDocumentUrl(projectId, dataset, id) {
  assert.ok(TARGETS.some((target) => target.projectId === projectId && target.dataset === dataset), "UNAPPROVED_TARGET");
  const url = new URL(`https://${projectId}.api.sanity.io/v${API_VERSION}/data/doc/${dataset}/${encodeURIComponent(id)}`);
  return url;
}

export function checkBoundary(target, payload) {
  const result = payload?.result;
  for (const key of ["articles", "authors", "categories", "operational", "drafts", "versions"]) {
    assert.ok(Number.isSafeInteger(result?.[key]) && result[key] >= 0, `INVALID_COUNT:${target.key}:${key}`);
  }

  assert.equal(result.operational, 0, `PUBLIC_OPERATIONAL_DATA:${target.key}`);
  assert.equal(result.drafts, 0, `PUBLIC_DRAFTS:${target.key}`);
  assert.equal(result.versions, 0, `PUBLIC_RELEASE_VERSIONS:${target.key}`);

  if (target.requirePublishedArticles) {
    assert.ok(result.articles > 0, `MISSING_PUBLIC_ARTICLE_CONTROL:${target.key}`);
  }
  if (target.requireNoPublishedArticles) {
    assert.equal(result.articles, 0, `PUBLIC_UAT_OR_RECOVERY_ARTICLE:${target.key}`);
  }
  if (target.requireNoPublicEditorialMetadata) {
    assert.equal(result.authors, 0, `PUBLIC_RECOVERY_AUTHOR:${target.key}`);
    assert.equal(result.categories, 0, `PUBLIC_RECOVERY_CATEGORY:${target.key}`);
  }

  return result;
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

async function requestJson(url) {
  let lastFailure;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "omit",
        redirect: "error",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status >= 500 || response.status === 429) throw new Error("UPSTREAM_UNAVAILABLE");
      assert.ok(response.headers.get("content-type")?.includes("json"), "NON_JSON_RESPONSE");
      return { status: response.status, payload: await response.json() };
    } catch {
      lastFailure = new Error("ANONYMOUS_PROBE_TRANSPORT_OR_FORMAT_FAILURE");
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastFailure;
}

export async function main() {
  const query = `{
    "articles": count(*[_type == "article"]),
    "authors": count(*[_type == "author"]),
    "categories": count(*[_type == "category"]),
    "operational": count(*[_type in ${JSON.stringify(OPERATIONAL_TYPES)}]),
    "drafts": count(*[_id in path("drafts.**")]),
    "versions": count(*[_id in path("versions.**")])
  }`;

  const results = [];
  for (const target of TARGETS) {
    for (const transport of target.transports) {
      const response = await requestJson(buildQueryUrl(target, transport, query));
      assert.equal(response.status, 200, `PUBLIC_DATASET_HTTP_FAILED:${target.key}:${transport}`);
      results.push({ target: target.key, transport, ...checkBoundary(target, response.payload) });
    }
  }

  for (const candidate of KNOWN_FORMERLY_PUBLIC_OPERATIONAL_IDS) {
    const response = await requestJson(buildDocumentUrl(candidate.projectId, candidate.dataset, candidate.id));
    results.push({
      target: `${candidate.projectId}/${candidate.dataset}`,
      check: `former-operational-id:${candidate.id}`,
      ...checkPrivateDocument(response.status, response.payload),
    });
  }

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    authenticated: false,
    status: "passed",
    results,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("Sanity Free-plan privacy probe FAILED. Treat the privacy boundary as unresolved; raw responses are intentionally omitted.");
    process.exitCode = 1;
  });
}
