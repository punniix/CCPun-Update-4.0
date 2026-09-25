import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const apiRoot = path.join(repositoryRoot, "app/api/admin");
const read = (relativePath: string) => readFileSync(path.join(repositoryRoot, relativePath), "utf8");

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(target);
    return entry.name === "route.ts" ? [path.relative(repositoryRoot, target)] : [];
  });
}

type RouteContract = {
  methods: Array<"GET" | "POST" | "DELETE">;
  identity: RegExp;
  authorization: RegExp;
  validation: { file: string; pattern: RegExp; exception?: string };
};

const contracts: Record<string, RouteContract> = {
  "app/api/admin/content/[id]/preview/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"draft:apply"/,
    validation: { file: "app/api/admin/content/[id]/preview/route.ts", pattern: /articleIdSchema\.safeParse/, },
  },
  "app/api/admin/content/[id]/schedule/route.ts": {
    methods: ["GET", "POST", "DELETE"], identity: /getAdminIdentity\(\)/, authorization: /"content:schedule"/,
    validation: { file: "app/api/admin/content/[id]/schedule/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, exception: "Owner-only GET reads one deterministic schedule; POST validates Bangkok datetime JSON; DELETE cancels server-owned schedule state. Same-origin mutation protection is enforced centrally by the Admin proxy." },
  },
  "app/api/admin/content/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"content:read"/,
    validation: { file: "app/api/admin/content/route.ts", pattern: /export async function GET\(\)/, exception: "No request input." },
  },
  "app/api/admin/media/route.ts": {
    methods: ["GET", "POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "app/api/admin/media/route.ts", pattern: /validateGoogleDriveProjectionHttpRequest\(\{[\s\S]*body,[\s\S]*\}\)/, exception: "Sensitive GET uses configured-origin validation; manual Drive POST uses strict JSON plus same-origin validation." },
  },
  "app/api/admin/media/upload-intents/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"media:upload"/,
    validation: { file: "app/api/admin/media/upload-intents/route.ts", pattern: /validateMediaUploadIntentHttpRequest\(\{[\s\S]*body,[\s\S]*\}\)/, },
  },
  "app/api/admin/providers/ubersuggest/callback/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "lib/admin/ubersuggest.ts", pattern: /isUbersuggestAuthorizationStateValid/, exception: "OAuth callback GET uses state validation instead of the mutation Origin header." },
  },
  "app/api/admin/providers/ubersuggest/connect/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "app/api/admin/providers/ubersuggest/connect/route.ts", pattern: /export async function POST\(\)/, exception: "No request body; provider state is generated server-side." },
  },
  "app/api/admin/providers/ubersuggest/sync/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"research:provider-query"/,
    validation: { file: "app/api/admin/providers/ubersuggest/sync/route.ts", pattern: /requestSchema\.safeParse\(raw\)/, exception: "Provider sync defaults to server-owned selection; reviewed AISV import accepts only strict bounded UAT JSON and exact same-origin human requests." },
  },
  "app/api/admin/research/route.ts": {
    methods: ["GET", "POST"], identity: /getAdminIdentity\(\)/, authorization: /"research:read"[\s\S]*action: "research:create"/,
    validation: { file: "app/api/admin/research/route.ts", pattern: /manualResearchInputSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "app/api/admin/research/ubersuggest/import/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"research:read"[\s\S]*action: "research:create"/,
    validation: { file: "app/api/admin/research/ubersuggest/import/route.ts", pattern: /requestSchema\.safeParse[\s\S]*parseUbersuggestKeywordIdeasCsv/, },
  },
  "app/api/admin/research/ubersuggest/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"research:provider-query"/,
    validation: { file: "app/api/admin/research/ubersuggest/route.ts", pattern: /inputSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "app/api/admin/reviews/[id]/apply/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /action: "draft:apply"/,
    validation: { file: "lib/admin/sanity-control.ts", pattern: /applyApprovedSeoSuggestion[\s\S]*parseSuggestionDocumentId\(input\.id\)/, },
  },
  "app/api/admin/reviews/[id]/approve/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /action: "review:approve"/,
    validation: { file: "lib/admin/sanity-control.ts", pattern: /approveSeoSuggestion[\s\S]*parseSuggestionDocumentId\(input\.id\)/, },
  },
  "app/api/admin/reviews/[id]/edit/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /action: "review:edit"/,
    validation: { file: "app/api/admin/reviews/[id]/edit/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "app/api/admin/reviews/[id]/reject/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /action: "review:reject"/,
    validation: { file: "app/api/admin/reviews/[id]/reject/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "app/api/admin/reviews/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"reviews:read"/,
    validation: { file: "app/api/admin/reviews/route.ts", pattern: /export async function GET\(\)/, exception: "No request input." },
  },
  "app/api/admin/seo/audit/[id]/proposals/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /action: "proposal:create"/,
    validation: { file: "lib/admin/seo-audit.ts", pattern: /getSeoProposalContext[\s\S]*parseArticleDocumentId\(articleId\)/, },
  },
  "app/api/admin/seo/audit/[id]/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /action: "seo:audit"/,
    validation: { file: "lib/admin/seo-audit.ts", pattern: /runSeoAudit[\s\S]*parseArticleDocumentId\(articleId\)/, },
  },
  "app/api/admin/seo/opportunities/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"seo:read"/,
    validation: { file: "app/api/admin/seo/opportunities/route.ts", pattern: /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/, exception: "Sensitive GET adds an exact configured-origin check." },
  },
  "app/api/admin/seo/opportunities/sync/ga4/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"research:provider-query"/,
    validation: { file: "app/api/admin/seo/opportunities/sync/ga4/route.ts", pattern: /inputSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "app/api/admin/seo/opportunities/sync/gsc/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"research:provider-query"/,
    validation: { file: "app/api/admin/seo/opportunities/sync/gsc/route.ts", pattern: /inputSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "app/api/admin/seo/providers/readiness/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"seo:read"/,
    validation: { file: "app/api/admin/seo/providers/readiness/route.ts", pattern: /seoGoogleProviderSchema\.safeParse/, exception: "Sensitive GET validates the provider and returns no values." },
  },
  "app/api/admin/seo/suggestions/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /action: "proposal:create"/,
    validation: { file: "app/api/admin/seo/suggestions/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "app/api/admin/session/route.ts": {
    methods: ["GET"], identity: /await auth\(\)/, authorization: /const role = session\?\.user\?\.role \?\? null;[\s\S]*if \(!role\)/,
    validation: { file: "app/api/admin/session/route.ts", pattern: /export async function GET\(\)/, exception: "Auth.js session read has no request input." },
  },
  "app/api/admin/social/foundation/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "app/api/admin/social/foundation/route.ts", pattern: /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/, exception: "Sensitive GET adds an exact configured-origin check." },
  },
  "app/api/admin/social/analytics/backfill/meta-insights/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "app/api/admin/social/analytics/backfill/meta-insights/route.ts", pattern: /isSameOriginAdminMutation\(request\.url, request\.headers\.get\(\"origin\"\)\)/, exception: "No request body; the next bounded unprocessed batch is server-owned." },
  },
  "app/api/admin/social/analytics/post-live/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "app/api/admin/social/analytics/post-live/route.ts", pattern: /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/, exception: "Sensitive GET adds an exact configured-origin check." },
  },
  "app/api/admin/social/analytics/sync/[provider]/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "app/api/admin/social/analytics/sync/[provider]/route.ts", pattern: /socialAnalyticsProviderSchema\.safeParse\(\(await context\.params\)\.provider\)/, exception: "No request body; provider path is allowlisted and the UAT database is server-owned." },
  },
  "app/api/admin/social/operations/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "app/api/admin/social/operations/route.ts", pattern: /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/, exception: "Sensitive GET adds an exact configured-origin check." },
  },
  "app/api/admin/social/drafts/route.ts": {
    methods: ["GET", "POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "app/api/admin/social/drafts/route.ts", pattern: /socialDraftRequestSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "app/api/admin/social/export/sheets/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "app/api/admin/social/export/sheets/route.ts", pattern: /socialSheetsExportRequestSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "app/api/admin/social/publications/route.ts": {
    methods: ["GET", "POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"[\s\S]*identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "app/api/admin/social/publications/route.ts", pattern: /socialPublicationApprovalRequestSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "app/api/admin/social/publications/execute/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "app/api/admin/social/publications/execute/route.ts", pattern: /socialPublicationExecuteRequestSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "app/api/admin/social/providers/meta/capabilities/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "app/api/admin/social/providers/meta/capabilities/route.ts", pattern: /isSameOriginAdminMutation\(request\.url, request\.headers\.get\(\"origin\"\)\)/, exception: "No request body; capability targets and provider credentials are server-owned." },
  },
  "app/api/admin/social/providers/meta/connection/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "app/api/admin/social/providers/meta/connection/route.ts", pattern: /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/, exception: "Sensitive GET adds an exact configured-origin check." },
  },
  "app/api/admin/social/providers/meta/audio/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "app/api/admin/social/providers/meta/audio/route.ts", pattern: /instagramAudioSearchInputSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "app/api/admin/social/providers/meta/discovery/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "app/api/admin/social/providers/meta/discovery/route.ts", pattern: /isSameOriginAdminMutation\(request\.url, request\.headers\.get\("origin"\)\)/, exception: "No request body; provider selection is server-owned." },
  },
  "app/api/admin/social/providers/meta/handoff/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "app/api/admin/social/providers/meta/handoff/route.ts", pattern: /googleDriveSelectedFileRequestSchema\.safeParse/, },
  },
  "app/api/admin/social/providers/tiktok/discovery/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "app/api/admin/social/providers/tiktok/discovery/route.ts", pattern: /isSameOriginAdminMutation\(request\.url, request\.headers\.get\("origin"\)\)/, exception: "No request body; provider selection is server-owned." },
  },
  "app/api/admin/social/providers/youtube/discovery/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "app/api/admin/social/providers/youtube/discovery/route.ts", pattern: /isSameOriginAdminMutation\(request\.url, request\.headers\.get\("origin"\)\)/, exception: "No request body; provider selection is server-owned." },
  },
};

