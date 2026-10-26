#!/usr/bin/env node
// Agent scope lock for CCPun: branch-name allowlist, release-pin immutability,
// one worktree per agent per workstream, and post-merge cleanup.
// Read-only unless a command explicitly says otherwise (start, cleanup --apply, install-hook).
// It never deletes remote refs and never uses --force.
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, realpathSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const AGENTS = ["claude", "codex", "khai", "owner"];
export const BRANCH_TYPES = ["feat", "fix", "hotfix", "chore", "docs", "refactor", "perf", "seo", "test", "security", "ops"];
export const WORKSTREAMS = ["hotfix", "web", "admin", "ops", "audit"];
export const PROTECTED_BRANCHES = ["v4-production", "uat"];
export const RELEASE_RETENTION = 3; // current + two rollback pins per lane
// Runtime contracts: scripts/build-root.mjs, lib/runtime/hostinger-production-release.mjs,
// cms/sanity/policy/studio-policy.ts and apps/admin/scripts/build-provider.mjs parse these exact names.
export const RELEASE_PATTERNS = [
  { lane: "uat", prefix: "codex/hostinger-release-uat-", re: /^codex\/hostinger-release-uat-([0-9a-f]{40})$/ },
  { lane: "production", prefix: "codex/hostinger-release-production-", re: /^codex\/hostinger-release-production-([0-9a-f]{40})$/ },
  { lane: "admin-uat", prefix: "admin/hostinger-release-uat-", re: /^admin\/hostinger-release-uat-([0-9a-f]{40})$/ },
];

const DATE = "20\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])";
const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";
export const TASK_ID_RE = new RegExp(`^${SLUG}-${DATE}$`);
const AGENT_BRANCH_RE = new RegExp(`^(${AGENTS.join("|")})/(${BRANCH_TYPES.join("|")})/(${SLUG}-${DATE})$`);
const ZERO_OID = /^0+$/;
const MAX_BRANCH_LENGTH = 100;
const FORMAT_HINT = "use <agent>/<type>/<task-id> (no -uat twin; UAT deploys from the same work branch), e.g. codex/fix/heart-activated-at-20261023 "
  + `(agent: ${AGENTS.join("|")}; type: ${BRANCH_TYPES.join("|")}; task-id: <slug>-<YYYYMMDD>)`;

export function classifyBranch(name) {
  if (PROTECTED_BRANCHES.includes(name)) return { kind: "protected", name };
  for (const { lane, re } of RELEASE_PATTERNS) {
    const match = re.exec(name);
    if (match) return { kind: "release", name, lane, sha: match[1] };
  }
  if (name.startsWith("dependabot/")) return { kind: "bot", name };
  const match = AGENT_BRANCH_RE.exec(name);
  if (match && name.length <= MAX_BRANCH_LENGTH) {
    return { kind: "agent", name, agent: match[1], type: match[2], taskId: match[3] };
  }
  if (RELEASE_PATTERNS.some(({ prefix }) => name.startsWith(prefix)) || /^(codex|admin)\/hostinger-release/.test(name)) {
    return { kind: "invalid", name, reason: "release pins must be exactly <prefix><40-hex sha> and are created only by the release step" };
  }
  if (match) return { kind: "invalid", name, reason: `branch name longer than ${MAX_BRANCH_LENGTH} characters` };
  return { kind: "invalid", name, reason: `not on the allowlist; ${FORMAT_HINT}` };
}

const result = (level, message) => ({ level, message });

