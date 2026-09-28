import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const WEB_PROJECT_ID = "prj_dxwjITkd0av5QiJQv2snUlIASUWu";
const ADMIN_PROJECT_ID = "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN";
const BUILDLESS_PREFIXES = [
  ".github/",
  "db/",
  "qa/",
  "tests/",
  "workers/",
];

const ADMIN_ONLY_PREFIXES = [
  "apps/admin/",
  "app/(control-plane)/",
  "app/(control-plane-auth)/",
  "app/(control-plane-error)/",
  "app/api/admin/",
  "app/studio/",
  "cms/sanity/",
  "features/admin/",
  "lib/admin/",
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
const BUILDLESS_FILES = new Set([
  "AGENTS.md",
  "HANDOFF.md",
  "README.md",
  "scripts/vercel-ignore-build.mjs",
]);

function hasPrefix(path, prefixes) {
  return prefixes.some((prefix) => path.startsWith(prefix));
}

export function classifyProductionChanges(changedPaths) {
  if (!Array.isArray(changedPaths) || changedPaths.length === 0) return "mixed-or-unknown";

  let hasAdminChange = false;
  let hasWebChange = false;
  let hasBuildlessChange = false;
  for (const path of changedPaths) {
    if (typeof path !== "string" || !path || path.includes("\\") || path.includes("\0") || path.split("/").some((part) => !part || part === "." || part === "..")) {
      return "mixed-or-unknown";
    }
    if (
      BUILDLESS_FILES.has(path)
      || hasPrefix(path, BUILDLESS_PREFIXES)
      || (path.startsWith("docs/") && path.endsWith(".md"))
    ) {
      hasBuildlessChange = true;
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

  if (hasAdminChange && hasWebChange) return "mixed-or-unknown";
  if (hasAdminChange) return "admin-only";
  if (hasWebChange) return "web-only";
  if (hasBuildlessChange) return "buildless-only";
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

export function shouldBuild({ projectId, environment, changedPaths }) {
  if (![WEB_PROJECT_ID, ADMIN_PROJECT_ID].includes(projectId)) return false;
  if (environment !== "production" && environment !== "preview") return true;
  if (environment === "production") {
    const classification = classifyProductionChanges(changedPaths);
    if (classification === "buildless-only") return false;
    if (classification === "admin-only") return projectId === ADMIN_PROJECT_ID;
    if (classification === "web-only") return projectId === WEB_PROJECT_ID;
    return true;
  }
  const classification = classifyProductionChanges(changedPaths);
  if (classification === "buildless-only") return false;
  if (classification === "admin-only") {
    return projectId === ADMIN_PROJECT_ID;
  }
  if (classification === "web-only") return projectId === WEB_PROJECT_ID;
  // ponytail: unavailable or unknown diffs build both; branch names cannot prove scope.
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const environment = process.env.VERCEL_ENV?.trim() ?? "";
  const build = shouldBuild({
    projectId: process.env.VERCEL_PROJECT_ID?.trim() ?? "",
    environment,
    changedPaths: readProductionChangedPaths(),
  });

  console.log(build ? "Vercel build routing: BUILD" : "Vercel build routing: SKIP");
  process.exitCode = build ? 1 : 0;
}
