import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("Rich Menu desired state is shared through the Sanity curation singleton", () => {
  const schema = read("cms/sanity/schema/documents/line-discovery-config.ts");
  const model = read("lib/admin/line/discovery-config.ts");
  assert.match(schema, /desiredRichMenu/);
  assert.match(schema, /Rich Menu v3 · 4 ช่อง/);
  assert.match(schema, /ไม่ให้ระบบเปลี่ยนเมนู/);
  assert.match(model, /desiredRichMenu: z\.enum\(\["v3", "hold"\]\)/);
  assert.match(model, /desiredRichMenu: input\.desiredRichMenu/);
});

test("Admin save reconciles immediately while ChatGPT/Codex can rely on the same desired state", () => {
  const route = read("apps/admin/app/api/admin/line/discovery/route.ts");
  const reconciler = read("lib/admin/line/rich-menu-reconciler.ts");
  assert.match(route, /reconcileDesiredLineRichMenu/);
  assert.match(reconciler, /readLineDiscoveryCuration/);
  assert.match(reconciler, /desiredRichMenu !== "v3"/);
  assert.match(reconciler, /readDefaultLineRichMenuStatus/);
  assert.match(reconciler, /activateDefaultLineRichMenu/);
  assert.doesNotMatch(reconciler, /line_user_id|customer_id|lead_id|messageText/);
});

test("background reconciliation is inputless and scheduled every five minutes", () => {
  const route = read("apps/admin/app/api/internal/line/rich-menu/reconcile/route.ts");
  const vercel = JSON.parse(read("apps/admin/vercel.json")) as { crons?: Array<{ path: string; schedule: string }> };
  assert.match(route, /export async function GET\(\)/);
  assert.doesNotMatch(route, /request: Request|searchParams|request\.json/);
  assert.ok(vercel.crons?.some((cron) =>
    cron.path === "/api/internal/line/rich-menu/reconcile"
    && cron.schedule === "*/5 * * * *"
  ));
});

test("system delivery and Rich Menu provider gates are on by default but retain emergency off switches", () => {
  const provider = read("lib/admin/line/provider.ts");
  const richMenu = read("lib/admin/line/rich-menu-provider.ts");
  const ingress = read("apps/web/lib/line/private-ingestion.ts");
  assert.match(provider, /CCPUN_LINE_SYSTEM_DELIVERY_ENABLED\?\.trim\(\) !== "false"/);
  assert.match(richMenu, /CCPUN_LINE_RICH_MENU_PROVIDER_ENABLED\?\.trim\(\) !== "false"/);
  assert.match(ingress, /CCPUN_LINE_SYSTEM_DELIVERY_ENABLED\?\.trim\(\) === "false"/);
});

test("Admin curation UI exposes desired state and keeps no-deploy ordering", () => {
  const ui = read("features/admin/line/LineDiscoveryManager.tsx");
  assert.match(ui, /Rich Menu ที่ต้องการ/);
  assert.match(ui, /desiredRichMenu/);
  assert.match(ui, /Rich Menu v3 · 4 ช่อง/);
  assert.match(ui, /ไม่ให้ระบบเปลี่ยนเมนู/);
});
