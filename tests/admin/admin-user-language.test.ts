import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("Admin navigation and entry screens use ordinary Thai", () => {
  const navigation = read("apps/admin/app/(control-plane)/layout.tsx")
    + read("features/admin/components/AdminNavigation.tsx");
  const entry = read("apps/admin/app/(control-plane-auth)/login/page.tsx")
    + read("apps/admin/app/layout.tsx");

  assert.match(navigation, /ภาพรวม/);
  assert.match(navigation, /ลูกค้า LINE/);
  assert.match(navigation, /label: "เนื้อหา"/);
  assert.doesNotMatch(navigation, />Overview</);
  assert.doesNotMatch(navigation, />Section</);
  assert.match(entry, /ศูนย์จัดการ CCPun/);
  assert.doesNotMatch(entry, /Admin Control Plane/);
  assert.doesNotMatch(entry, /PRODUCTION ADMIN|Vercel หรือ Sanity/);
  assert.match(read("lib/admin/environment.ts"), /ศูนย์จัดการ · ระบบจริง/);
  assert.doesNotMatch(read("lib/admin/environment.ts"), /return "PRODUCTION ADMIN"/);
});

test("LINE controls explain actions without internal reconciliation jargon", () => {
  const ui = read("features/admin/line/LineProviderActivationActions.tsx");
  assert.match(ui, /หยุดการปรับอัตโนมัติ/);
  assert.match(ui, /คืนเมนูก่อนหน้า/);
  assert.doesNotMatch(ui, /หยุด reconcile|Rollback ที่อนุมัติไว้|provider operation|readback/i);
  assert.doesNotMatch(read("features/admin/line/LineDiscoveryManager.tsx"), />PREVIEW</);
});

test("social and search dashboards use user-facing labels", () => {
  const social = read("features/admin/social/SocialMarketingDashboard.tsx")
    + read("features/admin/social/MarketingDashboardVisuals.tsx")
    + read("lib/admin/social/marketing-dashboard-model.ts");
  const search = read("features/admin/seo/opportunities/Ga4ManualSync.tsx")
    + read("features/admin/seo/opportunities/GscManualSync.tsx")
    + read("apps/admin/app/(control-plane)/analytics/search/page.tsx");

  assert.match(social, /การมองเห็น/);
  assert.match(social, /ความครบถ้วน/);
  assert.doesNotMatch(social, />Awareness<|>Intent<|>Coverage<|>Quality<|>Content</);
  assert.match(search, /จำนวนการค้นหาและระดับความยาก/);
  assert.doesNotMatch(search, /Traffic เพิ่ม|query intent|CTR ลด|CTA ของหน้า/);
});

test("primary Admin copy does not expose storage or integration jargon", () => {
  const social = read("features/admin/social/SocialPostsWorkspace.tsx")
    + read("features/admin/social/SocialWorkspaceSummary.tsx")
    + read("features/admin/social/SocialMarketingDashboard.tsx");
  const sync = read("features/admin/components/SyncUbersuggestButton.tsx");
  assert.doesNotMatch(social, /ฉบับร่างใน Sanity|ข้อมูลจริงจาก Neon/);
  assert.doesNotMatch(sync, /snapshot|secret|ยิง provider/i);
});

test("technical identifiers are secondary details, not primary instructions", () => {
  const settings = read("apps/admin/app/(control-plane)/settings/[section]/page.tsx");
  const connections = read("features/admin/social/connections-page.tsx");
  assert.match(settings, /รายละเอียดสำหรับทีมเทคนิค/);
  assert.match(connections, /ดูรายละเอียดสิทธิ์สำหรับทีมเทคนิค/);
  assert.match(connections, /รหัสสิทธิ์/);
});
