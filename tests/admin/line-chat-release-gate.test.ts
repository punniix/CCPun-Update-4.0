import { adminCmsBridgePredecessor } from "../../qa/admin-cms-web-bridge-successor.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// v5 release gate (2026-10-26, docs/release/v5-release-manifest.md). Runs in check:foundation and
// CI. It fails when a part that must ship with v5 is missing from this branch: the Admin LINE chat
// manager, its Sanity schema fields, its tests, the financial planning room route or its tests;
// and when the LINE chat files shared with codex/website-v5-uat-20261025 drift.
const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const exists = (file: string) => existsSync(path.join(root, file));
const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

const LINE_CHAT_FILES = [
  "features/admin/line/LineChatManager.tsx",
  "apps/admin/app/(control-plane)/settings/line-chat/page.tsx",
  "apps/admin/app/api/admin/line/chat/route.ts",
  "cms/sanity/schema/documents/line-chat-config.ts",
  "lib/line/chat-panel.ts",
  "lib/line/chat-config.ts",
  "lib/line/oa-link.ts",
  "lib/admin/line/chat-config.ts",
];
const LINE_CHAT_TESTS = {
  "tests/admin/line-chat-config.test.ts": ["resolver precedence: utm campaign > latest active temporary campaign > page placement > default", "Admin service and endpoint follow the LINE Discovery contract: lane-guarded, published-only, owner-only, same-origin", "Settings > ปุ่มแชท LINE: tabs, phone preview, test link, UTM builder, inline validation and history revert"],
  "tests/admin/line-chat-per-page.test.ts": ["precedence: campaign pin > per-page override > category (semantic, then physical) > site default", "Sanity contract: additive fields only, stable keys, projection and history round trip", "Admin: draft then publish, owner-only, lane-guarded; only the UAT/Production lane of the deployment is written", "owner clarification 2026-10-26: the customer-visible message never contains anything code-like"],
} as const;
// Persisted field names of the additive lineChatConfig document (and its object members).
const LINE_CHAT_SCHEMA_FIELDS = ["version", "topics", "placements", "campaigns", "pageOverrides", "sourceTemplates", "enabled", "updatedAt", "updatedBy", "topicId", "label", "prefill", "journey", "sourceSentence", "hideSource", "pageKey", "topicIds", "code", "refCode", "campaignType", "startsAt", "endsAt", "reviewAt", "pageGroups", "pinnedTopicIds", "headline", "paused", "targetKey", "kind", "ref", "article", "tool"];
const FA_ROOM_FILES = [
  "apps/admin/app/(control-plane)/dashboard/planning/page.tsx",
  "apps/admin/app/(control-plane)/dashboard/planning/[householdId]/page.tsx",
  "apps/admin/app/(control-plane)/dashboard/planning/retention/page.tsx",
  "apps/admin/app/api/admin/planning/households/route.ts",
  "lib/admin/financial-planning/access.ts",
  "db/migrations/20261025_fa_room_v1.sql",
];
const FA_ROOM_TEST = "tests/admin/financial-planning-room.test.ts";

const testTitles = (file: string) => [...read(file).matchAll(/^test\("((?:[^"\\]|\\.)*)"/gm)].map((match) => match[1]);

test("gate: the Admin LINE chat manager, its route, API and libraries are present", () => {
  for (const file of LINE_CHAT_FILES) assert.ok(exists(file), `missing ${file}`);
  assert.match(read("apps/admin/app/(control-plane)/settings/line-chat/page.tsx"), /<LineChatManager\b/);
  assert.match(read("apps/admin/app/api/admin/line/chat/route.ts"), /export async function (GET|PUT|POST)/);
  assert.match(read("apps/admin/app/(control-plane)/layout.tsx"), /\{ href: "\/settings\/line-chat\/", label: "ปุ่มแชท LINE", permission: "settings:read" \}/);
});

test("gate: the lineChatConfig schema is registered and keeps every persisted field", () => {
  const schema = read("cms/sanity/schema/documents/line-chat-config.ts");
  assert.match(schema, /name: "lineChatConfig"/);
  for (const field of LINE_CHAT_SCHEMA_FIELDS) assert.match(schema, new RegExp(`name: "${field}"`), `schema field ${field}`);
  const index = read("cms/sanity/schema/index.ts");
  assert.match(index, /import \{ lineChatConfig \} from "\.\/documents\/line-chat-config";/);
  assert.match(index, /\n  lineChatConfig,\n/);
});

