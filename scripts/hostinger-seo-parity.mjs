#!/usr/bin/env node

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const sourceBase = arg("--source");
const targetBase = arg("--target");
const targetMode = arg("--target-mode") ?? "shadow";
if (!sourceBase || !targetBase || !["shadow", "production"].includes(targetMode)) {
  console.error("Usage: node scripts/hostinger-seo-parity.mjs --source https://ccpun.com --target https://shadow.example [--target-mode shadow|production]");
  process.exit(2);
}

const CRITICAL_PATHS = [
  "/",
  "/blog/",
  "/ci-planning/",
  "/tools/financial-health-check/",
  "/privacy/",
  "/blog/personal-finance/financial-pyramid/",
  "/blog/health-insurance/aia-health-happy-describe/",
  "/robots.txt",
  "/sitemap.xml",
  "/sitemaps/core.xml",
  "/sitemaps/tools.xml",
  "/sitemaps/blog.xml",
];

const AI_BOTS = ["OAI-SearchBot/1.0", "Claude-SearchBot/1.0", "PerplexityBot/1.0"];
const SHADOW_ROBOTS_DIRECTIVES = ["noindex", "nofollow", "noarchive"];
const failures = [];
const observations = [];

function join(base, path) {
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

async function trace(url, userAgent = "CCPun-Migration-Parity/1.0") {
  const chain = [];
  let current = url;
  for (let i = 0; i < 8; i += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": userAgent, accept: "text/html,application/xml,text/plain;q=0.9,*/*;q=0.8" },
    });
    const location = response.headers.get("location");
    chain.push({ url: current, status: response.status, location });
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    return { response, body: await response.text(), chain, finalUrl: current };
  }
  throw new Error(`redirect-loop: ${url}`);
}

function normalizeText(value = "") {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function firstMatch(html, pattern) {
  return html.match(pattern)?.[1]?.trim() ?? "";
}

function schemaTypes(html) {
  const out = new Set();
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  function walk(value) {
    if (!value || typeof value !== "object") return;
    const type = value["@type"];
    if (Array.isArray(type)) type.forEach((item) => out.add(String(item)));
    else if (type) out.add(String(type));
    if (Array.isArray(value)) value.forEach(walk);
    else Object.values(value).forEach(walk);
  }
  for (const match of scripts) {
    try { walk(JSON.parse(match[1])); } catch { out.add("__INVALID_JSON_LD__"); }
  }
  return [...out].sort();
}

function htmlFingerprint(result) {
  const html = result.body;
  return {
    status: result.response.status,
    redirectStatuses: result.chain.map((item) => item.status),
    title: normalizeText(firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i)),
    canonical: firstMatch(html, /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i)
      || firstMatch(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i),
    robots: firstMatch(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["'][^>]*>/i),
    xRobotsTag: result.response.headers.get("x-robots-tag") ?? "",
    h1: normalizeText(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)),
    schemaTypes: schemaTypes(html),
  };
}

function contentFingerprint(fingerprint) {
  return {
    status: fingerprint.status,
    redirectStatuses: fingerprint.redirectStatuses,
    title: fingerprint.title,
    canonical: fingerprint.canonical,
    h1: fingerprint.h1,
    schemaTypes: fingerprint.schemaTypes,
  };
}

function robotsDirectiveSet(value = "") {
  return new Set(value.toLowerCase().split(",").map((part) => part.trim()).filter(Boolean));
}

function assertShadowRobotsHeader(name, value) {
  const directives = robotsDirectiveSet(value);
  const missing = SHADOW_ROBOTS_DIRECTIVES.filter((directive) => !directives.has(directive));
  if (missing.length) failures.push({ name, expected: SHADOW_ROBOTS_DIRECTIVES, target: value, missing });
}

function xmlLocs(body) {
  return [...body.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((m) => m[1].trim()).sort();
}

function robotsRules(body) {
  return body.split(/\r?\n/).map((line) => line.replace(/#.*/, "").trim()).filter(Boolean).sort();
}

function assertShadowRobotsTxt(rules) {
  const normalized = rules.map((rule) => rule.toLowerCase().replace(/\s+/g, " "));
  if (!normalized.includes("user-agent: *") || !normalized.includes("disallow: /")) {
    failures.push({ name: "/robots.txt:shadow-block", expected: ["User-agent: *", "Disallow: /"], target: rules });
  }
  if (normalized.some((rule) => rule.startsWith("sitemap:"))) {
    failures.push({ name: "/robots.txt:shadow-sitemap", expected: "no sitemap directive on shadow", target: rules });
  }
}

function compare(name, source, target) {
  if (JSON.stringify(source) !== JSON.stringify(target)) {
    failures.push({ name, source, target });
  }
}

for (const path of CRITICAL_PATHS) {
  const [source, target] = await Promise.all([trace(join(sourceBase, path)), trace(join(targetBase, path))]);
  if (path === "/robots.txt") {
    compare(`${path}:status`, source.response.status, target.response.status);
    const sourceRules = robotsRules(source.body);
    const targetRules = robotsRules(target.body);
    if (targetMode === "shadow") assertShadowRobotsTxt(targetRules);
    else compare(`${path}:rules`, sourceRules, targetRules);
  } else if (path.endsWith(".xml")) {
    compare(`${path}:status`, source.response.status, target.response.status);
    compare(`${path}:locs`, xmlLocs(source.body), xmlLocs(target.body));
  } else {
    const sourceFp = htmlFingerprint(source);
    const targetFp = htmlFingerprint(target);
    compare(`${path}:content`, contentFingerprint(sourceFp), contentFingerprint(targetFp));
    if (targetMode === "shadow") {
      assertShadowRobotsHeader(`${path}:shadow-x-robots-tag`, targetFp.xRobotsTag);
    } else {
      compare(`${path}:robots`, sourceFp.robots, targetFp.robots);
      compare(`${path}:x-robots-tag`, sourceFp.xRobotsTag, targetFp.xRobotsTag);
    }
  }
  observations.push({
    path,
    sourceStatus: source.response.status,
    targetStatus: target.response.status,
    targetXRobotsTag: target.response.headers.get("x-robots-tag") ?? "",
  });
}

for (const bot of AI_BOTS) {
  for (const path of ["/", "/blog/personal-finance/financial-pyramid/"]) {
    const target = await trace(join(targetBase, path), bot);
    const xRobotsTag = target.response.headers.get("x-robots-tag") ?? "";
    if (target.response.status >= 400) {
      failures.push({ name: `ai-crawler:${bot}:${path}`, targetStatus: target.response.status, xRobotsTag });
    } else if (targetMode === "shadow") {
      assertShadowRobotsHeader(`ai-crawler:${bot}:${path}:shadow-x-robots-tag`, xRobotsTag);
    } else if (/noindex/i.test(xRobotsTag)) {
      failures.push({ name: `ai-crawler:${bot}:${path}:production-indexability`, targetStatus: target.response.status, xRobotsTag });
    }
  }
}

console.log(JSON.stringify({
  status: failures.length ? "blocked" : "parity-ok",
  source: sourceBase,
  target: targetBase,
  targetMode,
  checkedPaths: CRITICAL_PATHS.length,
  aiBots: AI_BOTS,
  observations,
  failures,
}, null, 2));

if (failures.length) process.exit(1);
