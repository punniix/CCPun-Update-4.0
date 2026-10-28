import { readPhase1Source } from "../../qa/read-phase1-source.mjs";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const apiRoot = path.join(repositoryRoot, "apps/admin/app/api/admin");
const owners = new Map<string, string>(
  (JSON.parse(readFileSync(path.join(repositoryRoot, "qa/root-runtime-owner-migration.json"), "utf8")).pairs as Array<{ legacy: string; canonical: string }>)
    .map(({ legacy, canonical }) => [legacy, canonical]),
);
const read = (relativePath: string) => readPhase1Source(owners.get(relativePath) ?? relativePath);

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(target);
    return entry.name === "route.ts" ? [path.relative(repositoryRoot, target)] : [];
  });
}

type RouteContract = {
  methods: Array<"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS">;
  identity: RegExp;
  authorization: RegExp;
  validation: { file: string; pattern: RegExp; exception?: string };
};

const contracts: Record<string, RouteContract> = {
  "apps/admin/app/api/admin/content/[id]/preview/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"draft:apply"/,
    validation: { file: "apps/admin/app/api/admin/content/[id]/preview/route.ts", pattern: /articleIdSchema\.safeParse/, },
  },
  "apps/admin/app/api/admin/content/[id]/schedule/route.ts": {
    methods: ["GET", "POST", "DELETE"], identity: /getAdminIdentity\(\)/, authorization: /"content:schedule"/,
    validation: { file: "apps/admin/app/api/admin/content/[id]/schedule/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, exception: "Owner-only GET reads one deterministic schedule; POST validates Bangkok datetime JSON; DELETE cancels server-owned schedule state. Same-origin mutation protection is enforced centrally by the Admin proxy." },
  },
  "apps/admin/app/api/admin/content/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"content:read"/,
    validation: { file: "apps/admin/app/api/admin/content/route.ts", pattern: /export async function GET\(\)/, exception: "No request input." },
  },
  "apps/admin/app/api/admin/media/route.ts": {
    methods: ["GET", "POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "apps/admin/app/api/admin/media/route.ts", pattern: /validateGoogleDriveProjectionHttpRequest\(\{[\s\S]*body,[\s\S]*\}\)/, exception: "Sensitive GET uses configured-origin validation; manual Drive POST uses strict JSON plus same-origin validation." },
  },
  "apps/admin/app/api/admin/media/upload-intents/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"media:upload"/,
    validation: { file: "apps/admin/app/api/admin/media/upload-intents/route.ts", pattern: /validateMediaUploadIntentHttpRequest\(\{[\s\S]*body,[\s\S]*\}\)/, },
  },
  "apps/admin/app/api/admin/providers/ubersuggest/callback/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "lib/admin/ubersuggest.ts", pattern: /isUbersuggestAuthorizationStateValid/, exception: "OAuth callback GET uses state validation instead of the mutation Origin header." },
  },
  "apps/admin/app/api/admin/providers/ubersuggest/connect/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "apps/admin/app/api/admin/providers/ubersuggest/connect/route.ts", pattern: /export async function POST\(\)/, exception: "No request body; provider state is generated server-side." },
  },
  "apps/admin/app/api/admin/providers/ubersuggest/sync/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"research:provider-query"/,
    validation: { file: "apps/admin/app/api/admin/providers/ubersuggest/sync/route.ts", pattern: /export async function POST\(\)/, exception: "Canonical provider sync accepts no request input; reviewed import remains separately guarded in the retained legacy handler." },
  },
  "apps/admin/app/api/admin/research/route.ts": {
    methods: ["GET", "POST"], identity: /getAdminIdentity\(\)/, authorization: /"research:read"[\s\S]*action: "research:create"/,
    validation: { file: "apps/admin/app/api/admin/research/route.ts", pattern: /manualResearchInputSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/research/ubersuggest/import/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"research:read"[\s\S]*action: "research:create"/,
    validation: { file: "apps/admin/app/api/admin/research/ubersuggest/import/route.ts", pattern: /requestSchema\.safeParse[\s\S]*parseUbersuggestKeywordCsv/, },
  },
  "apps/admin/app/api/admin/research/ubersuggest/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"research:provider-query"/,
    validation: { file: "apps/admin/app/api/admin/research/ubersuggest/route.ts", pattern: /inputSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/reviews/[id]/apply/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /action: "draft:apply"/,
    validation: { file: "lib/admin/sanity-control.ts", pattern: /applyApprovedSeoSuggestion[\s\S]*parseSuggestionDocumentId\(input\.id\)/, },
  },
  "apps/admin/app/api/admin/reviews/[id]/approve/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /action: "review:approve"/,
    validation: { file: "lib/admin/sanity-control.ts", pattern: /approveSeoSuggestion[\s\S]*parseSuggestionDocumentId\(input\.id\)/, },
  },
  "apps/admin/app/api/admin/reviews/[id]/edit/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /action: "review:edit"/,
    validation: { file: "apps/admin/app/api/admin/reviews/[id]/edit/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/reviews/[id]/reject/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /action: "review:reject"/,
    validation: { file: "apps/admin/app/api/admin/reviews/[id]/reject/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/reviews/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"reviews:read"/,
    validation: { file: "apps/admin/app/api/admin/reviews/route.ts", pattern: /export async function GET\(\)/, exception: "No request input." },
  },
  "apps/admin/app/api/admin/seo/audit/[id]/proposals/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /action: "proposal:create"/,
    validation: { file: "lib/admin/seo-audit.ts", pattern: /getSeoProposalContext[\s\S]*parseArticleDocumentId\(articleId\)/, },
  },
  "apps/admin/app/api/admin/seo/audit/[id]/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /action: "seo:audit"/,
    validation: { file: "lib/admin/seo-audit.ts", pattern: /runSeoAudit[\s\S]*parseArticleDocumentId\(articleId\)/, },
  },
  "apps/admin/app/api/admin/seo/opportunities/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"seo:read"/,
    validation: { file: "apps/admin/app/api/admin/seo/opportunities/route.ts", pattern: /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/, exception: "Sensitive GET adds an exact configured-origin check." },
  },
  "apps/admin/app/api/admin/seo/opportunities/sync/ga4/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"research:provider-query"/,
    validation: { file: "apps/admin/app/api/admin/seo/opportunities/sync/ga4/route.ts", pattern: /inputSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/seo/opportunities/sync/gsc/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"research:provider-query"/,
    validation: { file: "apps/admin/app/api/admin/seo/opportunities/sync/gsc/route.ts", pattern: /inputSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/seo/providers/readiness/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"seo:read"/,
    validation: { file: "apps/admin/app/api/admin/seo/providers/readiness/route.ts", pattern: /seoGoogleProviderSchema\.safeParse/, exception: "Sensitive GET validates the provider and returns no values." },
  },
  "apps/admin/app/api/admin/seo/suggestions/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /action: "proposal:create"/,
    validation: { file: "apps/admin/app/api/admin/seo/suggestions/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/session/route.ts": {
    methods: ["GET"], identity: /await auth\(\)/, authorization: /const role = session\?\.user\?\.role \?\? null;[\s\S]*if \(!role\)/,
    validation: { file: "apps/admin/app/api/admin/session/route.ts", pattern: /export async function GET\(\)/, exception: "Auth.js session read has no request input." },
  },
  "apps/admin/app/api/admin/social/foundation/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "apps/admin/app/api/admin/social/foundation/route.ts", pattern: /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/, exception: "Sensitive GET adds an exact configured-origin check." },
  },
  "apps/admin/app/api/admin/social/analytics/backfill/meta-insights/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "apps/admin/app/api/admin/social/analytics/backfill/meta-insights/route.ts", pattern: /isSameOriginAdminMutation\(request\.url, request\.headers\.get\(\"origin\"\)\)/, exception: "No request body; the next bounded unprocessed batch is server-owned." },
  },
  "apps/admin/app/api/admin/social/analytics/post-live/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "apps/admin/app/api/admin/social/analytics/post-live/route.ts", pattern: /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/, exception: "Sensitive GET adds an exact configured-origin check." },
  },
  "apps/admin/app/api/admin/social/analytics/sync/[provider]/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "apps/admin/app/api/admin/social/analytics/sync/[provider]/route.ts", pattern: /socialAnalyticsProviderSchema\.safeParse\(\(await context\.params\)\.provider\)/, exception: "No request body; provider path is allowlisted and the UAT database is server-owned." },
  },
  "apps/admin/app/api/admin/social/operations/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "apps/admin/app/api/admin/social/operations/route.ts", pattern: /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/, exception: "Sensitive GET adds an exact configured-origin check." },
  },
  "apps/admin/app/api/admin/social/drafts/route.ts": {
    methods: ["GET", "POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "apps/admin/app/api/admin/social/drafts/route.ts", pattern: /socialDraftRequestSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/social/export/sheets/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "apps/admin/app/api/admin/social/export/sheets/route.ts", pattern: /socialSheetsExportRequestSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/social/publications/route.ts": {
    methods: ["GET", "POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"[\s\S]*identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "apps/admin/app/api/admin/social/publications/route.ts", pattern: /socialPublicationApprovalRequestSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/social/publications/execute/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "apps/admin/app/api/admin/social/publications/execute/route.ts", pattern: /socialPublicationExecuteRequestSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/social/providers/meta/capabilities/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "apps/admin/app/api/admin/social/providers/meta/capabilities/route.ts", pattern: /isSameOriginAdminMutation\(request\.url, request\.headers\.get\(\"origin\"\)\)/, exception: "No request body; capability targets and provider credentials are server-owned." },
  },
  "apps/admin/app/api/admin/social/providers/meta/connection/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "apps/admin/app/api/admin/social/providers/meta/connection/route.ts", pattern: /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/, exception: "Sensitive GET adds an exact configured-origin check." },
  },
  "apps/admin/app/api/admin/social/providers/meta/audio/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "apps/admin/app/api/admin/social/providers/meta/audio/route.ts", pattern: /instagramAudioSearchInputSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/social/providers/meta/discovery/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "apps/admin/app/api/admin/social/providers/meta/discovery/route.ts", pattern: /isSameOriginAdminMutation\(request\.url, request\.headers\.get\("origin"\)\)/, exception: "No request body; provider selection is server-owned." },
  },
  "apps/admin/app/api/admin/social/providers/meta/handoff/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "apps/admin/app/api/admin/social/providers/meta/handoff/route.ts", pattern: /googleDriveSelectedFileRequestSchema\.safeParse/, },
  },
  "apps/admin/app/api/admin/social/providers/tiktok/discovery/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "apps/admin/app/api/admin/social/providers/tiktok/discovery/route.ts", pattern: /isSameOriginAdminMutation\(request\.url, request\.headers\.get\("origin"\)\)/, exception: "No request body; provider selection is server-owned." },
  },
  "apps/admin/app/api/admin/social/providers/youtube/discovery/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"social:read"/,
    validation: { file: "apps/admin/app/api/admin/social/providers/youtube/discovery/route.ts", pattern: /isSameOriginAdminMutation\(request\.url, request\.headers\.get\("origin"\)\)/, exception: "No request body; provider selection is server-owned." },
  },
  "apps/admin/app/api/admin/analytics/export/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role\s*!==\s*"owner"/,
    validation: { file: "apps/admin/app/api/admin/analytics/export/route.ts", pattern: /!\["csv", "xlsx"\]\.includes\(format\)[\s\S]*analyticsReportSchema\.safeParse\(report\)[\s\S]*!PERFORMANCE_VIEWS\.includes/, },
  },
  "apps/admin/app/api/admin/analytics/import/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role !== "owner" \|\| identity\.actorType !== "human"/,
    validation: { file: "apps/admin/app/api/admin/analytics/import/route.ts", pattern: /metadataSchema\.safeParse\([\s\S]*!\(file instanceof File\)[\s\S]*file\.size > UBERSUGGEST_CSV_MAX_BYTES/, exception: "Multipart CSV validates bounded metadata and CSV file/size; no JSON body.", },
  },
  "apps/admin/app/api/admin/analytics/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role\s*!==\s*"owner"/,
    validation: { file: "apps/admin/app/api/admin/analytics/route.ts", pattern: /export async function GET\(\)/, exception: "No request input.", },
  },
  "apps/admin/app/api/admin/content/[id]/line-copy/generate/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "draft:apply"\)/,
    validation: { file: "apps/admin/app/api/admin/content/[id]/line-copy/generate/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/content/[id]/line-copy/improve/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "draft:apply"\)/,
    validation: { file: "apps/admin/app/api/admin/content/[id]/line-copy/improve/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/content/[id]/line-copy/publish/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "draft:apply"\)/,
    validation: { file: "apps/admin/app/api/admin/content/[id]/line-copy/publish/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/content/[id]/overview/generate/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "draft:apply"\)/,
    validation: { file: "apps/admin/app/api/admin/content/[id]/overview/generate/route.ts", pattern: /input\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/control/commands/route.ts": {
    methods: ["GET", "POST"], identity: /getAdminIdentity\(\)/, authorization: /"settings:read"[\s\S]*identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "settings:read"\)/,
    validation: { file: "apps/admin/app/api/admin/control/commands/route.ts", pattern: /commandSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/exports/csv/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role\s*!==\s*"owner"/,
    validation: { file: "apps/admin/app/api/admin/exports/csv/route.ts", pattern: /exportDatasetSchema\.safeParse\(url\.searchParams\.get\("dataset"\)\)/, },
  },
  "apps/admin/app/api/admin/exports/google-sheet/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role\s*!==\s*"owner"/,
    validation: { file: "apps/admin/app/api/admin/exports/google-sheet/route.ts", pattern: /bodySchema\.safeParse\(value\)/, },
  },
  "apps/admin/app/api/admin/line/campaigns/[campaignId]/approve/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "campaign:write"\)/,
    validation: { file: "lib/admin/line/campaigns.ts", pattern: /async function campaignMutation\([\s\S]*!z\.string\(\)\.uuid\(\)\.safeParse\(campaignId\)\.success/, exception: "No request body; campaign UUID is validated in shared campaignMutation before database execution.", },
  },
  "apps/admin/app/api/admin/line/campaigns/[campaignId]/enqueue/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "campaign:write"\)/,
    validation: { file: "lib/admin/line/campaigns.ts", pattern: /async function campaignMutation\([\s\S]*!z\.string\(\)\.uuid\(\)\.safeParse\(campaignId\)\.success/, exception: "No request body; campaign UUID is validated in shared campaignMutation before database execution.", },
  },
  "apps/admin/app/api/admin/line/campaigns/route.ts": {
    methods: ["GET", "POST"], identity: /getAdminIdentity\(\)/, authorization: /"campaign:read"[\s\S]*identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "campaign:write"\)/,
    validation: { file: "lib/admin/line/campaigns.ts", pattern: /saveLineCampaign\([\s\S]*campaignInputSchema\.safeParse\(input\)/, exception: "GET has no input; POST JSON is schema-validated in saveLineCampaign.", },
  },
  "apps/admin/app/api/admin/line/chat/route.ts": {
    methods: ["GET", "PUT"], identity: /getAdminIdentity\(\)/, authorization: /"settings:read"[\s\S]*identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "settings:read"\)/,
    validation: { file: "lib/admin/line/chat-config.ts", pattern: /saveLineChatConfig\([\s\S]*lineChatMutationSchema\.safeParse\(input\)/, exception: "GET has no input; PUT bounded JSON is schema-validated in saveLineChatConfig.", },
  },
  "apps/admin/app/api/admin/line/content-cards/preview/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /!hasAdminPermission\(identity\.role, "settings:read"\)/,
    validation: { file: "apps/admin/app/api/admin/line/content-cards/preview/route.ts", pattern: /!ALLOWED_JOURNEYS\.has\(rawJourney as LineJourneyId\)/, },
  },
  "apps/admin/app/api/admin/line/discovery/route.ts": {
    methods: ["GET", "PUT"], identity: /getAdminIdentity\(\)/, authorization: /"settings:read"[\s\S]*identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "settings:read"\)/,
    validation: { file: "lib/admin/line/discovery-config.ts", pattern: /lineDiscoveryMutationSchema\.safeParse\(input\)/, exception: "GET has no input; PUT bounded JSON is schema-validated in saveLineDiscoveryCuration.", },
  },
  "apps/admin/app/api/admin/line/inbox/[leadId]/attribution/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "advisor:case:update"\)/,
    validation: { file: "apps/admin/app/api/admin/line/inbox/[leadId]/attribution/route.ts", pattern: /z\.string\(\)\.uuid\(\)\.safeParse\(\(await params\)\.leadId\)[\s\S]*bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/line/inbox/[leadId]/evidence/audit/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "advisor:read"\)/,
    validation: { file: "apps/admin/app/api/admin/line/inbox/[leadId]/evidence/audit/route.ts", pattern: /z\.string\(\)\.uuid\(\)\.safeParse\(\(await params\)\.leadId\)[\s\S]*bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/line/inbox/[leadId]/history-import/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "advisor:case:update"\)/,
    validation: { file: "apps/admin/app/api/admin/line/inbox/[leadId]/history-import/route.ts", pattern: /z\.string\(\)\.uuid\(\)\.safeParse\(\(await params\)\.leadId\)[\s\S]*!\(file instanceof File\)[\s\S]*file\.size > MAX_CSV_BYTES/, exception: "Multipart CSV validates lead UUID, file, sender label, size and CSV type before import.", },
  },
  "apps/admin/app/api/admin/line/inbox/[leadId]/implementation/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "advisor:case:update"\)/,
    validation: { file: "apps/admin/app/api/admin/line/inbox/[leadId]/implementation/route.ts", pattern: /z\.string\(\)\.uuid\(\)\.safeParse\(\(await params\)\.leadId\)[\s\S]*bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/line/inbox/[leadId]/notes/route.ts": {
    methods: ["GET", "POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "advisor:note"\)/,
    validation: { file: "apps/admin/app/api/admin/line/inbox/[leadId]/notes/route.ts", pattern: /z\.string\(\)\.uuid\(\)\.safeParse\(\(await params\)\.leadId\)[\s\S]*noteSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/line/inbox/[leadId]/operations/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "advisor:case:update"\)/,
    validation: { file: "apps/admin/app/api/admin/line/inbox/[leadId]/operations/route.ts", pattern: /z\.string\(\)\.uuid\(\)\.safeParse\(\(await params\)\.leadId\)[\s\S]*bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/line/inbox/[leadId]/reply/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "advisor:reply"\)/,
    validation: { file: "apps/admin/app/api/admin/line/inbox/[leadId]/reply/route.ts", pattern: /"admin-reply-retired-use-line-oa-manager"[\s\S]*status: 410/, exception: "Retired endpoint never parses or sends a reply; authorized requests terminate with 410.", },
  },
  "apps/admin/app/api/admin/line/inbox/[leadId]/revenue/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "advisor:case:update"\)/,
    validation: { file: "apps/admin/app/api/admin/line/inbox/[leadId]/revenue/route.ts", pattern: /z\.string\(\)\.uuid\(\)\.safeParse\(\(await params\)\.leadId\)[\s\S]*bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/line/inbox/[leadId]/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /!hasAdminPermission\(identity\.role, "advisor:read"\)/,
    validation: { file: "apps/admin/app/api/admin/line/inbox/[leadId]/route.ts", pattern: /z\.string\(\)\.uuid\(\)\.safeParse\(\(await params\)\.leadId\)/, },
  },
  "apps/admin/app/api/admin/line/inbox/[leadId]/screenshot-ocr/confirm/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "advisor:case:update"\)/,
    validation: { file: "apps/admin/app/api/admin/line/inbox/[leadId]/screenshot-ocr/confirm/route.ts", pattern: /z\.string\(\)\.uuid\(\)\.safeParse\(\(await params\)\.leadId\)[\s\S]*bodySchema\.safeParse\(value\)/, },
  },
  "apps/admin/app/api/admin/line/inbox/[leadId]/screenshot-ocr/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "advisor:case:update"\)/,
    validation: { file: "apps/admin/app/api/admin/line/inbox/[leadId]/screenshot-ocr/route.ts", pattern: /z\.string\(\)\.uuid\(\)\.safeParse\(\(await params\)\.leadId\)[\s\S]*!z\.string\(\)\.datetime\(\{ offset: true \}\)\.safeParse\(capturedAt\)\.success/, exception: "Multipart screenshot path validates lead UUID, MIME/size, capture timestamp before OCR; proposal schema validates the provider response.", },
  },
  "apps/admin/app/api/admin/line/inbox/[leadId]/stage/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "advisor:case:update"\)/,
    validation: { file: "apps/admin/app/api/admin/line/inbox/[leadId]/stage/route.ts", pattern: /z\.string\(\)\.uuid\(\)\.safeParse\(\(await params\)\.leadId\)[\s\S]*bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/line/inbox/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /!hasAdminPermission\(identity\.role, "advisor:read"\)/,
    validation: { file: "apps/admin/app/api/admin/line/inbox/route.ts", pattern: /export async function GET\(\)/, exception: "No request input.", },
  },
  "apps/admin/app/api/admin/line/privacy/[requestId]/prepare/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role!=="owner"\|\|!hasAdminPermission\(identity\.role,"settings:read"\)/,
    validation: { file: "apps/admin/app/api/admin/line/privacy/[requestId]/prepare/route.ts", pattern: /z\.string\(\)\.uuid\(\)\.safeParse\(\(await params\)\.requestId\)/, exception: "No request body; validates request UUID.", },
  },
  "apps/admin/app/api/admin/line/privacy/[requestId]/transition/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role!=="owner"\|\|!hasAdminPermission\(identity\.role,"settings:read"\)/,
    validation: { file: "apps/admin/app/api/admin/line/privacy/[requestId]/transition/route.ts", pattern: /z\.string\(\)\.uuid\(\)\.safeParse\(\(await params\)\.requestId\)[\s\S]*bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/line/privacy/retention/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role\s*!==\s*"owner"\s*\|\|\s*!hasAdminPermission\(identity\.role,\s*"settings:read"\)/,
    validation: { file: "apps/admin/app/api/admin/line/privacy/retention/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/line/privacy/route.ts": {
    methods: ["GET", "POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role\s*!==\s*"owner"\s*\|\|\s*!hasAdminPermission\(identity\.role,\s*"settings:read"\)/,
    validation: { file: "apps/admin/app/api/admin/line/privacy/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/line/rich-menu/activate/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role\s*!==\s*"owner"\s*\|\|\s*!hasAdminPermission\(identity\.role,\s*"settings:read"\)/,
    validation: { file: "apps/admin/app/api/admin/line/rich-menu/activate/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/local-ai/review/route.ts": {
    methods: ["POST", "GET"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role\s*!==\s*"owner"/,
    validation: { file: "apps/admin/app/api/admin/local-ai/review/route.ts", pattern: /bodySchema\.safeParse\(raw\)[\s\S]*export function GET\(\)[\s\S]*status: 404/, exception: "POST accepts validated JSON/form input; synchronous GET is a fixed 404 response without data access.", },
  },
  "apps/admin/app/api/admin/marketing/actions/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role!=="owner"\|\|identity\.actorType!=="human"/,
    validation: { file: "apps/admin/app/api/admin/marketing/actions/route.ts", pattern: /marketingActionSchema\.safeParse\(JSON\.parse\(Buffer\.concat\(chunks\)\.toString\("utf8"\)\)\)/, },
  },
  "apps/admin/app/api/admin/marketing/export/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role\s*!==\s*"owner"/,
    validation: { file: "apps/admin/app/api/admin/marketing/export/route.ts", pattern: /!\["csv", "xlsx"\]\.includes\(format\)[\s\S]*!MARKETING_SHEET_TITLES\.includes[\s\S]*format === "csv" && !sheet/, },
  },
  "apps/admin/app/api/admin/marketing/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /identity\.role!=="owner"/,
    validation: { file: "apps/admin/app/api/admin/marketing/route.ts", pattern: /marketingWindowSchema\.safeParse\(new URL\(request\.url\)\.searchParams\.get\("window"\)/, },
  },
  "apps/admin/app/api/admin/operations/jobs/[jobId]/route.ts": {
    methods: ["GET"], identity: /getAdminIdentity\(\)/, authorization: /!hasAdminPermission\(identity\.role, "settings:read"\)/,
    validation: { file: "apps/admin/app/api/admin/operations/jobs/[jobId]/route.ts", pattern: /!z\.string\(\)\.uuid\(\)\.safeParse\(jobId\)\.success/, },
  },
  "apps/admin/app/api/admin/seo/post-publish/route.ts": {
    methods: ["POST", "GET"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner" \|\| !hasAdminPermission\(identity\.role, "seo:read"\)/,
    validation: { file: "apps/admin/app/api/admin/seo/post-publish/route.ts", pattern: /z\.object\(\{ articleId: articleIdSchema \}\)\.strict\(\)\.safeParse\(await request\.json\(\)\.catch[\s\S]*articleIdSchema\.safeParse\(new URL\(request\.url\)\.searchParams\.get\("articleId"\)\)/, },
  },
  "apps/admin/app/api/admin/seo/providers/connect/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "apps/admin/app/api/admin/seo/providers/connect/route.ts", pattern: /!isPostPublishAdminOriginAllowed\(request, process\.env, getAdminEnvironment\(\)\)/, exception: "No request body; configured Admin origin, owner session, lane/context and server-owned connect intent are required.", },
  },
  "apps/admin/app/api/admin/social/drafts/instagram-audio/route.ts": {
    methods: ["GET", "POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "apps/admin/app/api/admin/social/drafts/instagram-audio/route.ts", pattern: /variantQuerySchema\.safeParse\(url\.searchParams\.get\("variantId"\)\)[\s\S]*instagramAudioConfigurationMutationSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/social/publications/cancel/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "apps/admin/app/api/admin/social/publications/cancel/route.ts", pattern: /socialOperationMutationSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/social/publications/reschedule/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /identity\.actorType !== "human" \|\| identity\.role !== "owner"/,
    validation: { file: "apps/admin/app/api/admin/social/publications/reschedule/route.ts", pattern: /socialRescheduleMutationSchema\.safeParse\(await request\.json\(\)\.catch/, },
  },
  "apps/admin/app/api/admin/social/worker/route.ts": {
    methods: ["GET"], identity: /const cronSecret = process\.env\.CRON_SECRET\?\.trim\(\);[\s\S]*if \(!cronSecret\)/, authorization: /if \(request\.headers\.get\("authorization"\) !== `Bearer \$\{cronSecret\}`\)/,
    validation: { file: "apps/admin/app/api/admin/social/worker/route.ts", pattern: /"social-worker-unavailable"[\s\S]*status: 503/, exception: "Retired HTTP worker is fail-closed: absent configuration503, invalid bearer401, authorized requests503; only private CLI may execute work.", },
  },
};

const legacyContracts: Record<string, RouteContract> = {
  "app/api/admin/content/[id]/schedule/route.ts": {
    methods: ["GET", "POST", "DELETE"], identity: /getAdminIdentity\(\)/, authorization: /"content:schedule"/,
    validation: { file: "app/api/admin/content/[id]/schedule/route.ts", pattern: /bodySchema\.safeParse\(await request\.json\(\)\.catch/, exception: "Owner-only GET reads one deterministic schedule; POST validates Bangkok datetime JSON; DELETE cancels server-owned schedule state. Same-origin mutation protection is enforced centrally by the Admin proxy." },
  },
  "app/api/admin/providers/ubersuggest/sync/route.ts": {
    methods: ["POST"], identity: /getAdminIdentity\(\)/, authorization: /"research:provider-query"/,
    validation: { file: "app/api/admin/providers/ubersuggest/sync/route.ts", pattern: /requestSchema\.safeParse\(raw\)/, exception: "Provider sync defaults to server-owned selection; reviewed AISV import accepts only strict bounded UAT JSON and exact same-origin human requests." },
  },
};

test("every Admin API route has an explicit reviewed contract", () => {
  assert.deepEqual(routeFiles(apiRoot).sort(), Object.keys(contracts).sort());
});

test("Admin routes retain identity, authorization, and request validation coverage", () => {
  for (const [route, contract] of [...Object.entries(contracts), ...Object.entries(legacyContracts)]) {
    const source = read(route);
    assert.deepEqual([...readFileSync(path.join(repositoryRoot, route), "utf8").matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((match) => match[1]), contract.methods, route);
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
