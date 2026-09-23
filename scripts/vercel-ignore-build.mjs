import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const WEB_PROJECT_ID = "prj_dxwjITkd0av5QiJQv2snUlIASUWu";
const ADMIN_PROJECT_ID = "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN";

const ADMIN_ONLY_PREFIXES = [
  "apps/admin/",
  "app/(control-plane)/",
  "app/(control-plane-auth)/",
  "app/(control-plane-error)/",
  "app/api/admin/",
  "app/studio/",
  "cms/sanity/",
  "db/",
  "features/admin/",
  "lib/admin/",
  "qa/admin-",
  "tests/admin/",
];
const WEB_ONLY_PREFIXES = [
  "apps/web/",
  "app/blog/",
  "app/ci-planning/",
  "app/cookie-policy/",
  "app/privacy/",
  "app/sitemap.xml/",
  "app/sitemaps/",
  "app/tools/",
  "features/analytics/",
  "features/blog/",
  "features/ci-planning/",
  "features/financial-health-check/",
  "features/home/",
  "public/",
  "tests/website43-",
];
const WEB_ONLY_FILES = new Set([
  "app/page.tsx",
  // These shared-root files are Public Web calculator/tool surfaces. Do not
  // broaden this to components/layout/website-43/* because Admin imports
  // Website43ResponsiveStyles and Website43.module.css at runtime.
  "components/layout/website-43/Website43ToolHero.tsx",
  "components/ui/CurrencyInput.tsx",
  "components/ui/FunctionalMotion.module.css",
  "components/ui/HumanCalculatorCard.tsx",
]);
const NEUTRAL_PREFIXES = ["docs/"];
const NEUTRAL_FILES = new Set([
  "AGENTS.md",
  "HANDOFF.md",
  "README.md",
  ".github/workflows/sanity-free-plan-privacy.yml",
  ".github/workflows/seo-topic-hubs-ci.yml",
  "scripts/vercel-ignore-build.mjs",
  "tests/vercel-app-root-config.test.mjs",
  "tests/vercel-build-routing.test.mjs",
]);

function isWebOnlyBranch(branch) {
  return branch.startsWith("ux/") || branch.startsWith("web/") || branch.includes("website-43");
}

function isAdminOnlyBranch(branch) {
  return branch.startsWith("admin/") || branch.startsWith("codex/admin-") || branch.includes("website-42");
}

function hasPrefix(path, prefixes) {
  return prefixes.some((prefix) => path.startsWith(prefix));
}

export function classifyProductionChanges(changedPaths) {
  if (!Array.isArray(changedPaths) || changedPaths.length === 0) return "mixed-or-unknown";

  let hasAdminChange = false;
  let hasWebChange = false;
  let hasNeutralChange = false;
  for (const path of changedPaths) {
    if (typeof path !== "string" || !path || path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) {
      return "mixed-or-unknown";
    }
    if (NEUTRAL_FILES.has(path) || hasPrefix(path, NEUTRAL_PREFIXES)) {
      hasNeutralChange = true;
      continue;
    }
    if (WEB_ONLY_FILES.has(path) || hasPrefix(path, WEB_ONLY_PREFIXES)) {
      hasWebChange = true;
      continue;
    }
    if (hasPrefix(path, ADMIN_ONLY_PREFIXES)) {
      hasAdminChange = true;
      continue;
    }
    return "mixed-or-unknown";
  }

  if (hasAdminChange && !hasWebChange) return "admin-only";
  if (hasWebChange && !hasAdminChange) return "web-only";
  if (!hasAdminChange && !hasWebChange && hasNeutralChange) return "neutral-only";
  return "mixed-or-unknown";
}

function isGitSha(value) {
  return typeof value === "string" && /^[0-9a-f]{7,64}$/i.test(value);
}

export function readProductionChangedPaths({
  commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim(),
  previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA?.trim(),
  cwd = process.cwd(),
  execFileSyncImpl = execFileSync,
} = {}) {
  if (!isGitSha(commitSha) || (previousSha && !isGitSha(previousSha))) return null;
  const baseRef = previousSha || `${commitSha}^`;

  try {
    const output = execFileSyncImpl(
      "git",
      ["diff", "--name-only", "-z", "--diff-filter=ACDMRTUXB", baseRef, commitSha, "--"],
      {
        cwd,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5_000,
      },
    );
    const paths = output.split("\0").filter(Boolean);
    return paths.length ? paths : null;
  } catch {
    return null;
  }
}

export function shouldBuild({ projectId, environment, branch, changedPaths }) {
  if (![WEB_PROJECT_ID, ADMIN_PROJECT_ID].includes(projectId)) return false;
  if (environment === "production") {
    const classification = classifyProductionChanges(changedPaths);
    if (classification === "admin-only") return projectId === ADMIN_PROJECT_ID;
    if (classification === "web-only") return projectId === WEB_PROJECT_ID;
    // Production push CI promotes the exact Admin SHA after verification, so
    // neutral control-plane/test changes still need an Admin candidate. They do
    // not need a Web deployment.
    if (classification === "neutral-only") return projectId === ADMIN_PROJECT_ID;
    return true;
  }
  if (!branch) return false;
  if (projectId === WEB_PROJECT_ID && isAdminOnlyBranch(branch)) return false;
  if (projectId === ADMIN_PROJECT_ID && isWebOnlyBranch(branch)) return false;
  const classification = classifyProductionChanges(changedPaths);
  if (classification === "admin-only" || classification === "neutral-only") {
    return projectId === ADMIN_PROJECT_ID;
  }
  if (classification === "web-only") return projectId === WEB_PROJECT_ID;
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const environment = process.env.VERCEL_ENV?.trim() ?? "";
  const build = shouldBuild({
    projectId: process.env.VERCEL_PROJECT_ID?.trim() ?? "",
    environment,
    branch: process.env.VERCEL_GIT_COMMIT_REF?.trim() ?? "",
    changedPaths: readProductionChangedPaths(),
  });

  console.log(build ? "Vercel build routing: BUILD" : "Vercel build routing: SKIP");
  process.exitCode = build ? 1 : 0;
}
