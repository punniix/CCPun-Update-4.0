import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, realpathSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { writeFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');


function writeSecurityBaselineFixture(root) {
  for (const file of ['scripts/check-next-security-baseline.mjs', 'lib/runtime/node-security-baseline.mjs', 'package.json', 'package-lock.json', 'apps/web/package.json', 'apps/admin/package.json']) {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, read(file));
  }
}

// Trap the build-child boundary rather than execute any SDK, compiler or network.
function forbiddenBuildBoundary(fixture) {
  const marker = join(fixture, 'unexpected-sdk-boundary');
  const gitMarker = join(fixture, 'unexpected-git-boundary');
  const file = join(fixture, 'forbidden-build-boundary.mjs');
  writeFileSync(file, `import children from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { writeFileSync } from 'node:fs';
children.spawnSync = command => {
  if (command === 'git') { writeFileSync(${JSON.stringify(gitMarker)}, 'git'); return { status: 1, stdout: '' }; }
  writeFileSync(${JSON.stringify(marker)}, 'child:' + command);
  throw new Error('FAKE_SDK_BOUNDARY_REACHED');
};
syncBuiltinESMExports();
globalThis.fetch = () => { writeFileSync(${JSON.stringify(marker)}, 'fetch'); throw new Error('FAKE_NETWORK_BOUNDARY_REACHED'); };
`);
  return { file: realpathSync(file), marker, gitMarker };
}

