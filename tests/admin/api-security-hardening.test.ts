import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { safeAuditJson } from "../../lib/admin/audit-sanitizer";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("audit before/after keeps only approved fields and drops credential-shaped data", () => {
  const serialized = safeAuditJson({
    status: "approved",
    field: "seo.title",
    valuePresent: true,
    value: "Draft SEO content must not be logged",
    token: "token-value",
    secret: "secret-value",
    cookie: "cookie-value",
    authorization: "Bearer credential",
    keyword: "customer@example.com token=keyword-secret",
    domain: "customer-account.example",
    opportunities: "Bearer provider-response",
    rawProviderResponse: { accessToken: "nested-token", result: "raw" },
  });

  assert.deepEqual(JSON.parse(serialized ?? "null"), {
    status: "approved",
    field: "seo.title",
    valuePresent: true,
  });
  assert.equal(safeAuditJson({ unknown: "raw", token: "secret" }), undefined);
  assert.equal(safeAuditJson("raw unknown payload"), undefined);
  assert.deepEqual(JSON.parse(safeAuditJson({ reasonPresent: true, reason: "private reviewer note" }) ?? "null"), { reasonPresent: true });
});

test("approve and apply validate bounded Sanity document IDs before data access", () => {
  const source = read("lib/admin/sanity-control.ts");
  const approveRoute = read("app/api/snt-admin/reviews/[id]/approve/route.ts");
  const applyRoute = read("app/api/snt-admin/reviews/[id]/apply/route.ts");
  assert.match(source, /const documentIdSchema = z\.string\(\)\.min\(1\)\.max\(200\)\.regex\(\/\^\[A-Za-z0-9_\.\-\]\+\$\/\)/);
  assert.match(source, /suggestionDocumentIdSchema = documentIdSchema\.regex\([\s\S]*?seoSuggestion/);
  assert.match(source, /approveSeoSuggestion[\s\S]*?const parsedId = parseSuggestionDocumentId\(input\.id\);[\s\S]*?requireWriteClient\(\)/);
  assert.match(source, /applyApprovedSeoSuggestion[\s\S]*?const parsedId = parseSuggestionDocumentId\(input\.id\);[\s\S]*?requireWriteClient\(\)/);
  assert.doesNotMatch(source, /workflowDocumentId\(z\.string\(\)\.min\(1\)\.parse\(input\.id\)/);
  assert.match(approveRoute, /INVALID_SUGGESTION_ID[\s\S]*?invalid-suggestion-id[\s\S]*?status: 400/);
  assert.match(applyRoute, /INVALID_SUGGESTION_ID[\s\S]*?invalid-suggestion-id[\s\S]*?status: 400/);
});

test("SEO audit and proposal routes validate bounded article IDs before data access", () => {
  const source = read("lib/admin/seo-audit.ts");
  const auditRoute = read("app/api/snt-admin/seo/audit/[id]/route.ts");
  const proposalRoute = read("app/api/snt-admin/seo/audit/[id]/proposals/route.ts");

  assert.match(source, /const articleDocumentIdSchema = z\.string\(\)\.min\(1\)\.max\(200\)\.regex\(\/\^\[A-Za-z0-9_\.\-\]\+\$\/\)/);
  assert.match(source, /runSeoAudit[\s\S]*?const cleanId = parseArticleDocumentId\(articleId\);[\s\S]*?readClient\.fetch/);
  assert.match(source, /getSeoProposalContext[\s\S]*?const cleanId = parseArticleDocumentId\(articleId\);[\s\S]*?readClient\.fetch/);
  assert.match(auditRoute, /INVALID_ARTICLE_ID[\s\S]*?invalid-article-id[\s\S]*?status: 400/);
  assert.match(proposalRoute, /INVALID_ARTICLE_ID[\s\S]*?invalid-article-id[\s\S]*?status: 400/);
});

test("Preview disable is a same-origin POST and every current caller uses POST", () => {
  const route = read("app/api/preview/disable/route.ts");
  const proxy = read("proxy.ts");
  const article = read("features/blog/pages/ArticlePage.tsx");
  const qa = read("qa/blog-uat-regression.mjs");
  const sanityConfig = read("sanity.config.ts");

  assert.match(route, /export async function POST\(request: Request\)/);
  assert.doesNotMatch(route, /export async function GET/);
  assert.match(route, /NextResponse\.redirect\([^;]+, 303\)/);
  assert.match(proxy, /\(isAdminApi \|\| isPreviewApi\)[\s\S]*?!\["GET", "HEAD", "OPTIONS"\]\.includes\(request\.method\)/);
  assert.match(article, /IS_DRAFT_PREVIEW_ALLOWED && isEnabled/);
  assert.match(read("features/blog/website-43/Website43Article.tsx"), /<form action="\/api\/preview\/disable\/" method="post">/);
  assert.match(qa, /const disableResponse = await evaluate[\s\S]*?fetch\(["']\/api\/preview\/disable\/["'], \{ method: ["']POST["'] \}\)/);
  assert.match(qa, /!disableResponse\?\.ok \|\| disableResponse\.pathname !== ["']\/blog\/["']/);
  assert.doesNotMatch(sanityConfig, /disable:\s*["']\/api\/preview\/disable/);
});

test("Article writes stay in Sanity while operational records use the private Neon plane", () => {
  const lifecycle = read("lib/admin/suggestion-lifecycle.ts");
  const control = read("lib/admin/sanity-control.ts");
  const research = read("lib/admin/research.ts");
  const dashboard = read("lib/admin/ubersuggest-dashboard.ts");
  const seoAudit = read("lib/admin/seo-audit.ts");
  const database = read("lib/admin/operations/database.ts");

  assert.match(lifecycle, /function privateAdminDocumentId[\s\S]*?return `drafts\.\$\{cleanId\}`/);
  assert.match(control, /suggestionId = privateAdminDocumentId\(baseSuggestionId\)/);
  assert.match(research, /createAdminResearchSnapshot/);
  assert.doesNotMatch(research, /_type:\s*"researchSnapshot"/);
  assert.match(dashboard, /accountId = privateAdminDocumentId\(/);
  assert.match(dashboard, /geoId = privateAdminDocumentId\(/);
  assert.match(database, /ccpun_admin\.audit_log/);
  assert.match(database, /ccpun_admin\.seo_suggestion/);
  assert.doesNotMatch(seoAudit, /workflowDocumentId/);
  assert.doesNotMatch(control, /_type:\s*"(?:auditLog|seoSuggestion)"/);
});

test("human edit and reject decisions are validated, authorized, revision-guarded, and audited", () => {
  const control = read("lib/admin/sanity-control.ts");
  const editRoute = read("app/api/snt-admin/reviews/[id]/edit/route.ts");
  const rejectRoute = read("app/api/snt-admin/reviews/[id]/reject/route.ts");
  const page = read("app/snt-admin/(protected)/reviews/page.tsx");
  const schema = read("cms/sanity/admin/schema/admin-types.ts");

  assert.match(control, /reviewDecisionSchema = z\.discriminatedUnion/);
  assert.match(control, /parseSuggestionDocumentId\(input\.id\)/);
  assert.match(control, /decideAdminSeoSuggestion/);
  assert.match(read("lib/admin/operations/database.ts"), /row_version=\s*row_version\+1/);
  assert.match(control, /seo-suggestion:edit/);
  assert.match(control, /seo-suggestion:reject/);
  assert.match(editRoute, /bodySchema\.safeParse/);
  assert.match(editRoute, /action: "review:edit"/);
  assert.match(rejectRoute, /bodySchema\.safeParse/);
  assert.match(rejectRoute, /action: "review:reject"/);
  assert.match(page, /ReviewDecisionControls/);
  assert.match(schema, /value: "rejected"/);
  assert.match(schema, /name: "rejectionReason"/);
});

test("Admin APIs do not expose internal authorization reasons", () => {
  for (const route of [
    "app/api/snt-admin/reviews/[id]/approve/route.ts",
    "app/api/snt-admin/reviews/[id]/apply/route.ts",
    "app/api/snt-admin/seo/suggestions/route.ts",
    "app/api/snt-admin/seo/audit/[id]/route.ts",
    "app/api/snt-admin/seo/audit/[id]/proposals/route.ts",
    "app/api/snt-admin/research/route.ts",
  ]) assert.doesNotMatch(read(route), /reason: (?:policy\.reason|error\.message)/);
});