test("gate: the LINE chat tests are present with their contract cases", () => {
  for (const [file, titles] of Object.entries(LINE_CHAT_TESTS)) {
    assert.ok(exists(file), `missing ${file}`);
    const present = testTitles(file);
    for (const title of titles) assert.ok(present.includes(title), `${file}: missing case "${title}"`);
    assert.ok(present.length >= titles.length + 3, `${file}: suspiciously few cases (${present.length})`);
  }
});

test("gate: the financial planning room (PR #491) route, owner guard and tests are present", () => {
  for (const file of FA_ROOM_FILES) assert.ok(exists(file), `missing ${file}`);
  assert.ok(exists(FA_ROOM_TEST), `missing ${FA_ROOM_TEST}`);
  assert.ok(testTitles(FA_ROOM_TEST).length >= 10, "FA room tests look truncated");
  assert.match(read("lib/admin/financial-planning/access.ts"), /identity\.role === "owner"/);
  assert.match(read("apps/admin/app/(control-plane)/layout.tsx"), /\{ href: "\/dashboard\/planning\/", label: "ห้องวางแผน FA", permission: "planning:read"/);
});

test("gate: the release manifest lists every v5 part with its source branch", () => {
  const manifest = read("docs/release/v5-release-manifest.md");
  for (const entry of ["Website v5", "LINE chat dock fix", "LINE chat per page, website part", "LINE chat per page, Admin part", "AIA fund tool", "Admin ops", "Owner Admin decisions", "Financial planning room, full", "FA room menu entry"]) {
    assert.ok(manifest.includes(`| ${entry}`), `manifest entry ${entry}`);
  }
  for (const branch of ["codex/website-v5-uat-20261025", "claude/feat/admin-ops-20261025", "claude/feat/admin-uat-20261026", "claude/feat/fa-room-20261025", "claude/feat/fa-room-menu-20261026"]) {
    assert.ok(manifest.includes(`\`${branch}\``), branch);
  }
  for (const env of ["CCPUN_FA_DATABASE_URL", "CCPUN_FA_ENCRYPTION_KEY_V1", "CCPUN_FA_ACTIVE_ENCRYPTION_KEY_VERSION"]) assert.ok(manifest.includes(env), env);
});

const drift = JSON.parse(read("qa/line-chat-drift.json")) as { sourceRef: string; sourceCommit: string; files: Record<string, string> };

test("drift: this branch's LINE chat files match the pinned v5 hashes", () => {
  assert.deepEqual(Object.keys(drift.files).sort(), [...LINE_CHAT_FILES].sort(), "the pin list covers exactly the shared files");
  assert.match(drift.sourceCommit, /^[0-9a-f]{40}$/);
  for (const [file, digest] of Object.entries(drift.files)) {
    assert.equal(sha(adminCmsBridgePredecessor(file, read(file))), digest, `${file} differs from ${drift.sourceRef} @ ${drift.sourceCommit.slice(0, 8)}; see "Refreshing the LINE chat drift pins" in docs/release/v5-release-manifest.md`);
  }
});

test("drift: the v5 branch still matches the pins (when the ref is available)", (t) => {
  let available = true;
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", `${drift.sourceRef}^{commit}`], { cwd: root, stdio: "ignore" });
  } catch {
    available = false;
  }
  if (!available) {
    t.skip(`${drift.sourceRef} is not fetched in this checkout (shallow CI); run node scripts/line-chat-drift.mjs --check locally`);
    return;
  }
  for (const [file, digest] of Object.entries(drift.files)) {
    let remote: string | null = null;
    try {
      remote = sha(adminCmsBridgePredecessor(file, execFileSync("git", ["show", `${drift.sourceRef}:${file}`], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8")));
    } catch {
      remote = null;
    }
    assert.equal(remote, digest, `${drift.sourceRef} changed ${file}; copy it here and re-pin (docs/release/v5-release-manifest.md)`);
  }
});
