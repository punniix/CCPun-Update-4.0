import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { classifyProductionChanges, shouldBuild } from "../scripts/vercel-ignore-build.mjs";

const web = "prj_dxwjITkd0av5QiJQv2snUlIASUWu";
const admin = "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN";
const scriptPath = fileURLToPath(new URL("../scripts/vercel-ignore-build.mjs", import.meta.url));

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function commitFixture(cwd, path, content, message) {
  const target = join(cwd, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  git(cwd, "add", path);
  git(cwd, "commit", "-m", message);
  return git(cwd, "rev-parse", "HEAD");
}

function runIgnoredBuild(cwd, { projectId, environment, branch, previousSha, commitSha }) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd,
    env: {
      ...process.env,
      VERCEL_PROJECT_ID: projectId,
      VERCEL_ENV: environment,
      VERCEL_GIT_COMMIT_REF: branch,
      ...(previousSha ? { VERCEL_GIT_PREVIOUS_SHA: previousSha } : {}),
      ...(commitSha ? { VERCEL_GIT_COMMIT_SHA: commitSha } : {}),
    },
    encoding: "utf8",
  });
}

test("Website 4.3 and its historical UX branch build only in the Web survivor", () => {
  for (const branch of ["ux/final-4.2", "web/website-43-homepage", "codex/website-43-accessibility"]) {
    const input = { environment: "preview", branch };
    assert.equal(shouldBuild({ ...input, projectId: web }), true);
    assert.equal(shouldBuild({ ...input, projectId: admin }), false);
  }
});

test("Website 4.2 and Admin-only branches build only in the Admin survivor", () => {
  for (const branch of ["admin/review-queue", "codex/admin-oauth", "codex/website-42-social-foundation", "codex/website-42-social-media-integration-20260829"]) {
    const input = { environment: "preview", branch };
    assert.equal(shouldBuild({ ...input, projectId: web }), false);
    assert.equal(shouldBuild({ ...input, projectId: admin }), true);
  }
});

test("shared 4.1 Preview releases build in both survivors", () => {
  for (const projectId of [web, admin]) {
    assert.equal(shouldBuild({ projectId, environment: "preview", branch: "codex/website-41-p0-security-20260827" }), true);
  }
});

test("Production routing classifies legacy roots, isolated app roots and fail-safe changes", () => {
  const pr45Paths = [
    "AGENTS.md",
    "HANDOFF.md",
    "app/api/admin/social/operations/route.ts",
    "cms/sanity/schema/documents/social-variant.ts",
    "db/migrations/20260829_website_42_social_post_formats.sql",
    "features/admin/social/operations-page.tsx",
    "lib/admin/social/database.ts",
    "scripts/vercel-ignore-build.mjs",
    "tests/admin/social-foundation.test.ts",
    "tests/vercel-build-routing.test.mjs",
  ];
  const website43Paths = ["features/home/components/Hero.tsx", "app/page.tsx", "public/assets/home-hero.webp"];
  const isolatedAdminPaths = [
    "apps/admin/app/(control-plane)/dashboard/page.tsx",
    "apps/admin/app/api/admin/session/route.ts",
    "apps/admin/next.config.ts",
  ];
  const isolatedWebPaths = [
    "apps/web/app/page.tsx",
    "apps/web/app/blog/page.tsx",
    "apps/web/next.config.ts",
  ];
  const adminHardeningPaths = [
    ".github/workflows/sanity-free-plan-privacy.yml",
    "docs/architecture/admin-platform-extension-contract.md",
    "apps/admin/README.md",
    "lib/admin/social/schema-capabilities.ts",
    "tests/admin/social-schema-capabilities.test.ts",
  ];

  assert.equal(classifyProductionChanges(pr45Paths), "admin-only");
  assert.equal(classifyProductionChanges(website43Paths), "web-only");
  assert.equal(classifyProductionChanges(isolatedAdminPaths), "admin-only");
  assert.equal(classifyProductionChanges(isolatedWebPaths), "web-only");
  assert.equal(classifyProductionChanges(adminHardeningPaths), "admin-only");
  assert.equal(classifyProductionChanges([isolatedAdminPaths[0], isolatedWebPaths[0]]), "mixed-or-unknown");
  assert.equal(classifyProductionChanges([pr45Paths[2], website43Paths[0]]), "mixed-or-unknown");
  for (const sharedPath of [
    ".github/workflows/ci.yml",
    "middleware.ts",
    "next.config.ts",
    "package-lock.json",
    "package.json",
    "packages/shared/index.ts",
    "scripts/release.mjs",
    "vercel.json",
  ]) {
    assert.equal(classifyProductionChanges([pr45Paths[2], sharedPath]), "mixed-or-unknown", sharedPath);
  }
  assert.equal(classifyProductionChanges([]), "mixed-or-unknown");

  assert.equal(shouldBuild({ projectId: web, environment: "production", branch: "v4-production", changedPaths: pr45Paths }), false);
  assert.equal(shouldBuild({ projectId: admin, environment: "production", branch: "v4-production", changedPaths: pr45Paths }), true);
  assert.equal(shouldBuild({ projectId: web, environment: "production", branch: "v4-production", changedPaths: adminHardeningPaths }), false);
  assert.equal(shouldBuild({ projectId: admin, environment: "production", branch: "v4-production", changedPaths: adminHardeningPaths }), true);
  assert.equal(shouldBuild({ projectId: web, environment: "production", branch: "v4-production", changedPaths: website43Paths }), true);
  assert.equal(shouldBuild({ projectId: admin, environment: "production", branch: "v4-production", changedPaths: website43Paths }), false);
  assert.equal(shouldBuild({ projectId: web, environment: "production", branch: "v4-production", changedPaths: isolatedWebPaths }), true);
  assert.equal(shouldBuild({ projectId: admin, environment: "production", branch: "v4-production", changedPaths: isolatedWebPaths }), false);
  assert.equal(shouldBuild({ projectId: web, environment: "production", branch: "v4-production", changedPaths: isolatedAdminPaths }), false);
  assert.equal(shouldBuild({ projectId: admin, environment: "production", branch: "v4-production", changedPaths: isolatedAdminPaths }), true);
  for (const projectId of [web, admin]) {
    assert.equal(shouldBuild({ projectId, environment: "production", branch: "v4-production", changedPaths: ["middleware.ts"] }), true);
    assert.equal(shouldBuild({ projectId, environment: "production", branch: "v4-production", changedPaths: null }), true);
  }
});

