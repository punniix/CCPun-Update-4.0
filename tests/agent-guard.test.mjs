import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  checkBranchEvent, checkPullRequest, checkPush, classifyBranch, evaluateWorktrees, extractTaskId,
  parseWorktreePorcelain, RELEASE_PATTERNS,
} from "../scripts/agent-guard.mjs";

const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);
const ZERO = "0".repeat(40);
const GUARD = new URL("../scripts/agent-guard.mjs", import.meta.url).pathname;

test("allowlist accepts exactly one branch per agent task (no -uat twin)", () => {
  assert.deepEqual(classifyBranch("codex/fix/heart-activated-at-20261023"), {
    kind: "agent", name: "codex/fix/heart-activated-at-20261023", agent: "codex", type: "fix",
    taskId: "heart-activated-at-20261023",
  });
  // Owner decision R8 (2026-10-25): UAT deploys from the same work branch, so -uat twins are not allowlisted.
  const port = classifyBranch("claude/feat/cms-copy-editor-20261023-uat");
  assert.equal(port.kind, "invalid");
  assert.equal(checkPush({ localRef: "refs/heads/x", localOid: "a".repeat(40), remoteRef: "refs/heads/claude/feat/cms-copy-editor-20261023-uat", remoteOid: "0".repeat(40) }).level, "error");
  assert.equal(classifyBranch("khai/hotfix/ga4-events-outage-20261024").agent, "khai");
  assert.equal(classifyBranch("owner/docs/agent-rules-20261024").kind, "agent");
});

test("legacy, undated, unknown-agent and malformed names are not allowlisted", () => {
  for (const name of [
    "feat/cms-copy-editor-20261023", "codex/website-42-social-foundation", "codex/fix/no-date",
    "codex/fix/bad-month-20261324", "gemini/fix/task-20261024", "codex/wip/task-20261024",
    "codex/fix/Upper-Case-20261024", "codex/fix/task-20261024-uat-uat", "main", "web-uat",
    `codex/fix/${"x".repeat(100)}-20261024`,
  ]) assert.equal(classifyBranch(name).kind, "invalid", name);
});

test("release pins keep the exact runtime-contract names and reject variants", () => {
  assert.deepEqual(classifyBranch(`codex/hostinger-release-production-${SHA}`), {
    kind: "release", name: `codex/hostinger-release-production-${SHA}`, lane: "production", sha: SHA,
  });
  assert.equal(classifyBranch(`codex/hostinger-release-uat-${SHA}`).lane, "uat");
  assert.equal(classifyBranch(`admin/hostinger-release-uat-${SHA}`).lane, "admin-uat");
  for (const name of ["admin/hostinger-release-uat-p1-async-20261010", "admin/hostinger-release-uat-a536e3f0", `codex/hostinger-release-production-${SHA}-v2`]) {
    const info = classifyBranch(name);
    assert.equal(info.kind, "invalid", name);
    assert.match(info.reason, /release step/);
  }
  assert.equal(classifyBranch("v4-production").kind, "protected");
  assert.equal(classifyBranch("uat").kind, "protected");
  assert.equal(classifyBranch("dependabot/npm_and_yarn/next-16.4.3").kind, "bot");
});