// Pre-push decision for one ref. level: "ok" | "warn" | "error".
export function checkPush({ localRef, localOid, remoteRef, remoteOid, env = {} }) {
  if (!remoteRef?.startsWith("refs/heads/")) return result("ok", `${remoteRef}: not a branch`);
  const name = remoteRef.slice("refs/heads/".length);
  const info = classifyBranch(name);
  const deleting = ZERO_OID.test(localOid ?? "") || localRef === "(delete)";
  const creating = ZERO_OID.test(remoteOid ?? "");
  const releaseStep = env.CCPUN_RELEASE_STEP === "1";
  if (info.kind === "protected") {
    return result("error", `${name}: protected branch; open a pull request instead of pushing`);
  }
  if (info.kind === "release") {
    if (!releaseStep) return result("error", `${name}: release pins are created/retired only by the release step (CCPUN_RELEASE_STEP=1)`);
    if (deleting) return result("warn", `${name}: retiring a release pin; confirm it is not the current or rollback build`);
    if (!creating) return result("error", `${name}: release pins are immutable; create a new pin for a new SHA`);
    if (localOid !== info.sha) return result("error", `${name}: pin must point at ${info.sha}, not ${localOid}`);
    return result("ok", `${name}: new release pin`);
  }
  if (deleting) return result("ok", `${name}: branch deletion`);
  if (info.kind === "invalid") {
    return creating
      ? result("error", `${name}: ${info.reason}`)
      : result("warn", `${name}: legacy branch name (grandfathered; finish and delete it, do not create new ones)`);
  }
  return result("ok", `${name}: allowed`);
}

// CI check for a pushed branch (push event).
export function checkBranchEvent({ name, created = false, headSha }) {
  const info = classifyBranch(name);
  if (info.kind === "release") {
    if (headSha && headSha !== info.sha) return result("error", `${name}: release pin moved to ${headSha}; pins must stay at ${info.sha}`);
    return result("ok", `${name}: release pin intact`);
  }
  if (info.kind === "invalid") {
    return created ? result("error", `${name}: ${info.reason}`) : result("warn", `${name}: legacy branch name (grandfathered)`);
  }
  return result("ok", `${name}: allowed (${info.kind})`);
}

export function extractTaskId(body = "") {
  const match = /^\s*Task-ID:\s*`?([a-z0-9-]+)`?\s*(?:<!--.*-->)?\s*$/im.exec(body ?? "");
  return match ? match[1] : null;
}

export function checkPullRequest({ headRef, baseRef, body }) {
  const findings = [];
  const base = classifyBranch(baseRef ?? "");
  if (base.kind === "release") findings.push(result("error", `base ${baseRef}: never target a release pin`));
  else if (base.kind !== "protected") findings.push(result("warn", `base ${baseRef}: stacked PR; prefer v4-production or uat`));
  const head = classifyBranch(headRef ?? "");
  if (head.kind === "release") findings.push(result("error", `head ${headRef}: release pins are deploy refs, not PR sources`));
  else if (head.kind === "invalid") findings.push(result("warn", `head ${headRef}: legacy branch name (grandfathered)`));
  else if (head.kind === "agent") {
    const taskId = extractTaskId(body);
    if (!taskId) findings.push(result("error", `PR body needs a line "Task-ID: ${head.taskId}"`));
    else if (taskId !== head.taskId) findings.push(result("error", `Task-ID ${taskId} does not match branch task ${head.taskId}`));
  }
  return findings.length ? findings : [result("ok", "pull request scope ok")];
}