test('current app roots use native workspace builders and contain no provider deployment configuration', () => {
  const root = JSON.parse(read('package.json'));
  for (const role of ['web', 'admin']) {
    assert.equal(JSON.parse(read(`apps/${role}/package.json`)).scripts.build, 'node scripts/build-provider.mjs');
    assert.equal(root.scripts[`build:${role}:shadow`], `npm run build --workspace @ccpun/${role}`);
    const builder = read(`apps/${role}/scripts/build-provider.mjs`);
    if (role === "web") {
      assert.match(builder, /function run\(command, args, cwd = webRoot\)/);
      assert.match(builder, /spawnSync\(command, args, \{[\s\S]*?cwd,/);
    } else {
      assert.match(builder, /export function runAdminNextBuild\(root = adminRoot,/);
      assert.match(builder, /runAdminNextBuild\(adminRoot, buildEnvironment\)/);
      assert.match(builder, /cwd: root, env: variables/);
    }
    assert.equal(existsSync(new URL(`../apps/${role}/vercel.json`, import.meta.url)), false);
  }
  assert.equal(root.scripts.build, 'node scripts/build-root.mjs');
  assert.match(read('next.config.ts'), /import \{ withWorkflow \} from "workflow\/next";/);
  assert.match(read('next.config.ts'), /export default withWorkflow\(nextConfig\);/);
  assert.equal(root.scripts['build:hostinger'], 'npm run build --workspace @ccpun/web');
  assert.equal(root.scripts['build:survivor'], undefined);
  assert.equal(root.scripts['guard:survivor'], undefined);
  assert.equal(root.scripts['test:vercel'], undefined);
  for (const file of ['vercel.json', 'scripts/vercel-ignore-build.mjs', 'scripts/guard-survivor-deploy.mjs', 'scripts/promote-admin-after-ci.mjs']) assert.equal(existsSync(new URL('../' + file, import.meta.url)), false, file);
  const web = read('apps/web/next.config.ts');
  assert.match(web, /skipTrailingSlashRedirect: true/);
  assert.match(web, /output: "standalone"/);
  assert.match(web, /if \(IS_HOSTINGER_DEPLOYMENT\) return \[\]/);
  assert.match(web, /WEB_REDIRECTS\.map/);
  assert.match(read('apps/web/proxy.ts'), /for \(const \{ prefix, destination \} of WEB_REDIRECTS\)/);
  assert.match(read('apps/web/scripts/build-provider.mjs'), /sealStandaloneProvenance/);
  assert.match(read('apps/web/scripts/build-provider.mjs'), /stageStandaloneRuntime/);
});

test('canonical Admin CLI denies retired provider inputs before native fallback, install, compiler or artifacts', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'ccpun-native-admin-cli-deny-'));
  try {
    const scripts = join(fixture, 'apps/admin/scripts'); mkdirSync(scripts, { recursive: true });
    mkdirSync(join(fixture, 'lib/runtime'), { recursive: true });
    writeFileSync(join(fixture, 'lib/runtime/hostinger-production-release.mjs'), read('lib/runtime/hostinger-production-release.mjs'));
    writeFileSync(join(fixture, 'lib/runtime/deployment-lanes.mjs'), read('lib/runtime/deployment-lanes.mjs'));
    const entry = join(scripts, 'build-provider.mjs'); writeFileSync(entry, read('apps/admin/scripts/build-provider.mjs'));
    writeSecurityBaselineFixture(fixture);
    const boundary = forbiddenBuildBoundary(fixture);
    const tree = () => JSON.stringify([readdirSync(fixture).sort(), readdirSync(scripts).sort()]);
    const baseline = tree();
    for (const [env, error] of [
      [{ CCPUN_DEPLOYMENT_PROVIDER: 'vercel' }, 'UNSUPPORTED_BUILD_PROVIDER'],
      [{ CCPUN_DEPLOYMENT_PROVIDER: 'future-cloud' }, 'UNSUPPORTED_BUILD_PROVIDER'],
      [{ CCPUN_DEPLOYMENT_PROVIDER: 'hostinger', CCPUN_DEPLOYMENT_ROLE: 'web' }, 'HOSTINGER_BUILD_ROLE_REQUIRED'],
      [{ CCPUN_DEPLOYMENT_PROVIDER: 'hostinger', CCPUN_DEPLOYMENT_ROLE: 'admin', VERCEL_DEPLOYMENT_ID: 'retired' }, 'UNSUPPORTED_PROVIDER_METADATA'],
      ...['hostinger', 'local'].flatMap(provider => ['vercel', ' @workflow/world-vercel '].map(target => [{ CCPUN_DEPLOYMENT_PROVIDER: provider, CCPUN_DEPLOYMENT_ROLE: 'admin', WORKFLOW_TARGET_WORLD: target }, 'UNSUPPORTED_WORKFLOW_WORLD'])),
    ]) {
      const result = spawnSync(process.execPath, ['--import', boundary.file, realpathSync(entry)], { cwd: fixture, encoding: 'utf8', env: { PATH: '', ...env } });
      assert.notEqual(result.status, 0); assert.match(result.stderr, new RegExp(error));
      assert.equal(existsSync(boundary.marker), false); assert.equal(existsSync(boundary.gitMarker), false);
      assert.equal(tree(), baseline); assert.equal(result.stdout, '');
    }
    for (const target of [undefined, 'local', '@workflow/world-postgres', '/opt/ccpun/ccpun-native-workflow-world.cjs']) {
      const env = { PATH: '', ...(target === undefined ? {} : { WORKFLOW_TARGET_WORLD: target }) };
      const result = spawnSync(process.execPath, ['--import', boundary.file, realpathSync(entry)], { cwd: fixture, encoding: 'utf8', env });
      assert.match(result.stderr, /FAKE_SDK_BOUNDARY_REACHED/);
      assert.match(readFileSync(boundary.marker, 'utf8'), /^child:/);
      rmSync(boundary.marker); if (existsSync(boundary.gitMarker)) rmSync(boundary.gitMarker);
      assert.equal(tree(), baseline);
    }
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('root build denies unsupported provider metadata and invalid Hostinger roles before any build child', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'ccpun-native-build-deny-'));
  try {
    mkdirSync(join(fixture, 'scripts')); mkdirSync(join(fixture, 'lib/runtime'), { recursive: true });
    writeFileSync(join(fixture, 'scripts/build-root.mjs'), read('scripts/build-root.mjs'));
    writeFileSync(join(fixture, 'lib/runtime/deployment-lanes.mjs'), read('lib/runtime/deployment-lanes.mjs'));
    writeSecurityBaselineFixture(fixture);
    const boundary = forbiddenBuildBoundary(fixture);
    for (const [env, error] of [
      [{ CCPUN_DEPLOYMENT_PROVIDER: 'vercel', CCPUN_DEPLOYMENT_ROLE: 'web' }, 'UNSUPPORTED_BUILD_PROVIDER'],
      [{ CCPUN_DEPLOYMENT_PROVIDER: 'unapproved-cloud', CCPUN_DEPLOYMENT_ROLE: 'admin' }, 'UNSUPPORTED_BUILD_PROVIDER'],
      [{ CCPUN_DEPLOYMENT_PROVIDER: 'hostinger', CCPUN_DEPLOYMENT_ROLE: 'unknown' }, 'HOSTINGER_BUILD_ROLE_REQUIRED'],
      [{ CCPUN_DEPLOYMENT_PROVIDER: 'hostinger', CCPUN_DEPLOYMENT_ROLE: 'web', VERCEL_PROJECT_ID: 'retired' }, 'UNSUPPORTED_PROVIDER_METADATA'],
      [{ CCPUN_DEPLOYMENT_PROVIDER: 'hostinger', CCPUN_DEPLOYMENT_ROLE: 'web', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40) }, 'UNSUPPORTED_PROVIDER_METADATA'],
      ...['hostinger', 'local'].flatMap(provider => ['vercel', ' @workflow/world-vercel '].map(target => [{ CCPUN_DEPLOYMENT_PROVIDER: provider, CCPUN_DEPLOYMENT_ROLE: 'web', WORKFLOW_TARGET_WORLD: target }, 'UNSUPPORTED_WORKFLOW_WORLD'])),
    ]) {
      if (existsSync(boundary.gitMarker)) rmSync(boundary.gitMarker);
      const result = spawnSync(process.execPath, ['--import', boundary.file, join(fixture, 'scripts/build-root.mjs')], { cwd: fixture, encoding: 'utf8', env: { PATH: '', ...env } });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(error));
      assert.doesNotMatch(result.stderr, /spawnSync .*ENOENT/);
      assert.doesNotMatch(result.stdout, /delegating to|next build/);
      assert.equal(existsSync(boundary.marker), false);
      if (env.WORKFLOW_TARGET_WORLD) assert.equal(existsSync(boundary.gitMarker), false);
    }
    for (const target of [undefined, 'local', '@workflow/world-postgres', '/opt/ccpun/ccpun-native-workflow-world.cjs']) {
      const env = { PATH: '', CCPUN_DEPLOYMENT_PROVIDER: 'local', CCPUN_DEPLOYMENT_ROLE: 'web', ...(target === undefined ? {} : { WORKFLOW_TARGET_WORLD: target }) };
      const result = spawnSync(process.execPath, ['--import', boundary.file, join(fixture, 'scripts/build-root.mjs')], { cwd: fixture, encoding: 'utf8', env });
      assert.match(result.stderr, /FAKE_SDK_BOUNDARY_REACHED/);
      assert.match(readFileSync(boundary.marker, 'utf8'), /^child:/);
      rmSync(boundary.marker);
    }
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('canonical Web CLI denies unsupported inputs before child execution, public materialization or artifact writes', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'ccpun-native-web-cli-deny-'));
  try {
    const scripts = join(fixture, 'apps/web/scripts'); mkdirSync(scripts, { recursive: true });
    const entry = join(scripts, 'build-provider.mjs'); writeFileSync(entry, read('apps/web/scripts/build-provider.mjs'));
    writeSecurityBaselineFixture(fixture);
    const boundary = forbiddenBuildBoundary(fixture);
    const tree = () => JSON.stringify([readdirSync(fixture).sort(), readdirSync(scripts).sort()]);
    const baseline = tree();
    for (const [env, error] of [
      [{ CCPUN_DEPLOYMENT_PROVIDER: 'vercel', CCPUN_DEPLOYMENT_ROLE: 'web' }, 'UNSUPPORTED_BUILD_PROVIDER'],
      [{ CCPUN_DEPLOYMENT_PROVIDER: 'future-cloud', CCPUN_DEPLOYMENT_ROLE: 'web' }, 'UNSUPPORTED_BUILD_PROVIDER'],
      [{ CCPUN_DEPLOYMENT_PROVIDER: 'hostinger', CCPUN_DEPLOYMENT_ROLE: 'admin' }, 'HOSTINGER_BUILD_ROLE_REQUIRED'],
      [{ CCPUN_DEPLOYMENT_PROVIDER: 'hostinger', CCPUN_DEPLOYMENT_ROLE: 'web', VERCEL_ENV: 'production' }, 'UNSUPPORTED_PROVIDER_METADATA'],
      [{ CCPUN_DEPLOYMENT_PROVIDER: 'local', VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40) }, 'UNSUPPORTED_PROVIDER_METADATA'],
      ...['hostinger', 'local'].flatMap(provider => ['vercel', ' @workflow/world-vercel '].map(target => [{ CCPUN_DEPLOYMENT_PROVIDER: provider, CCPUN_DEPLOYMENT_ROLE: 'web', WORKFLOW_TARGET_WORLD: target }, 'UNSUPPORTED_WORKFLOW_WORLD'])),
    ]) {
      const result = spawnSync(process.execPath, ['--import', boundary.file, realpathSync(entry)], { cwd: fixture, encoding: 'utf8', env: { PATH: '', ...env } });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(error));
      assert.doesNotMatch(result.stderr, /spawnSync .*ENOENT|fetch failed|Required public|ENOENT.*public/);
      assert.equal(result.stdout, '');
      assert.equal(existsSync(join(fixture, '.next')), false);
      assert.equal(existsSync(join(fixture, 'public')), false);
      // Guard executes before any operation that could materialize network assets.
      assert.equal(tree(), baseline);
      assert.equal(existsSync(boundary.marker), false);
      assert.equal(existsSync(boundary.gitMarker), false);
    }
    for (const target of [undefined, 'local', '@workflow/world-postgres', '/opt/ccpun/ccpun-native-workflow-world.cjs']) {
      const env = { PATH: '', CCPUN_DEPLOYMENT_PROVIDER: 'local', CCPUN_DEPLOYMENT_ROLE: 'web', ...(target === undefined ? {} : { WORKFLOW_TARGET_WORLD: target }) };
      const result = spawnSync(process.execPath, ['--import', boundary.file, realpathSync(entry)], { cwd: fixture, encoding: 'utf8', env });
      assert.match(result.stderr, /FAKE_SDK_BOUNDARY_REACHED/);
      assert.equal(readFileSync(boundary.marker, 'utf8'), 'child:next');
      rmSync(boundary.marker);
      assert.equal(tree(), baseline);
    }
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});


