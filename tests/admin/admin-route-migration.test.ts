import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { classifyProductionAdminPath } from "../../lib/admin/host-routing";
import {
  isAdminApiPath,
  isCanonicalAdminPagePath,
  legacyAdminPageDestination,
  safeAdminReturnPath,
} from "../../lib/admin/routes";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(repositoryRoot, file), "utf8");

function sourceFiles(directory: string): string[] {
  const absolute = path.join(repositoryRoot, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(child);
    return /\.(?:ts|tsx|mjs)$/.test(entry.name) ? [child] : [];
  });
}

test("canonical Control Plane routes exist without an active snt-admin route tree", () => {
  for (const route of [
    "app/(control-plane-auth)/login/page.tsx",
    "app/(control-plane)/dashboard/page.tsx",
    "app/(control-plane)/dashboard/inbox/page.tsx",
    "app/(control-plane)/content/page.tsx",
    "app/(control-plane)/seo/page.tsx",
    "app/(control-plane)/social/page.tsx",
    "app/(control-plane)/analytics/page.tsx",
    "app/(control-plane)/operations/page.tsx",
    "app/(control-plane)/settings/page.tsx",
    "app/(control-plane-error)/admin-not-found/page.tsx",
    "app/api/admin/session/route.ts",
  ]) assert.equal(existsSync(path.join(repositoryRoot, route)), true, route);

  assert.deepEqual(sourceFiles("app/snt-admin"), []);
  for (const pathname of ["/dashboard", "/content/articles", "/seo", "/social", "/analytics", "/operations", "/settings"]) {
    assert.equal(isCanonicalAdminPagePath(pathname), true, pathname);
  }
});

test("legacy pages redirect through an explicit map while legacy APIs stay method-preserving adapters", () => {
  assert.equal(legacyAdminPageDestination("/snt-admin/dashboard/"), "/dashboard/");
  assert.equal(legacyAdminPageDestination("/snt-admin/distribution/operations/"), "/social/posts/");
  assert.equal(legacyAdminPageDestination("/snt-admin/seo/article-1/"), "/seo/audits/article-1/");
  assert.equal(isAdminApiPath("/api/snt-admin/reviews/1/approve"), true);
  assert.equal(isAdminApiPath("/api/admin/reviews/1/approve"), true);

  const config = read("next.config.ts");
  assert.match(config, /beforeFiles:\s*\[[\s\S]*source: "\/api\/snt-admin\/:path\*", destination: "\/api\/admin\/:path\*"/);
  assert.match(config, /method-preserving adapter keeps delayed jobs and OAuth callbacks alive during migration/);
  assert.doesNotMatch(config, /source: "\/api\/snt-admin\/:path\*"[\s\S]{0,120}permanent:/);
});

test("Admin root, return URL and unauthenticated API boundaries fail safely", () => {
  assert.equal(classifyProductionAdminPath("/"), "entry");
  assert.equal(classifyProductionAdminPath("/dashboard/"), "allow");
  assert.equal(classifyProductionAdminPath("/api/admin/session/"), "allow");
  assert.equal(classifyProductionAdminPath("/unknown"), "reject");

  assert.equal(safeAdminReturnPath("/dashboard/inbox/?view=pending"), "/dashboard/inbox/?view=pending");
  assert.equal(safeAdminReturnPath("/studio/structure/article"), "/studio/structure/article");
  assert.equal(safeAdminReturnPath("https://evil.example/dashboard/"), null);
  assert.equal(safeAdminReturnPath("//evil.example/dashboard/"), null);
  assert.equal(safeAdminReturnPath("/dashboard/#unsafe"), null);
  assert.equal(safeAdminReturnPath("/api/admin/session/"), null);

  const proxy = read("proxy.ts");
  const environment = read("lib/admin/environment.ts");
  assert.match(environment, /resolveAdminEnvironment\([\s\S]*process\.env\.VERCEL_ENV,[\s\S]*process\.env\.VERCEL_PROJECT_ID/);
  assert.doesNotMatch(environment, /resolveAdminEnvironment\([\s\S]{0,160}NEXT_PUBLIC_CCPUN_VERCEL_PROJECT_ID/);
  assert.match(proxy, /const isAdminUat = environment === "admin-uat"/);
  assert.match(proxy, /const isDeployedAdmin = isProductionAdmin \|\| isAdminUat/);
  assert.match(proxy, /const isDedicatedAdmin = isDeployedAdmin \|\| isLocalUat \|\| isLocalProduction/);
  assert.match(proxy, /if \(isDedicatedAdmin\)/);
  assert.match(proxy, /matcher:\s*\[\s*\/\/[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*"\/",/);
  assert.match(proxy, /type: "host", value: "localhost"/);
  assert.match(proxy, /type: "host", value: "ccpun-admin\(\?:-\.\+\)\?\\\\\.vercel\\\\\.app"/);
  assert.match(proxy, /if \(isAdminNotFoundPage\) \{\s*return NextResponse\.next\(\{ status: 404 \}\)/);
  assert.match(proxy, /disposition === "entry"[\s\S]*role \? "\/dashboard\/" : "\/login\/"/);
  assert.match(proxy, /if \(pathname\.startsWith\("\/api\/"\)\) \{\s*return NextResponse\.json\(\{ error: "unauthorized" \}, \{ status: 401 \}\)/);
  assert.match(proxy, /if \(isAdminApi \|\| isPreviewApi\) \{\s*return NextResponse\.json\(\{ error: "unauthorized" \}, \{ status: 401 \}\)/);
  assert.doesNotMatch(proxy, /pathname\.startsWith\("\/api\/"\)[\s\S]{0,180}NextResponse\.redirect/);
  assert.match(proxy, /if \(isProductionEnvironment\(\) \|\| !adminSurfaceAllowed\) \{\s*return new NextResponse\("Not Found", \{ status: 404 \}\)/);
});

test("active Admin runtime references snt-admin only in explicit compatibility adapters", () => {
  const allowed = new Set([
    "app/robots.ts",
    "lib/admin/routes.ts",
    "next.config.ts",
    "proxy.ts",
  ]);
  const files = [
    ...sourceFiles("app"),
    ...sourceFiles("features/admin"),
    ...sourceFiles("lib/admin"),
    ...sourceFiles("cms/sanity/policy"),
    "auth.ts",
    "next.config.ts",
    "proxy.ts",
  ];
  const offenders = files.filter((file) => !allowed.has(file) && read(file).includes("snt-admin"));
  assert.deepEqual(offenders, []);
});