export function parseWorktreePorcelain(text) {
  const entries = [];
  for (const block of text.split(/\n\s*\n/)) {
    const entry = {};
    for (const line of block.split("\n")) {
      const [key, ...rest] = line.split(" ");
      const value = rest.join(" ");
      if (key === "worktree") entry.path = value;
      else if (key === "HEAD") entry.head = value;
      else if (key === "branch") entry.branch = value.replace(/^refs\/heads\//, "");
      else if (key === "detached" || key === "bare" || key === "locked" || key === "prunable") entry[key] = true;
    }
    if (entry.path) entries.push(entry);
  }
  return entries;
}

export function evaluateWorktrees(entries, { root }) {
  const violations = [];
  const perAgent = {};
  const [main, ...linked] = entries;
  for (const worktree of linked) {
    if (worktree.prunable) {
      violations.push({ path: worktree.path, reason: "stale registration (directory missing); run git worktree prune" });
      continue;
    }
    const rel = relative(root, worktree.path);
    const parts = rel.split(sep);
    if (!rel || rel.startsWith("..") || isAbsolute(rel) || parts.length !== 2) {
      violations.push({ path: worktree.path, reason: `outside the canonical layout ${join(root, "<agent>", "<workstream>")}` });
      continue;
    }
    const [agent, workstream] = parts;
    if (!AGENTS.includes(agent) || !WORKSTREAMS.includes(workstream)) {
      violations.push({ path: worktree.path, reason: `unknown agent/workstream ${agent}/${workstream}` });
      continue;
    }
    perAgent[agent] ??= {};
    perAgent[agent][workstream] = worktree.branch ?? "(detached)";
    if (workstream === "audit") {
      if (!worktree.detached) violations.push({ path: worktree.path, reason: "audit worktrees must be detached and read-only" });
      continue;
    }
    const info = worktree.branch ? classifyBranch(worktree.branch) : { kind: "detached" };
    if (info.kind !== "agent") violations.push({ path: worktree.path, reason: `expects an agent task branch, found ${worktree.branch ?? "detached HEAD"}` });
    else if (info.agent !== agent) violations.push({ path: worktree.path, reason: `branch belongs to ${info.agent}, worktree slot belongs to ${agent}` });
  }
  return { main: main?.path ?? null, linked: linked.length, perAgent, violations };
}

export function summarizeBranches(names) {
  const counts = { protected: 0, release: 0, bot: 0, agent: 0, invalid: 0 };
  const releaseByLane = {};
  for (const name of names) {
    const info = classifyBranch(name);
    counts[info.kind] += 1;
    if (info.kind === "release") (releaseByLane[info.lane] ??= []).push(info);
  }
  return { total: names.length, counts, releaseByLane };
}

// ---------------------------------------------------------------- CLI helpers

const git = (args, options = {}) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
const tryGit = (args, options = {}) => spawnSync("git", args, { encoding: "utf8", ...options });

export function worktreeRoot(env = process.env) {
  const root = resolve(env.CCPUN_WORKTREE_ROOT || join(homedir(), ".ccpun-worktrees"));
  return existsSync(root) ? realpathSync(root) : root; // git reports real paths (macOS /var -> /private/var)
}

function integrationRef(env = process.env) {
  return env.CCPUN_GUARD_INTEGRATION_REF || "origin/v4-production";
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) { positional.push(arg); continue; }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) { flags[key] = next; index += 1; } else flags[key] = true;
  }
  return { positional, flags };
}

function emit(level, message, { ci = Boolean(process.env.GITHUB_ACTIONS), mode = "enforce" } = {}) {
  const effective = level === "error" && mode === "warn" ? "warn" : level;
  if (ci && effective !== "ok") console.log(`::${effective === "error" ? "error" : "warning"} title=agent-guard::${message}`);
  else console.log(`${effective.toUpperCase().padEnd(5)} ${message}`);
  return effective;
}

function localWorktrees() {
  return parseWorktreePorcelain(git(["worktree", "list", "--porcelain"]));
}

