import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const SCAN_DIRS = ['app', 'features', 'components', 'lib', 'cms', 'db'];
const ROOT_FILES = ['auth.ts', 'proxy.ts', 'next.config.ts'];
const IGNORE_PARTS = new Set(['node_modules', '.next', '.git', '.ccpun-local']);

const normalize = (value) => value.split(path.sep).join('/');
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
  if (specifier.startsWith('@/')) base = path.join(ROOT, specifier.slice(2));
  else if (specifier.startsWith('./') || specifier.startsWith('../')) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;

  const candidates = [base];
  if (!path.extname(base)) {
    for (const ext of SOURCE_EXTENSIONS) candidates.push(`${base}${ext}`);
    for (const ext of SOURCE_EXTENSIONS) candidates.push(path.join(base, `index${ext}`));
  }
  for (const candidate of candidates) if (await exists(candidate)) return relative(candidate);
  return null;
}

function isWebEntry(file) {
  return file === 'app/page.tsx'
    || file === 'app/not-found.tsx'
    || file === 'app/robots.ts'
    || file.startsWith('app/blog/')
    || file.startsWith('app/ci-planning/')
    || file.startsWith('app/cookie-policy/')
    || file.startsWith('app/privacy/')
    || file.startsWith('app/sitemap.xml/')
    || file.startsWith('app/sitemaps/')
    || file.startsWith('app/tools/');
}

function isAdminEntry(file) {
  return file === 'auth.ts'
    || file.startsWith('app/(control-plane)/')
    || file.startsWith('app/(control-plane-auth)/')
    || file.startsWith('app/(control-plane-error)/')
    || file.startsWith('app/api/admin/')
    || file.startsWith('app/api/auth/')
    || file.startsWith('app/api/preview/')
    || file.startsWith('app/studio/');
}

function isRouteLike(file) {
  return file.startsWith('app/') && /\/(?:page|route|layout|loading|error|not-found|robots)\.(?:ts|tsx|js|jsx)$/.test(`/${file}`);
}

function externalPackage(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('@/') || specifier.startsWith('node:')) return null;
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

async function main() {
  const absoluteFiles = [];
  for (const dir of SCAN_DIRS) await walk(path.join(ROOT, dir), absoluteFiles);
  for (const file of ROOT_FILES) if (await exists(path.join(ROOT, file))) absoluteFiles.push(path.join(ROOT, file));

  const files = [...new Set(absoluteFiles.map(relative))].sort();
  const sourceByFile = new Map();
  const edges = new Map();
  const externalByFile = new Map();
  const envByFile = new Map();

  for (const file of files) {
    const absolute = path.join(ROOT, file);
    const source = await readFile(absolute, 'utf8');
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
    envByFile.set(file, new Set([...source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((match) => match[1])));
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

  const webRoots = files.filter(isWebEntry);
  const adminRoots = files.filter(isAdminEntry);
  const web = reachable(webRoots);
  const admin = reachable(adminRoots);
  const shared = [...web].filter((file) => admin.has(file)).sort();
  const webOnly = [...web].filter((file) => !admin.has(file)).sort();
  const adminOnly = [...admin].filter((file) => !web.has(file)).sort();
  const boundaryEntrypoints = ['app/layout.tsx', 'proxy.ts', 'next.config.ts'].filter((file) => sourceByFile.has(file));
  const assigned = new Set([...web, ...admin, ...boundaryEntrypoints]);
  const unassignedRoutes = files.filter((file) => isRouteLike(file) && !assigned.has(file)).sort();

  const envOwners = new Map();
  const dependencyOwners = new Map();
  function addOwner(map, key, owner) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(owner);
  }
  function ownerOf(file) {
    if (web.has(file) && admin.has(file)) return 'shared';
    if (web.has(file)) return 'web';
    if (admin.has(file)) return 'admin';
    if (boundaryEntrypoints.includes(file)) return 'boundary';
    return 'unassigned';
  }
  for (const file of files) {
    const owner = ownerOf(file);
    for (const env of envByFile.get(file) ?? []) addOwner(envOwners, env, owner);
    for (const dependency of externalByFile.get(file) ?? []) addOwner(dependencyOwners, dependency, owner);
  }

  const environmentVariables = [...envOwners.entries()]
    .map(([key, owners]) => ({ key, owners: [...owners].sort() }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const dependencies = [...dependencyOwners.entries()]
    .map(([name, owners]) => ({ name, owners: [...owners].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const report = {
    generatedAt: new Date().toISOString(),
    sourceFiles: files.length,
    roots: { web: webRoots, admin: adminRoots, boundary: boundaryEntrypoints },
    counts: {
      webReachable: web.size,
      adminReachable: admin.size,
      webOnly: webOnly.length,
      adminOnly: adminOnly.length,
      shared: shared.length,
      unassignedRoutes: unassignedRoutes.length,
    },
    sharedRuntimeFiles: shared,
    unassignedRoutes,
    environmentVariables,
    dependencies,
  };

  console.log('CCPUN_MONOREPO_BOUNDARY_AUDIT_START');
  console.log(JSON.stringify(report, null, 2));
  console.log('CCPUN_MONOREPO_BOUNDARY_AUDIT_END');

  const output = process.env.CCPUN_MONOREPO_AUDIT_OUTPUT?.trim();
  if (output) await writeFile(path.resolve(output), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export { main };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
