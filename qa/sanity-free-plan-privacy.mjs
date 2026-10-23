import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const API_VERSION = "2026-08-20";
const OPERATIONAL_TYPES = [
  "auditLog",
  "publishSchedule",
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
    // Deleted with owner approval (2026-10-23 cleanup). "Dataset not found" is
    // the safest state; if it ever reappears it must still expose nothing.
    retired: true,
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

// Explicit owner-authorized public test records; every other UAT article stays private.
const UAT_FIXTURE_NUMBERS = Array.from({ length: 11 }, (_, index) => String(index + 1).padStart(2, "0"));
function isActiveUat(target) {
  return target.key === "active-uat" && target.projectId === "ccb9lnw5" && target.dataset === "uat";
}

export function buildBoundaryQuery(target) {
  const fixturePairs = UAT_FIXTURE_NUMBERS.map(number =>
    `(_id == "ccpun-uat-qa-article-20261023-${number}" && slug.current == "uat-qa-20261023-${number}" && "qa-marker-${number}" in tags)`,
  ).join(" || ");
  return `{
    "articles": count(*[_type == "article"]),
    "authors": count(*[_type == "author"]),
    "categories": count(*[_type == "category"]),
    "operational": count(*[_type in ${JSON.stringify(OPERATIONAL_TYPES)}]),
    "drafts": count(*[_id in path("drafts.**")]),
    "versions": count(*[_id in path("versions.**")])${isActiveUat(target) ? `,
    "approvedSyntheticArticles": count(*[_type == "article" && (${fixturePairs})
      && author._ref == "ccpun-uat-qa-author-20261023" && seo.noindex == true
      && "UAT QA" in tags && "ข้อมูลสังเคราะห์" in tags])` : ""}
  }`;
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
    if (isActiveUat(target)) {
      assert.ok(Number.isSafeInteger(result.approvedSyntheticArticles)
        && result.approvedSyntheticArticles >= 0 && result.approvedSyntheticArticles <= UAT_FIXTURE_NUMBERS.length,
      "INVALID_APPROVED_UAT_FIXTURE_COUNT");
      assert.equal(result.articles, result.approvedSyntheticArticles, "UNAPPROVED_PUBLIC_UAT_ARTICLE");
    } else {
      assert.equal(result.articles, 0, `PUBLIC_UAT_OR_RECOVERY_ARTICLE:${target.key}`);
    }
  }
  if (target.requireNoPublicEditorialMetadata) {
    assert.equal(result.authors, 0, `PUBLIC_RECOVERY_AUTHOR:${target.key}`);
    assert.equal(result.categories, 0, `PUBLIC_RECOVERY_CATEGORY:${target.key}`);
  }

  return result;
}

// A retired dataset passes only with Sanity's exact not-found answer for that
// project/dataset; any other non-200 answer still fails closed.
export function checkRetiredDataset(target, status, payload) {
  assert.equal(target?.retired, true, `NOT_A_RETIRED_TARGET:${target?.key}`);
  assert.equal(status, 404, `RETIRED_DATASET_UNEXPECTED_STATUS:${target.key}`);
  assert.equal(payload?.error, "Dataset not found", `RETIRED_DATASET_INVALID_DENIAL:${target.key}`);
  assert.equal(payload?.message, `Dataset "${target.dataset}" not found for project ID "${target.projectId}"`, `RETIRED_DATASET_INVALID_DENIAL:${target.key}`);
  return { retired: true, status };
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
  const results = [];
  for (const target of TARGETS) {
    for (const transport of target.transports) {
      const response = await requestJson(buildQueryUrl(target, transport, buildBoundaryQuery(target)));
      if (target.retired && response.status !== 200) {
        results.push({ target: target.key, transport, ...checkRetiredDataset(target, response.status, response.payload) });
        continue;
      }
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
