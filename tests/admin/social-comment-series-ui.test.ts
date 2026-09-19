import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Facebook Comment Series stays a child workflow with four editable Text Cards", () => {
  const workspace = readFileSync(new URL("../../features/admin/social/SocialPostsWorkspace.tsx", import.meta.url), "utf8");
  const client = readFileSync(new URL("../../features/admin/social/social-workspace-client.ts", import.meta.url), "utf8");

  assert.match(workspace, /Array\.from\(\{ length: 4 \}/);
  assert.match(workspace, /เพิ่มข้อความต่อจากโพสต์หลักเป็นหลายคอมเมนต์/);
  assert.match(workspace, /commentSeriesMode: form\.commentSeriesMode, commentSeries: form\.commentSeries/);
  assert.match(workspace, /comment\.position === index \+ 1/);
  assert.doesNotMatch(workspace, /FACEBOOK_AUTHORING_FORMATS[\s\S]{0,100}comment-series/);
  assert.match(client, /item\.platform === "facebook" \? commentSeries\(item\.commentSeries\) : \[\]/);
});
