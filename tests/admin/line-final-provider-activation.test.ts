import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { getLineProviderActivationReadiness } from "../../lib/admin/line/document-media";
import {
  buildLineRichMenuProviderDefinition,
  readDefaultLineRichMenuStatus,
} from "../../lib/admin/line/rich-menu-provider";
import {
  LINE_RICH_MENU_ITEMS,
  LINE_RICH_MENU_V2_ITEMS,
  LINE_RICH_MENU_V3,
} from "../../lib/line/ecosystem";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("Rich Menu v1 rollback PNG remains deterministic and LINE-sized", () => {
  const file = readFileSync(path.join(root, "lib/admin/line/assets/ccpun-line-rich-menu-v1.png"));
  assert.equal(file.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(file.readUInt32BE(16), LINE_RICH_MENU_V3.image.width);
  assert.equal(file.readUInt32BE(20), LINE_RICH_MENU_V3.image.height);
  assert.ok(file.byteLength > 0);
  assert.ok(file.byteLength <= LINE_RICH_MENU_V3.image.maxBytes);
  assert.equal(
    createHash("sha256").update(file).digest("hex"),
    "4d8c51ff24ed0a619147a846d9d22872c67dd61c7f756c2c671393cd9b52b5a8",
  );
});

test("Rich Menu v3 asset script keeps Website 4.3 colors and four need-first labels", () => {
  const source = read("scripts/build-line-rich-menu-asset.mjs");
  for (const label of ["ประกันชีวิต", "ประกันรถ", "เรื่องลงทุน", "คุยกับปั้น"]) {
    assert.match(source, new RegExp(label));
  }
  assert.doesNotMatch(source, /label: "เรื่องน่ารู้"/);
  assert.doesNotMatch(source, /label: "ลองเช็ก"/);
  assert.match(source, /#251818/);
  assert.match(source, /#e0c985/i);
  assert.match(source, /2500/);
  assert.match(source, /1686/);
  assert.match(source, /1250/);
});

test("Rich Menu v3 exposes four locked journey postbacks only", () => {
  assert.equal(LINE_RICH_MENU_ITEMS.length, 4);
  assert.deepEqual(
    LINE_RICH_MENU_ITEMS.map((item) => [item.id, item.label]),
    [
      ["insurance", "ประกันชีวิต"],
      ["motor", "ประกันรถ"],
      ["investment", "เรื่องลงทุน"],
      ["human", "คุยกับปั้น"],
    ],
  );
  assert.equal(
    LINE_RICH_MENU_ITEMS.find((item) => item.id === "insurance")?.postbackData,
    "journey=life_health_policy_review&stage=entry",
  );
  assert.equal(
    LINE_RICH_MENU_ITEMS.find((item) => item.id === "motor")?.postbackData,
    "journey=motor_quote_review&stage=entry",
  );
  assert.equal(
    LINE_RICH_MENU_ITEMS.find((item) => item.id === "investment")?.postbackData,
    "journey=investment_before_you_act&stage=entry",
  );
  assert.equal(
    LINE_RICH_MENU_ITEMS.find((item) => item.id === "human")?.postbackData,
    "journey=human_handoff&stage=waiting_for_advisor",
  );
});

test("Rich Menu v2 rollback URL actions retain safe UTM attribution", () => {
  for (const item of LINE_RICH_MENU_V2_ITEMS) {
    if (item.action !== "uri") continue;
    const url = new URL(item.uri);
    assert.equal(url.searchParams.get("utm_source"), "line");
    assert.equal(url.searchParams.get("utm_medium"), "rich_menu");
    assert.equal(url.searchParams.get("utm_campaign"), "rich_menu_v2");
    assert.ok(url.searchParams.get("utm_content"));
    assert.equal(url.searchParams.has("line_user_id"), false);
    assert.equal(url.searchParams.has("lead_id"), false);
  }
});

test("default Rich Menu status recognizes v3 without exposing provider id or token", async () => {
  let calls = 0;
  assert.deepEqual(
    await readDefaultLineRichMenuStatus({}, async () => {
      calls += 1;
      return new Response(null, { status: 500 });
    }),
    { state: "not_configured" },
  );
  assert.equal(calls, 0);

  const notAssigned = await readDefaultLineRichMenuStatus(
    { CCPUN_LINE_CHANNEL_ACCESS_TOKEN: "synthetic-token" },
    async () => new Response(null, { status: 404 }),
  );
  assert.deepEqual(notAssigned, { state: "not_assigned" });

  const requestUrls: string[] = [];
  const active = await readDefaultLineRichMenuStatus(
    { CCPUN_LINE_CHANNEL_ACCESS_TOKEN: "synthetic-token" },
    async (input) => {
      const url = String(input);
      requestUrls.push(url);
      if (url.endsWith("/v2/bot/user/all/richmenu")) {
        return new Response(JSON.stringify({ richMenuId: "richmenu-synthetic-v3" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(buildLineRichMenuProviderDefinition()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  );
  assert.deepEqual(active, { state: "active_v3" });
  assert.equal(requestUrls.length, 2);
  assert.doesNotMatch(JSON.stringify(active), /richmenu-|synthetic-token/);

  const changedAction = buildLineRichMenuProviderDefinition();
  changedAction.areas[0] = {
    ...changedAction.areas[0]!,
    action: {
      type: "postback",
      label: "ประกันชีวิต",
      data: "journey=life_health_policy_review&stage=changed",
      displayText: "ประกันชีวิต",
    },
  };
  const mismatched = await readDefaultLineRichMenuStatus(
    { CCPUN_LINE_CHANNEL_ACCESS_TOKEN: "synthetic-token" },
    async (input) => String(input).endsWith("/v2/bot/user/all/richmenu")
      ? new Response(JSON.stringify({ richMenuId: "richmenu-synthetic-v3" }), { status: 200 })
      : new Response(JSON.stringify(changedAction), { status: 200 }),
  );
  assert.deepEqual(mismatched, { state: "active_other" });
});

test("Drive credential readiness recognizes the intended memory-only owner-interactive setup", () => {
  const ready = getLineProviderActivationReadiness({
    NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_OAUTH_CLIENT_ID: "client.apps.googleusercontent.com",
    NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_PICKER_API_KEY: "synthetic-picker-key",
    NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_APP_ID: "123456789012",
    CCPUN_GOOGLE_DRIVE_ADMIN_ROOT_FOLDER_ID: "admin_root_folder_12345",
    CCPUN_GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID: "media_root_folder_12345",
  });
  assert.equal(ready.driveOAuthClientConfigured, true);
  assert.equal(ready.drivePickerConfigured, true);
  assert.equal(ready.driveRootsConfigured, true);
  assert.equal(ready.driveInteractiveConfigReady, true);
  assert.equal(ready.driveAuthorizationMode, "owner-interactive");
  assert.equal(ready.driveScope, "drive.file");
  assert.equal(ready.drivePersistentCredentialConfigured, false);
});

test("Rich Menu activation endpoint is owner-only and only submits a durable v3 command", () => {
  const route = read("apps/admin/app/api/admin/line/rich-menu/activate/route.ts");
  assert.match(route, /identity\.role !== "owner"/);
  assert.match(route, /settings:read/);
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(route, /activate-ccpun-rich-menu-v3/);
  assert.match(route, /submitLineRichMenuCommand/);
  assert.match(route, /expectedVersion/);
  assert.match(route, /idempotencyKey/);
  assert.match(route, /buildLineRichMenuProviderDefinition\("line-rich-menu-v3"\)/);
  assert.doesNotMatch(route, /activateDefaultLineRichMenu|CCPUN_LINE_CHANNEL_ACCESS_TOKEN|richMenuId.*NextResponse|console\./);
});

test("Health shows four-cell v3 and keeps Drive authorization on demand", () => {
  const health = read("apps/admin/app/(control-plane)/operations/health/page.tsx");
  const action = read("features/admin/line/LineProviderActivationActions.tsx");
  assert.match(health, /LineProviderActivationActions/);
  assert.match(health, /พร้อมขออนุญาตเมื่อมีไฟล์/);
  assert.match(action, /ประกันชีวิต · ประกันรถ · เรื่องลงทุน · คุยกับปั้น/);
  assert.match(action, /การ์ดบทความอัตโนมัติ/);
  assert.match(action, /activate-ccpun-rich-menu-v3/);
  assert.match(action, /ตอนนี้ไม่มีไฟล์รอ จึงยังไม่ต้องกดอนุญาต Google Drive/);
  assert.match(action, /ไม่เก็บสิทธิ์ระยะยาว/);
  assert.doesNotMatch(action, /accessToken|clientSecret|refreshToken/);
});
