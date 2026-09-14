import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("public host cannot fall through to Admin Auth.js endpoints", () => {
  const proxy = read("proxy.ts");
  assert.match(proxy, /!isAdminPage && !isAdminApi && !isStudioPage && !isPreviewApi && !isAuthApi/);
  assert.match(proxy, /if \(isProductionEnvironment\(\) \|\| !adminSurfaceAllowed\) \{\s*return new NextResponse\("Not Found", \{ status: 404 \}\)/);
});

test("Admin draft preview is authenticated, narrow and no-store", () => {
  const proxy = read("proxy.ts");
  const routing = read("lib/admin/host-routing.ts");
  const nextConfig = read("next.config.ts");
  assert.match(proxy, /Boolean\(role\) && isAuthenticatedAdminPreviewPath\(pathname\)/);
  assert.match(routing, /isPathOrChild\(path, "\/blog"\)/);
  assert.doesNotMatch(routing, /isPathOrChild\(path, "\/tools"\)|isPathOrChild\(path, "\/ci-planning"\)/);
  assert.match(nextConfig, /ADMIN_PROTECTED_PREVIEW_SOURCES = IS_ADMIN_APPLICATION \? \["\/blog\/:path\*"\] : \[\]/);
  assert.match(nextConfig, /ADMIN_PROTECTED_PREVIEW_SOURCES\.map\([\s\S]*PRIVATE_ADMIN_API_HEADERS/);
});

test("Studio Presentation starts on the protected Blog preview surface", () => {
  const presentation = read("cms/sanity/config/presentation.ts");
  assert.match(presentation, /initial: "\/blog\/"/);
  assert.match(presentation, /enable: "\/api\/preview\/enable"/);
});

test("Admin application never renders public analytics or cookie consent widgets", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /!IS_ADMIN_APPLICATION \? <ClientWidgets/);
});

test("Admin article index normalizes draft perspective IDs", () => {
  const control = read("lib/admin/sanity-control.ts");
  assert.match(control, /isDraft: row\.isDraft \|\| row\.id\.startsWith\("drafts\."\)/);
});

test("dynamic article Preview POST survives trailingSlash normalization", () => {
  const proxy = read("proxy.ts");
  assert.match(proxy, /request\.method === "POST"/);
  assert.ok(proxy.includes('/^\\/api\\/admin\\/content\\/[^/]+\\/preview\\/$/.test(pathname)'));
  assert.match(proxy, /canonicalPreviewUrl\.pathname = pathname\.slice\(0, -1\)/);
  assert.match(proxy, /NextResponse\.rewrite\(canonicalPreviewUrl\)/);
});
