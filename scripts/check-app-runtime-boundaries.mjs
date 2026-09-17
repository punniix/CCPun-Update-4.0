import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const SCAN_DIRS = ["app", "apps", "features", "components", "lib", "cms", "db"];
const ROOT_FILES = ["auth.ts", "proxy.ts", "next.config.ts"];
const IGNORE_PARTS = new Set(["node_modules", ".next", ".git", ".ccpun-local"]);

const normalize = (value) => value.split(path.sep).join("/");
const relative = (value) => normalize(path.relative(ROOT, value));

async function exists(file) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}

async function walk(dir, output = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return output; }
  for (const entry of entries) {
    if (IGNORE_PARTS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, output);
    else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) output.push(full);
  }
  return output;
}

function importSpecifiers(source) {
  const specs = new Set();
  const patterns = [
    /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specs.add(match[1]);
  }
  return [...specs];
}

async function resolveLocal(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = path.join(ROOT, specifier.slice(2));
  else if (specifier.startsWith("./") || specifier.startsWith("../")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;

  const candidates = [base];
  if (!path.extname(base)) {
    for (const ext of SOURCE_EXTENSIONS) candidates.push(`${base}${ext}`);
    for (const ext of SOURCE_EXTENSIONS) candidates.push(path.join(base, `index${ext}`));
  }
  for (const candidate of candidates) if (await exists(candidate)) return relative(candidate);
  return null;
}

function externalPackage(specifier) {
  if (specifier.startsWith(".") || specifier.startsWith("@/") || specifier.startsWith("node:")) return null;
  if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/");
  return specifier.split("/")[0];
}

const absoluteFiles = [];
for (const dir of SCAN_DIRS) await walk(path.join(ROOT, dir), absoluteFiles);
for (const file of ROOT_FILES) if (await exists(path.join(ROOT, file))) absoluteFiles.push(path.join(ROOT, file));

const files = [...new Set(absoluteFiles.map(relative))].sort();
const sourceByFile = new Map();
const edges = new Map();
const externalByFile = new Map();
for (const file of files) {
  const absolute = path.join(ROOT, file);
  const source = await readFile(absolute, "utf8");
  sourceByFile.set(file, source);
  const local = new Set();
  const external = new Set();
  for (const specifier of importSpecifiers(source)) {
    const resolved = await resolveLocal(absolute, specifier);
    if (resolved) local.add(resolved);
    else {
      const pkg = externalPackage(specifier);
      if (pkg) external.add(pkg);
    }
  }
  edges.set(file, local);
  externalByFile.set(file, external);
}

function reachable(roots) {
  const seen = new Set();
  const stack = [...roots];
  while (stack.length) {
    const file = stack.pop();
    if (!file || seen.has(file) || !sourceByFile.has(file)) continue;
    seen.add(file);
    for (const dependency of edges.get(file) ?? []) stack.push(dependency);
  }
  return seen;
}

const webRoots = files.filter((file) => file.startsWith("apps/web/"));
const adminRoots = files.filter((file) => file.startsWith("apps/admin/"));
assert.ok(webRoots.length > 0, "apps/web must expose a source boundary");
assert.ok(adminRoots.length > 0, "apps/admin must expose a source boundary");

const webReachable = reachable(webRoots);
const adminReachable = reachable(adminRoots);
const forbiddenWebPrefixes = ["lib/admin/", "features/admin/", "cms/sanity/admin/"];
const webAdminRuntimeLeaks = [...webReachable]
  .filter((file) => forbiddenWebPrefixes.some((prefix) => file.startsWith(prefix)))
  .sort();
const writeCredentialPattern = /SANITY_(?:PRODUCTION_)?(?:API_|RESEARCH_)?WRITE_TOKEN/;
const webWriteCredentialLeaks = [...webReachable]
  .filter((file) => writeCredentialPattern.test(sourceByFile.get(file) ?? ""))
  .sort();
const webExternalPackages = new Set(
  [...webReachable].flatMap((file) => [...(externalByFile.get(file) ?? [])]),
);

assert.deepEqual(
  webAdminRuntimeLeaks,
  [],
  `Web runtime must not import Admin-owned runtime: ${webAdminRuntimeLeaks.join(", ")}`,
);
assert.deepEqual(
  webWriteCredentialLeaks,
  [],
  `Web runtime must never reference Sanity write credentials: ${webWriteCredentialLeaks.join(", ")}`,
);
assert.equal(webExternalPackages.has("workflow"), false, "Web runtime must not depend on the Admin Workflow runtime");

const sharedReachable = [...webReachable].filter((file) => adminReachable.has(file)).sort();
console.log(JSON.stringify({
  webRoots: webRoots.length,
  adminRoots: adminRoots.length,
  webReachable: webReachable.size,
  adminReachable: adminReachable.size,
  sharedReachable: sharedReachable.length,
  webAdminRuntimeLeaks,
  webWriteCredentialLeaks,
}, null, 2));
console.log("App runtime boundary contract passed.");
