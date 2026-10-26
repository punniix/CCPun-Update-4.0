#!/usr/bin/env node
// LINE chat drift guard (2026-10-26). The Admin LINE chat settings live on two branches until the
// v5 release integrates them: codex/website-v5-uat-20261025 (source of truth, with the website
// dock) and claude/feat/admin-uat-20261026 (admin-test). qa/line-chat-drift.json pins the SHA-256
// of every shared file at the v5 commit it was copied from.
//
//   node scripts/line-chat-drift.mjs --check    compare this checkout AND the v5 branch to the pins
//   node scripts/line-chat-drift.mjs --refresh  after copying the files from v5, re-pin to that v5 commit
//
// --refresh refuses to write unless every file in this checkout is byte-identical to the v5 ref,
// so the pin can only move to a state both branches share. The v5 ref defaults to
// origin/codex/website-v5-uat-20261025 (override with LINE_CHAT_V5_REF).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const MANIFEST = "qa/line-chat-drift.json";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const ref = process.env.LINE_CHAT_V5_REF ?? manifest.sourceRef;
const git = (...args) => execFileSync("git", args, { encoding: "buffer", stdio: ["ignore", "pipe", "pipe"] });

function v5Digest(file) {
  return sha(git("show", `${ref}:${file}`));
}

const mode = process.argv[2];
if (mode !== "--check" && mode !== "--refresh") {
  console.error("usage: node scripts/line-chat-drift.mjs --check | --refresh");
  process.exit(2);
}

let failed = false;
const local = {};
const remote = {};
for (const file of Object.keys(manifest.files)) {
  local[file] = sha(readFileSync(file));
  try {
    remote[file] = v5Digest(file);
  } catch {
    remote[file] = null;
  }
  const pinned = manifest.files[file];
  if (mode === "--check") {
    if (local[file] !== pinned) { failed = true; console.error(`drift (this branch): ${file}`); }
    if (remote[file] !== pinned) { failed = true; console.error(`drift (${ref}): ${file}${remote[file] ? "" : " (missing)"}`); }
  } else if (local[file] !== remote[file]) {
    failed = true;
    console.error(`not identical to ${ref}: ${file} (copy it with: git checkout ${ref} -- '${file}')`);
  }
}

if (mode === "--refresh" && !failed) {
  manifest.sourceCommit = git("rev-parse", ref).toString().trim();
  manifest.files = local;
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`pinned ${Object.keys(local).length} files to ${ref} @ ${manifest.sourceCommit}`);
}
if (failed) process.exit(1);
if (mode === "--check") console.log(`no drift: ${Object.keys(local).length} files match ${ref} @ ${manifest.sourceCommit}`);
