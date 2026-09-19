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

test("shared Preview branches isolate builds when native changed-path evidence is conclusive", () => {
  const branch = "feature/line-rich-menu-control-plane-20260919";
  const adminPaths = ["tests/admin/ecosystem-control-plane-migrations.test.ts"];
  const webPaths = ["apps/web/lib/line/private-ingestion.ts"];
  const mixedPaths = [...adminPaths, ...webPaths];

  assert.equal(shouldBuild({ projectId: web, environment: "preview", branch, changedPaths: adminPaths }), false);
  assert.equal(shouldBuild({ projectId: admin, environment: "preview", branch, changedPaths: adminPaths }), true);
  assert.equal(shouldBuild({ projectId: web, environment: "preview", branch, changedPaths: webPaths }), true);
  assert.equal(shouldBuild({ projectId: admin, environment: "preview", branch, changedPaths: webPaths }), false);
  for (const projectId of [web, admin]) {
    assert.equal(shouldBuild({ projectId, environment: "preview", branch, changedPaths: mixedPaths }), true);
    assert.equal(shouldBuild({ projectId, environment: "preview", branch, changedPaths: null }), true);
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
  const neutralOnlyPaths = [
    ".github/workflows/seo-topic-hubs-ci.yml",
    "scripts/vercel-ignore-build.mjs",
    "tests/vercel-app-root-config.test.mjs",
    "tests/vercel-build-routing.test.mjs",
  ];
  const friendlyMotionPaths = [
    "components/layout/website-43/Website43ToolHero.tsx",
    "components/ui/CurrencyInput.tsx",
    "components/ui/FunctionalMotion.module.css",
    "components/ui/HumanCalculatorCard.tsx",
    "features/ci-planning/components/CIWizard.tsx",
    "features/ci-planning/components/result/CIResult.tsx",
    "features/ci-planning/page.tsx",
    "features/financial-health-check/components/ClientFHC.tsx",
    "features/financial-health-check/components/LifeCoverageWizard.tsx",
    "tests/website43-public-motion-regression.mjs",
  ];
  const heroPressFollowupPaths = [
    "components/layout/website-43/Website43ToolHero.tsx",
    "tests/website43-public-motion-regression.mjs",
  ];
  const pr160Paths = [
    ".github/workflows/seo-topic-hubs-ci.yml",
    "apps/admin/app/(control-plane)/layout.tsx",
    "apps/admin/app/(control-plane)/social/posts/page.tsx",
    "apps/admin/app/api/admin/social/drafts/instagram-audio/route.ts",
    "apps/admin/app/api/admin/social/publications/cancel/route.ts",
    "apps/admin/app/api/admin/social/publications/reschedule/route.ts",
    "apps/admin/app/api/admin/social/worker/route.ts",
    "apps/admin/vercel.json",
    "cms/sanity/schema/documents/social-variant.ts",
    "features/admin/components/AdminNavigation.tsx",
    "features/admin/social/InstagramMobileHandoff.tsx",
    "features/admin/social/SocialMediaMetadataPanel.tsx",
    "features/admin/social/SocialOperationalCalendar.tsx",
    "features/admin/social/SocialQueueClient.tsx",
    "features/admin/social/SocialReviewAttention.tsx",
    "features/admin/social/calendar-page.tsx",
    "features/admin/social/connections-page.tsx",
    "features/admin/social/instagram-mobile-handoff.ts",
    "features/admin/social/operations-page.tsx",
    "features/admin/social/overview-page.tsx",
    "features/admin/social/posts-page.tsx",
    "features/admin/social/social-operation-client.ts",
    "features/admin/social/social-workspace-client.ts",
    "features/admin/social/social-workspace-media.ts",
    "lib/admin/social/draft-contract.ts",
    "lib/admin/social/drafts.ts",
    "lib/admin/social/instagram-audio-config.ts",
    "lib/admin/social/operations-service.ts",
    "lib/admin/social/worker.ts",
    "tests/admin/presentation.test.ts",
    "tests/admin/social-instagram-mobile-handoff.test.ts",
    "tests/admin/social-meta-connection.test.ts",
    "tests/admin/social-operations-2-regression.test.ts",
    "tests/admin/social-operations-core.test.ts",
    "tests/admin/social-post-live.test.ts",
    "tests/vercel-app-root-config.test.mjs",
  ];

  assert.equal(classifyProductionChanges(pr45Paths), "admin-only");
  assert.equal(classifyProductionChanges(website43Paths), "web-only");
  assert.equal(classifyProductionChanges(isolatedAdminPaths), "admin-only");
  assert.equal(classifyProductionChanges(isolatedWebPaths), "web-only");
  assert.equal(classifyProductionChanges(adminHardeningPaths), "admin-only");
  assert.equal(classifyProductionChanges(neutralOnlyPaths), "neutral-only");
  assert.equal(classifyProductionChanges(pr160Paths), "admin-only");
  assert.equal(classifyProductionChanges(friendlyMotionPaths), "web-only");
  assert.equal(classifyProductionChanges(heroPressFollowupPaths), "web-only");
  assert.equal(classifyProductionChanges([isolatedAdminPaths[0], isolatedWebPaths[0]]), "mixed-or-unknown");
  assert.equal(classifyProductionChanges([pr45Paths[2], website43Paths[0]]), "mixed-or-unknown");
  assert.equal(
    classifyProductionChanges(["components/layout/website-43/Website43ResponsiveStyles.tsx"]),
    "mixed-or-unknown",
    "Admin imports Website43ResponsiveStyles at runtime",
  );
  assert.equal(
    classifyProductionChanges(["components/layout/website-43/Website43.module.css"]),
    "mixed-or-unknown",
    "Website43.module.css is shared by the Admin responsive-style runtime",
  );
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
  assert.equal(shouldBuild({ projectId: web, environment: "production", branch: "v4-production", changedPaths: neutralOnlyPaths }), false);
  assert.equal(shouldBuild({ projectId: admin, environment: "production", branch: "v4-production", changedPaths: neutralOnlyPaths }), true);
  assert.equal(shouldBuild({ projectId: web, environment: "production", branch: "v4-production", changedPaths: pr160Paths }), false);
  assert.equal(shouldBuild({ projectId: admin, environment: "production", branch: "v4-production", changedPaths: pr160Paths }), true);
  assert.equal(shouldBuild({ projectId: web, environment: "production", branch: "v4-production", changedPaths: website43Paths }), true);
  assert.equal(shouldBuild({ projectId: admin, environment: "production", branch: "v4-production", changedPaths: website43Paths }), false);
  assert.equal(shouldBuild({ projectId: web, environment: "production", branch: "v4-production", changedPaths: isolatedWebPaths }), true);
  assert.equal(shouldBuild({ projectId: admin, environment: "production", branch: "v4-production", changedPaths: isolatedWebPaths }), false);
  assert.equal(shouldBuild({ projectId: web, environment: "production", branch: "v4-production", changedPaths: isolatedAdminPaths }), false);
  assert.equal(shouldBuild({ projectId: admin, environment: "production", branch: "v4-production", changedPaths: isolatedAdminPaths }), true);
  assert.equal(shouldBuild({ projectId: web, environment: "production", branch: "v4-production", changedPaths: friendlyMotionPaths }), true);
  assert.equal(shouldBuild({ projectId: admin, environment: "production", branch: "v4-production", changedPaths: friendlyMotionPaths }), false);
  assert.equal(shouldBuild({ projectId: web, environment: "production", branch: "v4-production", changedPaths: heroPressFollowupPaths }), true);
  assert.equal(shouldBuild({ projectId: admin, environment: "production", branch: "v4-production", changedPaths: heroPressFollowupPaths }), false);
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
    const neutralCommit = commitFixture(fixture, ".github/workflows/seo-topic-hubs-ci.yml", "name: fixture\n", "neutral");
    const adminCommit = commitFixture(fixture, "lib/admin/social/foundation.ts", "export {};\n", "admin");
    const webCommit = commitFixture(fixture, "features/home/page.tsx", "export default null;\n", "web");
    const isolatedWebCommit = commitFixture(fixture, "apps/web/app/page.tsx", "export default null;\n", "isolated web");
    const isolatedAdminCommit = commitFixture(fixture, "apps/admin/app/page.tsx", "export default null;\n", "isolated admin");
    const unknownCommit = commitFixture(fixture, "middleware.ts", "export {};\n", "unknown");

    assert.equal(runIgnoredBuild(fixture, { projectId: web, environment: "production", branch: "v4-production", previousSha: base, commitSha: neutralCommit }).status, 0);
    assert.equal(runIgnoredBuild(fixture, { projectId: admin, environment: "production", branch: "v4-production", previousSha: base, commitSha: neutralCommit }).status, 1);
    assert.equal(runIgnoredBuild(fixture, { projectId: web, environment: "production", branch: "v4-production", previousSha: neutralCommit, commitSha: adminCommit }).status, 0);
    assert.equal(runIgnoredBuild(fixture, { projectId: admin, environment: "production", branch: "v4-production", previousSha: neutralCommit, commitSha: adminCommit }).status, 1);
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

test("Production merge commit without previous SHA still isolates Web-only shared-root changes", () => {
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-vercel-routing-merge-"));
  try {
    git(fixture, "init", "--quiet");
    git(fixture, "config", "user.name", "CCPun Routing Test");
    git(fixture, "config", "user.email", "routing-test@example.invalid");
    commitFixture(fixture, "README.md", "base\n", "base");
    const baseBranch = git(fixture, "branch", "--show-current");

    git(fixture, "checkout", "-b", "web/friendly-motion");
    commitFixture(
      fixture,
      "components/layout/website-43/Website43ToolHero.tsx",
      "export default function Website43ToolHero() { return null; }\n",
      "web hero",
    );
    commitFixture(
      fixture,
      "tests/website43-public-motion-regression.mjs",
      "export {};\n",
      "web motion test",
    );

    git(fixture, "checkout", baseBranch);
    git(fixture, "merge", "--no-ff", "web/friendly-motion", "-m", "merge web motion");
    const mergeSha = git(fixture, "rev-parse", "HEAD");

    assert.equal(
      runIgnoredBuild(fixture, {
        projectId: web,
        environment: "production",
        branch: "v4-production",
        commitSha: mergeSha,
      }).status,
      1,
      "Web continues build from first-parent merge diff",
    );
    assert.equal(
      runIgnoredBuild(fixture, {
        projectId: admin,
        environment: "production",
        branch: "v4-production",
        commitSha: mergeSha,
      }).status,
      0,
      "Admin skips Web-only first-parent merge diff",
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("Production routing observes deleted Web and Admin files", () => {
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-vercel-routing-delete-"));
  try {
    git(fixture, "init", "--quiet");
    git(fixture, "config", "user.name", "CCPun Routing Test");
    git(fixture, "config", "user.email", "routing-test@example.invalid");
    commitFixture(fixture, "README.md", "base\n", "base");

    const webAdded = commitFixture(
      fixture,
      "features/home/delete-me.tsx",
      "export default null;\n",
      "add web fixture",
    );
    git(fixture, "rm", "features/home/delete-me.tsx");
    git(fixture, "commit", "-m", "delete web fixture");
    const webDeleted = git(fixture, "rev-parse", "HEAD");

    assert.equal(
      runIgnoredBuild(fixture, {
        projectId: web,
        environment: "production",
        branch: "v4-production",
        previousSha: webAdded,
        commitSha: webDeleted,
      }).status,
      1,
      "Web must rebuild when a Web-only file is deleted",
    );
    assert.equal(
      runIgnoredBuild(fixture, {
        projectId: admin,
        environment: "production",
        branch: "v4-production",
        previousSha: webAdded,
        commitSha: webDeleted,
      }).status,
      0,
      "Admin may skip a Web-only deletion",
    );

    const adminAdded = commitFixture(
      fixture,
      "lib/admin/delete-me.ts",
      "export {};\n",
      "add admin fixture",
    );
    git(fixture, "rm", "lib/admin/delete-me.ts");
    git(fixture, "commit", "-m", "delete admin fixture");
    const adminDeleted = git(fixture, "rev-parse", "HEAD");

    assert.equal(
      runIgnoredBuild(fixture, {
        projectId: web,
        environment: "production",
        branch: "v4-production",
        previousSha: adminAdded,
        commitSha: adminDeleted,
      }).status,
      0,
      "Web may skip an Admin-only deletion",
    );
    assert.equal(
      runIgnoredBuild(fixture, {
        projectId: admin,
        environment: "production",
        branch: "v4-production",
        previousSha: adminAdded,
        commitSha: adminDeleted,
      }).status,
      1,
      "Admin must rebuild when an Admin-only file is deleted",
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("repository has no root Vercel cron or scheduled GitHub workflow", () => {
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