test('retired private verifier and operative project-ID exports are absent', () => {
  assert.equal(existsSync(new URL('../lib/runtime/vercel-service-auth.ts', import.meta.url)), false);
  assert.doesNotMatch(read('lib/runtime/deployment-identity.ts'), /export\s+const\s+CCPUN_VERCEL_PROJECT_IDS/);
  assert.doesNotMatch(read('lib/content/sanity-lane.ts'), /CONTENT_VERCEL_PROJECT_IDS/);
});


test('direct root, Web and Admin CLI entries cannot bypass security floors with npm lifecycle disabled', () => {
  for (const entry of ['scripts/build-root.mjs', 'apps/web/scripts/build-provider.mjs', 'apps/admin/scripts/build-provider.mjs']) {
    const fixture = mkdtempSync(join(tmpdir(), 'ccpun-direct-floor-'));
    try {
      writeSecurityBaselineFixture(fixture);
      for (const file of [entry, 'lib/runtime/hostinger-production-release.mjs', 'lib/runtime/deployment-lanes.mjs']) {
        mkdirSync(dirname(join(fixture, file)), { recursive: true });
        writeFileSync(join(fixture, file), read(file));
      }
      const boundary = forbiddenBuildBoundary(fixture);
      const args = entry.includes('web/') ? [] : ['--native-scheduler-uat-acceptance'];
      const variables = { PATH: '', npm_config_ignore_scripts: 'true', CCPUN_DEPLOYMENT_PROVIDER: 'local' };
      const lock = JSON.parse(readFileSync(join(fixture, 'package-lock.json'), 'utf8'));
      lock.packages['node_modules/undici'].version = '7.29.1';
      writeFileSync(join(fixture, 'package-lock.json'), JSON.stringify(lock));
      const deniedLock = spawnSync(process.execPath, ['--import', boundary.file, realpathSync(join(fixture, entry)), ...args], { cwd: fixture, encoding: 'utf8', env: variables });
      assert.notEqual(deniedLock.status, 0);
      assert.match(deniedLock.stderr, /below patched floor 7\.30\.1/);
      assert.equal(existsSync(boundary.marker), false, entry + ': compiler/executor/network boundary');
      assert.equal(existsSync(boundary.gitMarker), false, entry + ': floor precedes provenance work');
      writeSecurityBaselineFixture(fixture);
      // Unit fault injection of version metadata only; no platform spoofing,
      // provider connection or acceptance fixture runs in this regression.
      writeFileSync(boundary.file, readFileSync(boundary.file, 'utf8') + '\nObject.defineProperty(process.versions, "node", { value: "24.22.0" });\n');
      const deniedRuntime = spawnSync(process.execPath, ['--import', boundary.file, realpathSync(join(fixture, entry)), ...args], { cwd: fixture, encoding: 'utf8', env: variables });
      assert.notEqual(deniedRuntime.status, 0);
      assert.match(deniedRuntime.stderr, /NODE_SECURITY_BASELINE_DENIED/);
      assert.equal(existsSync(boundary.marker), false);
      assert.equal(existsSync(boundary.gitMarker), false);
      for (const path of ['.next', 'apps/web/.next', 'apps/admin/.next', 'public']) assert.equal(existsSync(join(fixture, path)), false);
    } finally { rmSync(fixture, { recursive: true, force: true }); }
  }
});
