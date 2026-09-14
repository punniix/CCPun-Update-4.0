export type AiCrawlerCategory = "ai_assistant" | "ai_search" | "ai_crawler";

export interface AiCrawlerDefinition {
  token: string;
  crawler: string;
  operator: string;
  category: AiCrawlerCategory;
}

export interface AiCrawlerLogEvent {
  schema: "ccpun.ai_crawl.v1";
  observed_at: string;
  crawler: string;
  operator: string;
  category: AiCrawlerCategory;
  user_triggered_likelihood: "high" | "low";
  path: string;
  method: string;
  environment: string;
  attribution: "user_agent_unverified";
  vercel_request_id?: string;
  cf_ray?: string;
}

export const CCPUN_WEB_VERCEL_PROJECT_ID = "prj_dxwjITkd0av5QiJQv2snUlIASUWu";

// Mirrors Cloudflare AI Crawl Control bot categories. These values identify the
// crawler declared in the User-Agent; they do not verify the remote operator.
export const AI_CRAWLER_DEFINITIONS: readonly AiCrawlerDefinition[] = [
  { token: "GPTBot", crawler: "GPTBot", operator: "OpenAI", category: "ai_crawler" },
  { token: "ChatGPT-User", crawler: "ChatGPT-User", operator: "OpenAI", category: "ai_assistant" },
  { token: "OAI-SearchBot", crawler: "OAI-SearchBot", operator: "OpenAI", category: "ai_search" },
  { token: "ClaudeBot", crawler: "ClaudeBot", operator: "Anthropic", category: "ai_crawler" },
  { token: "Claude-SearchBot", crawler: "Claude-SearchBot", operator: "Anthropic", category: "ai_search" },
  { token: "Claude-User", crawler: "Claude-User", operator: "Anthropic", category: "ai_assistant" },
  { token: "PerplexityBot", crawler: "PerplexityBot", operator: "Perplexity", category: "ai_search" },
  { token: "Perplexity-User", crawler: "Perplexity-User", operator: "Perplexity", category: "ai_assistant" },
  { token: "Google-CloudVertexBot", crawler: "Google-CloudVertexBot", operator: "Google", category: "ai_crawler" },
  { token: "Bytespider", crawler: "Bytespider", operator: "ByteDance", category: "ai_crawler" },
  { token: "CCBot", crawler: "CCBot", operator: "Common Crawl", category: "ai_crawler" },
  { token: "meta-externalagent", crawler: "Meta-ExternalAgent", operator: "Meta", category: "ai_crawler" },
  { token: "meta-externalfetcher", crawler: "Meta-ExternalFetcher", operator: "Meta", category: "ai_assistant" },
  { token: "FacebookBot", crawler: "FacebookBot", operator: "Meta", category: "ai_crawler" },
  { token: "Applebot", crawler: "Applebot", operator: "Apple", category: "ai_search" },
  { token: "Amazonbot", crawler: "Amazonbot", operator: "Amazon", category: "ai_crawler" },
  { token: "DuckAssistBot", crawler: "DuckAssistBot", operator: "DuckDuckGo", category: "ai_assistant" },
  { token: "MistralAI-User", crawler: "MistralAI-User", operator: "Mistral", category: "ai_assistant" },
];

export const AI_CRAWLER_USER_AGENT_TOKENS = AI_CRAWLER_DEFINITIONS.map(({ token }) => token);

const EXCLUDED_PUBLIC_PREFIXES = ["/_next/", "/api/", "/studio/"];
const EXCLUDED_ASSET_EXTENSION = /\.(?:avif|bmp|css|gif|ico|jpe?g|js|map|mp4|png|svg|ttf|webm|webp|woff2?)$/i;

function tokenPattern(token: string): RegExp {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s;(])${escaped}(?:[/\\s;)]|$)`, "i");
}

export function classifyAiCrawler(userAgent: string | null | undefined): AiCrawlerDefinition | null {
  if (!userAgent) return null;
  return AI_CRAWLER_DEFINITIONS.find(({ token }) => tokenPattern(token).test(userAgent)) ?? null;
}

export function isTrackablePublicPath(pathname: string): boolean {
  if (!pathname.startsWith("/")) return false;
  if (pathname === "/api" || pathname === "/studio" || isAdminPagePath(pathname)) return false;
  if (EXCLUDED_PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
  return !EXCLUDED_ASSET_EXTENSION.test(pathname);
}

export function buildAiCrawlerLogEvent({
  userAgent,
  pathname,
  method,
  projectId = process.env.VERCEL_PROJECT_ID,
  environment = process.env.VERCEL_ENV,
  vercelRequestId,
  cloudflareRay,
  observedAt = new Date().toISOString(),
}: {
  userAgent: string | null | undefined;
  pathname: string;
  method: string;
  projectId?: string;
  environment?: string;
  vercelRequestId?: string | null;
  cloudflareRay?: string | null;
  observedAt?: string;
}): AiCrawlerLogEvent | null {
  if (projectId && projectId !== CCPUN_WEB_VERCEL_PROJECT_ID) return null;
  if (!isTrackablePublicPath(pathname)) return null;
  const definition = classifyAiCrawler(userAgent);
  if (!definition) return null;

  return {
    schema: "ccpun.ai_crawl.v1",
    observed_at: observedAt,
    crawler: definition.crawler,
    operator: definition.operator,
    category: definition.category,
    user_triggered_likelihood: definition.category === "ai_assistant" ? "high" : "low",
    path: pathname,
    method: method.toUpperCase(),
    environment: environment?.trim() || "local",
    attribution: "user_agent_unverified",
    ...(vercelRequestId ? { vercel_request_id: vercelRequestId } : {}),
    ...(cloudflareRay ? { cf_ray: cloudflareRay } : {}),
  };
}

export function observeAiCrawlerRequest(
  input: Parameters<typeof buildAiCrawlerLogEvent>[0],
  write: (message: string) => void = console.info,
): AiCrawlerLogEvent | null {
  const event = buildAiCrawlerLogEvent(input);
  if (!event) return null;
  write(`[AI_CRAWL] ${JSON.stringify(event)}`);
  return event;
}
import { isAdminPagePath } from "@/lib/admin/routes";
