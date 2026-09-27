import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AI_CRAWLER_DEFINITIONS,
  CCPUN_WEB_VERCEL_PROJECT_ID,
  buildAiCrawlerLogEvent,
  classifyAiCrawler,
  isTrackablePublicPath,
  observeAiCrawlerRequest,
} from "../lib/observability/ai-crawler";

test("classifies every configured AI crawler token case-insensitively", () => {
  for (const expected of AI_CRAWLER_DEFINITIONS) {
    const userAgent = `Mozilla/5.0 (compatible; ${expected.token}/1.0; +https://example.invalid/bot)`;
    assert.deepEqual(classifyAiCrawler(userAgent), expected, expected.token);
    assert.deepEqual(classifyAiCrawler(userAgent.toLowerCase()), expected, `${expected.token} lowercase`);
  }
  assert.equal(classifyAiCrawler("Mozilla/5.0 Chrome/140.0 Safari/537.36"), null);
});

test("does not misclassify Applebot-Extended as Applebot search", () => {
  assert.equal(classifyAiCrawler("Mozilla/5.0 Applebot-Extended/1.0"), null);
});

test("tracks public content and metadata paths but excludes private and asset paths", () => {
  for (const path of ["/", "/blog/health-insurance/example/", "/robots.txt", "/sitemaps/blog.xml", "/guide.pdf"]) {
    assert.equal(isTrackablePublicPath(path), true, path);
  }
  for (const path of ["/api", "/api/lead", "/snt-admin", "/dashboard/", "/studio", "/studio/desk", "/_next/image", "/hero.webp", "/app.js"]) {
    assert.equal(isTrackablePublicPath(path), false, path);
  }
});

test("builds a privacy-minimal structured event for the Web project", () => {
  const event = buildAiCrawlerLogEvent({
    userAgent: "ChatGPT-User/1.0",
    pathname: "/blog/example/",
    method: "get",
    projectId: CCPUN_WEB_VERCEL_PROJECT_ID,
    environment: "production",
    vercelRequestId: "sin1::abc123",
    cloudflareRay: "ray123-BKK",
    observedAt: "2026-09-03T10:30:00.000Z",
  });

  assert.deepEqual(event, {
    schema: "ccpun.ai_crawl.v1",
    observed_at: "2026-09-03T10:30:00.000Z",
    crawler: "ChatGPT-User",
    operator: "OpenAI",
    category: "ai_assistant",
    user_triggered_likelihood: "high",
    path: "/blog/example/",
    method: "GET",
    environment: "production",
    provider: "vercel",
    deployment_role: "web",
    attribution: "user_agent_unverified",
    request_id: "sin1::abc123",
    vercel_request_id: "sin1::abc123",
    cf_ray: "ray123-BKK",
  });
  assert.equal(Object.hasOwn(event ?? {}, "ip"), false);
  assert.equal(Object.hasOwn(event ?? {}, "cookie"), false);
  assert.equal(Object.hasOwn(event ?? {}, "referrer"), false);
  assert.equal(Object.hasOwn(event ?? {}, "user_agent"), false);
});

test("supports provider-neutral Hostinger Web crawler identity", () => {
  const event = buildAiCrawlerLogEvent({
    userAgent: "OAI-SearchBot/1.0",
    pathname: "/blog/example/",
    method: "GET",
    environment: "production",
    requestId: "hostinger-request-1",
    observedAt: "2026-09-26T00:00:00.000Z",
    variables: {
      CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
      CCPUN_DEPLOYMENT_ROLE: "web",
      CCPUN_APP_ENV: "production",
      CCPUN_RELEASE_ID: "hostinger-release-1",
    },
  });

  assert.equal(event?.provider, "hostinger");
  assert.equal(event?.deployment_role, "web");
  assert.equal(event?.environment, "production");
  assert.equal(event?.release_id, "hostinger-release-1");
  assert.equal(event?.request_id, "hostinger-request-1");
  assert.equal(Object.hasOwn(event ?? {}, "vercel_request_id"), false);
});

test("suppresses AI events on the Admin Vercel project and private routes", () => {
  const base = {
    userAgent: "OAI-SearchBot/1.0",
    method: "GET",
    environment: "production",
    observedAt: "2026-09-03T10:30:00.000Z",
  };

  assert.equal(buildAiCrawlerLogEvent({ ...base, pathname: "/blog/example/", projectId: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN" }), null);
  assert.equal(buildAiCrawlerLogEvent({ ...base, pathname: "/dashboard/", projectId: CCPUN_WEB_VERCEL_PROJECT_ID }), null);
});

test("emits one searchable AI_CRAWL line only for recognized traffic", () => {
  const messages: string[] = [];
  const write = (message: string) => messages.push(message);

  const event = observeAiCrawlerRequest({
    userAgent: "PerplexityBot/1.0",
    pathname: "/blog/example/",
    method: "GET",
    projectId: CCPUN_WEB_VERCEL_PROJECT_ID,
    environment: "preview",
    observedAt: "2026-09-03T10:30:00.000Z",
  }, write);
  observeAiCrawlerRequest({
    userAgent: "Mozilla/5.0 Chrome/140.0",
    pathname: "/blog/example/",
    method: "GET",
    projectId: CCPUN_WEB_VERCEL_PROJECT_ID,
    environment: "preview",
    observedAt: "2026-09-03T10:30:00.000Z",
  }, write);

  assert.equal(event?.crawler, "PerplexityBot");
  assert.equal(messages.length, 1);
  assert.match(messages[0], /^\[AI_CRAWL\] \{"schema":"ccpun\.ai_crawl\.v1"/);
});

test("proxy matcher stays in sync with the configured crawler tokens", () => {
  const proxySource = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  for (const { token } of AI_CRAWLER_DEFINITIONS) {
    assert.ok(proxySource.includes(token), `proxy matcher missing ${token}`);
  }
  assert.match(proxySource, /key: "user-agent"/);
});
