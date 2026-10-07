import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("Sanity remains editorial and cannot own provider desired state", () => {
  const schema = read("cms/sanity/schema/documents/line-discovery-config.ts");
  const model = read("lib/admin/line/discovery-config.ts");
  const ui = read("features/admin/line/LineDiscoveryManager.tsx");
  assert.doesNotMatch(schema, /desiredRichMenu/);
  assert.doesNotMatch(model, /desiredRichMenu/);
  assert.doesNotMatch(ui, /desiredRichMenu|Rich Menu ที่ต้องการ/);
  assert.match(schema, /journeyConfig\("lifeHealth"/);
  assert.match(ui, /จัดลำดับการ์ดบทความ/);
});

test("shared command contract uses Neon desired state, optimistic version and idempotency", () => {
  const route = read("apps/admin/app/api/admin/control/commands/route.ts");
  const store = read("lib/admin/control-plane/provider-state.ts");
  const migration = read("db/migrations/20260919_provider_control_plane_v1.sql");
  assert.match(route, /line\.rich_menu\.default/);
  assert.match(route, /expectedVersion/);
  assert.match(route, /idempotencyKey/);
  assert.match(route, /identity\.role !== "owner"/);
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(store, /admin_submit_control_command/);
  assert.match(store, /if \(!rows\[0\]\) rows = commandRowSchema/);
  assert.match(migration, /ON CONFLICT\(idempotency_key\) DO NOTHING/);
  assert.match(store, /admin_claim_provider_operation/);
  assert.match(migration, /UNIQUE\(resource_key, resource_version\)/);
  assert.match(migration, /state='mutating'/);
  assert.match(migration, /pending_approval/);
  assert.match(migration, /reconciliation_required/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON ccpun_admin\.control_resource/);
});

test("LINE reconciliation is durable but autonomous execution is private-VPS only", () => {
  const route = read("apps/admin/app/api/internal/line/rich-menu/reconcile/route.ts");
  const reconciler = read("lib/admin/line/rich-menu-reconciler.ts");
  const worker = read("scripts/admin-background-worker.ts");
  const vercel = JSON.parse(read("apps/admin/vercel.json")) as { crons?: Array<{ path: string; schedule: string }> };
  assert.match(route, /export async function GET\(request: Request\)/);
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /authorization/);
  assert.match(route, /rich-menu-reconciler-unavailable/);
  assert.doesNotMatch(route, /reconcileDesiredLineRichMenu/);
  assert.equal(Object.hasOwn(vercel, "crons"), false);
  assert.match(worker, /CCPUN_BACKGROUND_EXECUTION_PLANE !== "vps"/);
  assert.match(worker, /CCPUN_BACKGROUND_WORKER_ENABLED !== "1"/);
  assert.match(worker, /line-rich-menu/);
  assert.match(reconciler, /claimLineRichMenuOperation/);
  assert.match(reconciler, /beginLineRichMenuMutation/);
  assert.match(reconciler, /checkpointLineRichMenuOperation/);
  assert.match(reconciler, /readDefaultLineRichMenuSnapshot/);
  assert.match(reconciler, /readback_mismatch_after_mutation/);
});

test("provider gates fail closed and Public Web never embeds the LINE token", () => {
  const delivery = read("lib/admin/line/provider.ts");
  const richMenu = read("lib/admin/line/rich-menu-provider.ts");
  const ingress = read("apps/web/lib/line/private-ingestion.ts");
  assert.match(delivery, /CCPUN_LINE_SYSTEM_DELIVERY_ENABLED\?\.trim\(\) === "true"/);
  assert.match(richMenu, /CCPUN_LINE_RICH_MENU_PROVIDER_ENABLED\?\.trim\(\) === "true"/);
  assert.match(ingress, /CCPUN_LINE_SYSTEM_DELIVERY_ENABLED\?\.trim\(\) !== "true"/);
  assert.doesNotMatch(ingress, /CCPUN_LINE_CHANNEL_ACCESS_TOKEN/);
});

test("hold does not roll back and rollback uses the approved provider reference", () => {
  const migration = read("db/migrations/20260919_provider_control_plane_v1.sql");
  const reconciler = read("lib/admin/line/rich-menu-reconciler.ts");
  const ui = read("features/admin/line/LineProviderActivationActions.tsx");
  assert.match(migration, /WHEN c\.command_type='hold' THEN r\.desired_definition/);
  assert.match(migration, /approved_previous_provider_ref/);
  assert.match(reconciler, /assignDefaultLineRichMenu\(operation\.desiredProviderRef\)/);
  assert.match(ui, /หยุดการปรับอัตโนมัติ/);
  assert.match(ui, /คืนเมนูก่อนหน้า/);
});