test("guard release prefixes stay in lockstep with the runtime release-ref parsers", () => {
  const sources = ["scripts/build-root.mjs", "lib/runtime/hostinger-production-release.mjs", "cms/sanity/policy/studio-policy.ts"]
    .map((file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8")).join("\n");
  for (const { prefix } of RELEASE_PATTERNS) {
    const literal = prefix.startsWith("admin/") ? "admin\\/hostinger-release-uat-" : prefix;
    assert.ok(sources.includes(literal), `runtime no longer parses ${prefix}; update the guard and AGENTS.md together`);
  }
});

test("pre-push blocks new off-list branches, protected pushes and casual release pins", () => {
  const push = (name, localOid, remoteOid, env = {}) => checkPush({
    localRef: `refs/heads/${name}`, localOid, remoteRef: `refs/heads/${name}`, remoteOid, env,
  });
  assert.equal(push("codex/fix/task-20261024", SHA, ZERO).level, "ok");
  assert.equal(push("my-experiment", SHA, ZERO).level, "error");
  assert.equal(push("feat/cms-copy-editor-20261023", SHA, OTHER).level, "warn");
  assert.equal(push("v4-production", SHA, OTHER).level, "error");
  assert.equal(push(`codex/hostinger-release-uat-${SHA}`, SHA, ZERO).level, "error");
  assert.equal(push(`codex/hostinger-release-uat-${SHA}`, SHA, ZERO, { CCPUN_RELEASE_STEP: "1" }).level, "ok");
  assert.equal(push(`codex/hostinger-release-uat-${SHA}`, OTHER, ZERO, { CCPUN_RELEASE_STEP: "1" }).level, "error");
  assert.equal(push(`codex/hostinger-release-uat-${SHA}`, OTHER, SHA, { CCPUN_RELEASE_STEP: "1" }).level, "error");
  assert.equal(push("my-experiment", ZERO, SHA).level, "ok", "deleting a legacy branch is cleanup");
  assert.equal(checkPush({ localRef: "refs/tags/v1", localOid: SHA, remoteRef: "refs/tags/v1", remoteOid: ZERO }).level, "ok");
});

test("CI push check enforces new names, grandfathers legacy and detects moved pins", () => {
  assert.equal(checkBranchEvent({ name: "scratch", created: true }).level, "error");
  assert.equal(checkBranchEvent({ name: "scratch", created: false }).level, "warn");
  assert.equal(checkBranchEvent({ name: `admin/hostinger-release-uat-${SHA}`, headSha: SHA }).level, "ok");
  assert.equal(checkBranchEvent({ name: `admin/hostinger-release-uat-${SHA}`, headSha: OTHER }).level, "error");
});

test("pull requests must carry the branch Task-ID and never involve release pins", () => {
  const head = "claude/fix/gsc-sync-origin-20261024";
  assert.equal(extractTaskId("Summary\n\nTask-ID: `gsc-sync-origin-20261024`\n"), "gsc-sync-origin-20261024");
  assert.equal(extractTaskId("Task-ID: gsc-sync-origin-20261024 <!-- note -->"), "gsc-sync-origin-20261024");
  assert.equal(extractTaskId("Task-ID: <!-- required -->"), null);
  assert.deepEqual(checkPullRequest({ headRef: head, baseRef: "v4-production", body: "Task-ID: gsc-sync-origin-20261024" }).map((f) => f.level), ["ok"]);
  assert.equal(checkPullRequest({ headRef: head, baseRef: "v4-production", body: "no id" })[0].level, "error");
  assert.equal(checkPullRequest({ headRef: head, baseRef: "v4-production", body: "Task-ID: other-20261024" })[0].level, "error");
  assert.equal(checkPullRequest({ headRef: head, baseRef: `codex/hostinger-release-uat-${SHA}`, body: "Task-ID: gsc-sync-origin-20261024" })[0].level, "error");
  assert.equal(checkPullRequest({ headRef: "feat/legacy-20261001", baseRef: "v4-production", body: "" })[0].level, "warn");
  assert.equal(checkPullRequest({ headRef: "dependabot/npm/x", baseRef: "v4-production", body: "" })[0].level, "ok");
});

test("worktree evaluation allows one fixed slot per agent and workstream", () => {
  const root = "/wt";
  const porcelain = [
    "worktree /repo\nHEAD 1111\nbranch refs/heads/v4-production",
    "worktree /wt/codex/web\nHEAD 2222\nbranch refs/heads/codex/feat/home-hero-20261024",
    "worktree /wt/claude/audit\nHEAD 3333\ndetached",
    "worktree /wt/claude/admin\nHEAD 4444\nbranch refs/heads/codex/fix/other-20261024",
    "worktree /Users/x/Desktop/Dev/Worktrees/foo\nHEAD 5555\nbranch refs/heads/codex/fix/foo-20261024",
    "worktree /wt/khai/web\nHEAD 6666\ndetached",
    "worktree /wt/codex/admin\nHEAD 7777\nbranch refs/heads/codex/fix/gone-20261024\nprunable gitdir file points to non-existent location",
    "",
  ].join("\n\n");
  const entries = parseWorktreePorcelain(porcelain);
  assert.equal(entries.length, 7);
  assert.equal(entries[2].detached, true);
  const report = evaluateWorktrees(entries, { root });
  assert.equal(report.main, "/repo");
  assert.deepEqual(report.perAgent.codex, { web: "codex/feat/home-hero-20261024" });
  assert.deepEqual(report.violations.map((v) => v.path), [
    "/wt/claude/admin", "/Users/x/Desktop/Dev/Worktrees/foo", "/wt/khai/web", "/wt/codex/admin",
  ]);
});

test("CLI start/report/pre-push/cleanup work end to end in a scratch repository", () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "agent-guard-")));
  const repo = join(base, "repo");
  const root = join(base, "worktrees");
  const env = {
    ...process.env, CCPUN_WORKTREE_ROOT: root, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(base, "gitconfig"),
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid",
  };
  delete env.GITHUB_ACTIONS;
  writeFileSync(env.GIT_CONFIG_GLOBAL, "");
  const run = (args, input) => spawnSync(process.execPath, [GUARD, ...args], { cwd: repo, env, encoding: "utf8", input });
  const sh = (args) => execFileSync("git", args, { cwd: repo, env, encoding: "utf8" });
  try {
    execFileSync("git", ["init", "-q", "-b", "v4-production", repo], { env });
    writeFileSync(join(repo, "README.md"), "x\n");
    sh(["add", "."]);
    sh(["commit", "-q", "-m", "init"]);
    sh(["update-ref", "refs/remotes/origin/v4-production", "HEAD"]);

    const start = ["start", "--agent", "codex", "--workstream", "web", "--type", "fix", "--task", "demo-20261024", "--no-fetch"];
    assert.equal(run(start).status, 0);
    const busy = run([...start.slice(0, -3), "other-20261024", "--no-fetch"]);
    assert.equal(busy.status, 1);
    assert.match(busy.stderr, /busy/);
    assert.equal(run(["start", "--agent", "codex", "--workstream", "admin", "--type", "fix", "--task", "nodate", "--no-fetch"]).status, 1);

    let report = JSON.parse(run(["report", "--json"]).stdout);
    assert.equal(report.worktrees.linked, 1);
    assert.deepEqual(report.worktrees.violations, []);
    assert.equal(report.localBranches.counts.agent, 1);

    sh(["worktree", "add", "-q", "-b", "scratch", join(base, "rogue")]);
    assert.equal(run(["report", "--strict"]).status, 1);
    sh(["worktree", "remove", join(base, "rogue")]);
    sh(["branch", "-D", "scratch"]);

    const blocked = run(["pre-push"], `refs/heads/scratch ${SHA} refs/heads/scratch ${ZERO}\n`);
    assert.equal(blocked.status, 1);
    assert.match(blocked.stderr, /not on the allowlist/);
    assert.equal(run(["pre-push"], `refs/heads/codex/fix/demo-20261024 ${SHA} refs/heads/codex/fix/demo-20261024 ${ZERO}\n`).status, 0);

    assert.match(run(["cleanup"]).stdout, /WOULD REMOVE .*codex\/web/);
    assert.equal(run(["cleanup", "--apply"]).status, 0);
    report = JSON.parse(run(["report", "--json"]).stdout);
    assert.equal(report.worktrees.linked, 0);
    assert.equal(report.localBranches.counts.agent, 0);

    assert.equal(run(["install-hook"]).status, 0);
    assert.match(readFileSync(join(repo, ".git", "hooks", "pre-push"), "utf8"), /agent-guard\.mjs" pre-push/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("WARN burn-in mode reports violations without failing; enforce fails them", () => {
  const env = { ...process.env };
  delete env.GITHUB_ACTIONS;
  const run = (args) => spawnSync(process.execPath, [GUARD, ...args], { env, encoding: "utf8" });
  const bad = ["check-branch", "random-new-branch", "--created"];
  const warned = run([...bad, "--mode", "warn"]);
  assert.equal(warned.status, 0);
  assert.match(warned.stdout, /^WARN .*not on the allowlist/m);
  assert.equal(run([...bad, "--mode", "enforce"]).status, 1);
  assert.equal(run(["check-branch", "claude/chore/agent-scope-guard-20261025", "--created", "--mode", "enforce"]).status, 0);
  const workflow = readFileSync(new URL("../.github/workflows/agent-scope-guard.yml", import.meta.url), "utf8");
  assert.match(workflow, /AGENT_GUARD_MODE: (warn|enforce)\b/);
  assert.match(workflow, /TODO\(2026-11-01\)/);
});

test("start refuses the retired --uat twin flag", () => {
  const env = { ...process.env, CCPUN_WORKTREE_ROOT: join(tmpdir(), "agent-guard-uat-check") };
  const out = spawnSync(process.execPath, [GUARD, "start", "--agent", "codex", "--workstream", "web", "--type", "fix",
    "--task", "demo-20261025", "--uat", "--no-fetch", "--dry-run"], { env, encoding: "utf8" });
  assert.equal(out.status, 1);
  assert.match(out.stderr, /--uat was retired/);
});
