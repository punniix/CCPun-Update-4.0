import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import "./page-seo.test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Owner settings preserves original destinations and requires permission before exposing job context", async () => {
  const { transpileModule, ModuleKind } = createRequire(import.meta.url)("typescript") as typeof import("typescript");
  const compiled = transpileModule(read("features/admin/components/SettingsIndexPage.tsx"), { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
  const permissions: string[] = [];
  let denied = false;
  const loaded = { exports: {} as { SettingsPage: (props: unknown) => Promise<unknown> } };
  runInNewContext(compiled, { module: loaded, exports: loaded.exports,
    require: (name: string) => {
      if (name === "next/link") return { default: "a" };
      if (name === "react/jsx-runtime") return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
      assert.ok(name.endsWith("/require-permission"));
      return { requireAdminPermission: async (permission: string) => { permissions.push(permission); if (denied) throw new Error("synthetic-denied"); } };
    } });
  const props = { eyebrow: "ตั้งค่า", title: "ตั้งค่า", items: [["/settings/integrations/", "การเชื่อมต่อ", "Synthetic connection"], ["/settings/access/", "สิทธิ์ผู้ใช้", "Synthetic access"], ["/settings/system/", "ข้อมูลระบบ", "Synthetic system"]] };
  const rendered = JSON.stringify(await loaded.exports.SettingsPage(props));
  for (const href of ["/settings/integrations/", "/settings/access/", "/settings/system/", "/operations/jobs/"]) assert.ok(rendered.includes(`"href":"${href}"`));
  assert.match(rendered, /บัญชี/); assert.match(rendered, /งานเบื้องหลัง/);
  assert.match(rendered, /"type":"details"/);
  assert.doesNotMatch(rendered, /"onClick"|"action"|พร้อมใช้งานทั้งหมด/);
  denied = true;
  await assert.rejects(() => loaded.exports.SettingsPage(props), /synthetic-denied/);
  assert.deepEqual(permissions, ["settings:read", "settings:read"]);
});

test("Admin Preview uses the admin feature-branch convention plus exact data-plane guards", () => {
  const runtime = read("lib/admin/social/runtime.ts");
  assert.match(runtime, /SOCIAL_UAT_SANITY_PROJECT_ID = "ccb9lnw5"/);
  assert.match(runtime, /SOCIAL_UAT_SANITY_DATASET = "uat"/);
  assert.match(runtime, /SOCIAL_PRODUCTION_BRANCH = "v4-production"/);
  assert.match(runtime, /branch\.startsWith\("admin\/"\)/);
  assert.match(runtime, /compatibilityBranches\.includes\(branch\)/);
  assert.match(runtime, /gitBranch !== SOCIAL_PRODUCTION_BRANCH/);
});

test("Sanity Free privacy is checked on PR, Production push and manual dispatch without scheduled workload", () => {
  const workflow = read(".github/workflows/sanity-free-plan-privacy.yml");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /push:\n\s+branches: \[v4-production\]/);
  assert.match(workflow, /pull_request:\n\s+branches: \[v4-production\]/);
  assert.match(workflow, /node qa\/sanity-free-plan-privacy\.mjs/);
  assert.doesNotMatch(workflow, /^\s*schedule\s*:/m);
});

test("Admin extension contract keeps one auth authority and no-cost data ownership", () => {
  const contract = read("docs/architecture/admin-platform-extension-contract.md");
  assert.match(contract, /Auth\.js is the only application authentication authority/);
  assert.match(contract, /Sanity/);
  assert.match(contract, /Neon `ccpun_admin`/);
  assert.match(contract, /Neon `ccpun_social`/);
  assert.match(contract, /No upstream feature may automatically provision a paid Vercel, Sanity, Neon or third-party resource/);
  assert.match(contract, /openquok/);
});

test("Admin app root remains private and independently deployable", () => {
  const nextConfig = read("apps/admin/next.config.ts");
  const builder = read("apps/admin/scripts/build-provider.mjs");
  const adminPackage = JSON.parse(read("apps/admin/package.json")) as { scripts: { build: string } };
  assert.match(nextConfig, /noindex, nofollow, noarchive/);
  assert.match(nextConfig, /private, no-cache, no-store/);
  assert.match(nextConfig, /withWorkflow\(nextConfig\)/);
  assert.equal(existsSync(new URL("../../apps/admin/vercel.json", import.meta.url)), false);
  assert.equal(existsSync(new URL("../../scripts/vercel-ignore-build.mjs", import.meta.url)), false);
  assert.equal(adminPackage.scripts.build, "node scripts/build-provider.mjs");
  assert.match(nextConfig, /output: "standalone"/);
  assert.match(builder, /HOSTINGER_BUILD_ROLE_REQUIRED/);
});

test("Admin auth configuration is Auth.js/Google-oriented and does not depend on Neon Auth", () => {
  const authConfig = read("lib/admin/auth-config.ts");
  assert.match(authConfig, /AUTH_GOOGLE_ID/);
  assert.match(authConfig, /AUTH_GOOGLE_SECRET/);
  assert.doesNotMatch(authConfig, /neon_auth|Neon Auth|@neondatabase\/auth/i);
});