function remoteBranches(useNetwork) {
  if (useNetwork) {
    return git(["ls-remote", "--heads", "origin"]).split("\n").filter(Boolean).map((line) => {
      const [sha, ref] = line.split(/\s+/);
      return { name: ref.replace(/^refs\/heads\//, ""), sha };
    });
  }
  const out = tryGit(["for-each-ref", "--format=%(objectname) %(refname:short)", "refs/remotes/origin"]);
  return (out.stdout || "").split("\n").filter(Boolean).map((line) => {
    const [sha, ref] = line.split(" ");
    return { name: ref.replace(/^origin\//, ""), sha };
  }).filter(({ name }) => name !== "HEAD" && name !== "origin");
}

function buildReport({ remote = false } = {}) {
  const root = worktreeRoot();
  const worktrees = evaluateWorktrees(localWorktrees(), { root });
  const locals = git(["for-each-ref", "--format=%(refname:short)", "refs/heads"]).split("\n").filter(Boolean);
  const target = integrationRef();
  const hasTarget = tryGit(["rev-parse", "--verify", "--quiet", target]).status === 0;
  const merged = hasTarget
    ? git(["branch", "--format=%(refname:short)", "--merged", target]).split("\n").filter(Boolean)
      .filter((name) => classifyBranch(name).kind !== "protected")
    : [];
  const remotes = remoteBranches(remote);
  const remoteSummary = summarizeBranches(remotes.map(({ name }) => name));
  const movedPins = remotes.filter(({ name, sha }) => {
    const info = classifyBranch(name);
    return info.kind === "release" && info.sha !== sha;
  }).map(({ name }) => name);
  const pinsBeyondRetention = Object.fromEntries(Object.entries(remoteSummary.releaseByLane)
    .map(([lane, pins]) => [lane, Math.max(0, pins.length - RELEASE_RETENTION)]));
  return {
    worktreeRoot: root,
    worktrees,
    localBranches: summarizeBranches(locals),
    localMergedIntoIntegration: merged,
    integrationRef: hasTarget ? target : `${target} (missing; fetch it)`,
    remoteBranches: { source: remote ? "ls-remote" : "refs/remotes/origin", total: remoteSummary.total, counts: remoteSummary.counts },
    pinsBeyondRetention,
    movedPins,
  };
}

function printReport(report) {
  const lines = [];
  lines.push(`Worktree root: ${report.worktreeRoot}`);
  lines.push(`Linked worktrees: ${report.worktrees.linked} (main: ${report.worktrees.main})`);
  for (const [agent, slots] of Object.entries(report.worktrees.perAgent)) {
    lines.push(`  ${agent}: ${Object.entries(slots).map(([ws, branch]) => `${ws}=${branch}`).join(", ")}`);
  }
  for (const { path, reason } of report.worktrees.violations) lines.push(`  VIOLATION ${path}: ${reason}`);
  const local = report.localBranches.counts;
  lines.push(`Local branches: ${report.localBranches.total} (agent ${local.agent}, release ${local.release}, legacy ${local.invalid})`);
  lines.push(`Local branches merged into ${report.integrationRef}: ${report.localMergedIntoIntegration.length}`);
  const remote = report.remoteBranches.counts;
  lines.push(`Remote branches (${report.remoteBranches.source}): ${report.remoteBranches.total} `
    + `(agent ${remote.agent}, release ${remote.release}, legacy ${remote.invalid}, bot ${remote.bot}, protected ${remote.protected})`);
  for (const [lane, extra] of Object.entries(report.pinsBeyondRetention)) {
    if (extra) lines.push(`  release lane ${lane}: ${extra} pin(s) beyond retention ${RELEASE_RETENTION} (owner-approved archival only)`);
  }
  for (const name of report.movedPins) lines.push(`  MOVED PIN ${name}: head no longer equals the SHA in its name`);
  return lines.join("\n");
}

function cmdReport(flags) {
  const report = buildReport({ remote: Boolean(flags.remote) });
  if (flags.json) console.log(JSON.stringify(report, null, 2));
  else console.log(printReport(report));
  if (flags.ci && process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Agent scope inventory\n\n\`\`\`\n${printReport(report)}\n\`\`\`\n`);
  }
  if (flags.ci) {
    for (const name of report.movedPins) emit("warn", `${name}: release pin moved`);
    if (report.remoteBranches.counts.invalid) emit("warn", `${report.remoteBranches.counts.invalid} legacy remote branches remain`);
  }
  const strictFailure = report.worktrees.violations.length > 0 || report.movedPins.length > 0;
  return flags.strict && strictFailure ? 1 : 0;
}

function cmdCheckBranch(positional, flags) {
  const [name] = positional;
  if (!name) throw new Error("usage: check-branch <name> [--created] [--head <sha>] [--mode warn|enforce]");
  const outcome = checkBranchEvent({ name, created: Boolean(flags.created), headSha: typeof flags.head === "string" ? flags.head : undefined });
  return emit(outcome.level, outcome.message, { mode: flags.mode }) === "error" ? 1 : 0;
}

function cmdCheckPr(flags) {
  const findings = checkPullRequest({
    headRef: process.env.PR_HEAD_REF, baseRef: process.env.PR_BASE_REF, body: process.env.PR_BODY,
  });
  const levels = findings.map(({ level, message }) => emit(level, message, { mode: flags.mode }));
  return levels.includes("error") ? 1 : 0;
}

function cmdPrePush() {
  const input = readFileSync(0, "utf8");
  let failed = false;
  for (const line of input.split("\n").filter(Boolean)) {
    const [localRef, localOid, remoteRef, remoteOid] = line.trim().split(/\s+/);
    const outcome = checkPush({ localRef, localOid, remoteRef, remoteOid, env: process.env });
    if (outcome.level !== "ok") console.error(`agent-guard ${outcome.level}: ${outcome.message}`);
    if (outcome.level === "error") failed = true;
  }
  try {
    const { violations } = evaluateWorktrees(localWorktrees(), { root: worktreeRoot() });
    if (violations.length) console.error(`agent-guard warn: ${violations.length} worktree(s) outside the scope lock; run: node scripts/agent-guard.mjs report`);
  } catch { /* worktree inspection is advisory in the hook */ }
  return failed ? 1 : 0;
}

function cmdStart(flags) {
  const { agent, workstream, type, task } = flags;
  if (!AGENTS.includes(agent)) throw new Error(`--agent must be one of ${AGENTS.join("|")}`);
  if (!WORKSTREAMS.includes(workstream)) throw new Error(`--workstream must be one of ${WORKSTREAMS.join("|")}`);
  const path = join(worktreeRoot(), agent, workstream);
  const busy = localWorktrees().find((entry) => resolve(entry.path) === path);
  if (busy || existsSync(path)) throw new Error(`slot ${agent}/${workstream} is busy (${busy?.branch ?? path}); finish, hand off or cleanup first`);
  const base = typeof flags.base === "string" ? flags.base : integrationRef();
  if (!flags["no-fetch"] && base.startsWith("origin/")) git(["fetch", "origin", base.slice("origin/".length)]);
  let args;
  let branch = null;
  if (workstream === "audit") {
    args = ["worktree", "add", "--detach", path, base];
  } else {
    if (!BRANCH_TYPES.includes(type)) throw new Error(`--type must be one of ${BRANCH_TYPES.join("|")}`);
    if (!TASK_ID_RE.test(task ?? "")) throw new Error("--task must be <slug>-<YYYYMMDD> (the task/receipt ID)");
    if (flags.uat) throw new Error("--uat was retired (owner decision R8, 2026-10-25): UAT deploys from the same work branch");
    branch = `${agent}/${type}/${task}`;
    const info = classifyBranch(branch);
    if (info.kind !== "agent") throw new Error(`${branch}: ${info.reason}`);
    if (tryGit(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0) {
      throw new Error(`${branch} already exists locally; reuse its worktree instead of creating another`);
    }
    args = ["worktree", "add", "-b", branch, path, base];
  }
  if (flags["dry-run"]) { console.log(`would run: git ${args.join(" ")}`); return 0; }
  mkdirSync(dirname(path), { recursive: true });
  git(args, { stdio: ["ignore", "pipe", "inherit"] });
  console.log(`worktree ready: ${path}${branch ? ` on ${branch}` : " (detached, read-only audit)"}`);
  return 0;
}

function cmdCleanup(flags) {
  const apply = Boolean(flags.apply);
  const root = worktreeRoot();
  const target = integrationRef();
  const hasTarget = tryGit(["rev-parse", "--verify", "--quiet", target]).status === 0;
  const actions = [];
  for (const entry of localWorktrees().slice(1)) {
    if (entry.prunable) continue;
    const rel = relative(root, entry.path);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) continue; // only the guard-managed layout is touched
    const dirty = git(["-C", entry.path, "status", "--porcelain"]).length > 0;
    if (dirty) { console.log(`KEEP  ${entry.path}: uncommitted changes`); continue; }
    let reason = null;
    if (!entry.branch) reason = "detached audit worktree";
    else {
      const merged = hasTarget && tryGit(["merge-base", "--is-ancestor", entry.branch, target]).status === 0;
      const track = git(["for-each-ref", "--format=%(upstream:track)", `refs/heads/${entry.branch}`]);
      if (merged) reason = `merged into ${target}`;
      else if (track.includes("gone")) reason = "remote branch deleted (merged or closed PR)";
    }
    if (!reason) { console.log(`KEEP  ${entry.path}: ${entry.branch} still active`); continue; }
    actions.push({ entry, reason });
  }
  for (const { entry, reason } of actions) {
    console.log(`${apply ? "REMOVE" : "WOULD REMOVE"} ${entry.path} (${reason})`);
    if (!apply) continue;
    git(["worktree", "remove", entry.path]);
    if (entry.branch) {
      const deleted = tryGit(["branch", "-d", entry.branch]);
      console.log(deleted.status === 0 ? `  deleted local branch ${entry.branch}` : `  kept local branch ${entry.branch}: not fully merged (check the PR, then delete by hand)`);
    }
  }
  const prune = git(["worktree", "prune", "--dry-run", "--verbose"]);
  if (prune) {
    console.log(`${apply ? "PRUNE" : "WOULD PRUNE"} stale registrations:\n${prune}`);
    if (apply) git(["worktree", "prune"]);
  }
  if (!actions.length && !prune) console.log("nothing to clean");
  return 0;
}

function cmdInstallHook(flags) {
  const hooksDir = resolve(git(["rev-parse", "--git-path", "hooks"]));
  const hookPath = join(hooksDir, "pre-push");
  const content = [
    "#!/bin/sh",
    "# Installed by scripts/agent-guard.mjs install-hook (CCPun agent scope lock)",
    'repo_root="$(git rev-parse --show-toplevel)" || exit 1',
    'exec node "$repo_root/scripts/agent-guard.mjs" pre-push "$@"',
    "",
  ].join("\n");
  if (existsSync(hookPath)) {
    const current = readFileSync(hookPath, "utf8");
    if (current.includes("agent-guard.mjs")) { console.log(`pre-push hook already installed: ${hookPath}`); return 0; }
    if (!flags.force) throw new Error(`${hookPath} exists and is not the agent guard; merge it by hand or pass --force`);
  }
  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(hookPath, content);
  chmodSync(hookPath, 0o755);
  console.log(`installed pre-push hook: ${hookPath}`);
  return 0;
}

const HELP = `CCPun agent scope lock
  report [--remote] [--json] [--strict] [--ci]   worktree/branch counts and violations (read-only)
  start --agent A --workstream W --type T --task ID [--base REF] [--no-fetch] [--dry-run]
  cleanup [--apply]                              remove merged, clean guard-managed worktrees (dry-run default)
  check-branch NAME [--created] [--head SHA] [--mode warn|enforce]   CI push check
  check-pr [--mode warn|enforce]                 CI PR check (env PR_HEAD_REF, PR_BASE_REF, PR_BODY)
  pre-push                                       git pre-push hook entry point
  install-hook [--force]                         install the pre-push hook for this clone
Worktree root: $CCPUN_WORKTREE_ROOT or ~/.ccpun-worktrees, layout <root>/<agent>/<workstream>.`;

export function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  const { positional, flags } = parseArgs(rest);
  switch (command) {
    case "report": return cmdReport(flags);
    case "check-branch": return cmdCheckBranch(positional, flags);
    case "check-pr": return cmdCheckPr(flags);
    case "pre-push": return cmdPrePush();
    case "start": return cmdStart(flags);
    case "cleanup": return cmdCleanup(flags);
    case "install-hook": return cmdInstallHook(flags);
    default: console.log(HELP); return command ? 2 : 0;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`agent-guard: ${error.message}`);
    process.exitCode = 1;
  }
}