test("every Admin API route has an explicit reviewed contract", () => {
  assert.deepEqual(routeFiles(apiRoot).sort(), Object.keys(contracts).sort());
});

test("Admin routes retain identity, authorization, and request validation coverage", () => {
  for (const [route, contract] of Object.entries(contracts)) {
    const source = read(route);
    assert.deepEqual([...source.matchAll(/export async function (GET|POST|DELETE)/g)].map((match) => match[1]), contract.methods, route);
    assert.match(source, contract.identity, `${route}: identity`);
    assert.match(source, contract.authorization, `${route}: authorization`);
    assert.match(read(contract.validation.file), contract.validation.pattern, `${route}: validation${contract.validation.exception ? ` (${contract.validation.exception})` : ""}`);
  }
});

test("proxy applies exact same-origin protection to every Admin mutation", () => {
  const proxy = read("proxy.ts");
  assert.match(proxy, /const isAdminApi = isAdminApiPath\(pathname\)/);
  assert.match(proxy, /!\["GET", "HEAD", "OPTIONS"\]\.includes\(request\.method\)/);
  assert.match(proxy, /!isSameOriginAdminMutation\(request\.url, request\.headers\.get\("origin"\)\)/);
  assert.match(proxy, /return NextResponse\.json\(\{ error: "invalid-origin" \}, \{ status: 403 \}\)/);
  assert.match(proxy, /"\/api\/admin\/:path\*"/);
  assert.match(proxy, /"\/api\/snt-admin\/:path\*"/);
});