test("unknown Projects or missing branch identity fail closed", () => {
  assert.equal(shouldBuild({ projectId: "prj_legacy", environment: "preview", branch: "ux/final-4.2" }), false);
  assert.equal(shouldBuild({ projectId: web, environment: "preview", branch: "" }), false);
});

test("Ignored Build Step uses Vercel exit semantics", () => {
  const run = (projectId) => runIgnoredBuild(process.cwd(), {
    projectId,
    environment: "preview",
    branch: "ux/final-4.2",
  });

  assert.equal(run(web).status, 1, "exit 1 continues the Web build");
  assert.equal(run(admin).status, 0, "exit 0 skips the Admin build");
});

test("Production Ignored Build Step uses native git evidence and fails safe", () => {
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-vercel-routing-"));
  try {
    git(fixture, "init", "--quiet");
    git(fixture, "config", "user.name", "CCPun Routing Test");
    git(fixture, "config", "user.email", "routing-test@example.invalid");
    const base = commitFixture(fixture, "README.md", "base\n", "base");
    const adminCommit = commitFixture(fixture, "lib/admin/social/foundation.ts", "export {};\n", "admin");
    const webCommit = commitFixture(fixture, "features/home/page.tsx", "export default null;\n", "web");
    const isolatedWebCommit = commitFixture(fixture, "apps/web/app/page.tsx", "export default null;\n", "isolated web");
    const isolatedAdminCommit = commitFixture(fixture, "apps/admin/app/page.tsx", "export default null;\n", "isolated admin");
    const unknownCommit = commitFixture(fixture, "middleware.ts", "export {};\n", "unknown");

    assert.equal(runIgnoredBuild(fixture, { projectId: web, environment: "production", branch: "v4-production", previousSha: base, commitSha: adminCommit }).status, 0);
    assert.equal(runIgnoredBuild(fixture, { projectId: admin, environment: "production", branch: "v4-production", previousSha: base, commitSha: adminCommit }).status, 1);
    assert.equal(runIgnoredBuild(fixture, { projectId: web, environment: "production", branch: "v4-production", previousSha: adminCommit, commitSha: webCommit }).status, 1);
    assert.equal(runIgnoredBuild(fixture, { projectId: admin, environment: "production", branch: "v4-production", previousSha: adminCommit, commitSha: webCommit }).status, 0);
    assert.equal(runIgnoredBuild(fixture, { projectId: web, environment: "production", branch: "v4-production", previousSha: webCommit, commitSha: isolatedWebCommit }).status, 1);
    assert.equal(runIgnoredBuild(fixture, { projectId: admin, environment: "production", branch: "v4-production", previousSha: webCommit, commitSha: isolatedWebCommit }).status, 0);
    assert.equal(runIgnoredBuild(fixture, { projectId: web, environment: "production", branch: "v4-production", previousSha: isolatedWebCommit, commitSha: isolatedAdminCommit }).status, 0);
    assert.equal(runIgnoredBuild(fixture, { projectId: admin, environment: "production", branch: "v4-production", previousSha: isolatedWebCommit, commitSha: isolatedAdminCommit }).status, 1);
    for (const projectId of [web, admin]) {
      assert.equal(runIgnoredBuild(fixture, { projectId, environment: "production", branch: "v4-production", previousSha: isolatedAdminCommit, commitSha: unknownCommit }).status, 1);
      assert.equal(runIgnoredBuild(fixture, { projectId, environment: "production", branch: "v4-production", previousSha: "deadbeef", commitSha: unknownCommit }).status, 1);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("repository has no Vercel cron or scheduled GitHub workflow", () => {
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(Object.hasOwn(vercel, "crons"), false);

  const workflowDirectory = fileURLToPath(new URL("../.github/workflows/", import.meta.url));
  const workflows = readdirSync(workflowDirectory).filter((file) => /\.ya?ml$/i.test(file));
  assert.ok(workflows.length > 0);
  for (const workflow of workflows) {
    const source = readFileSync(join(workflowDirectory, workflow), "utf8");
    assert.doesNotMatch(source, /^\s*schedule\s*:/m, workflow);
  }
});
