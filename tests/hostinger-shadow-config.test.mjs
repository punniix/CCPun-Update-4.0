import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { buildNextSecurityHeaders } from "../apps/next-security-headers.mjs";
import { blockedRobotsErrors, runParity } from "../scripts/hostinger-seo-parity.mjs";
import { archiveStandaloneRuntime, captureStandaloneProvenance, sealStandaloneProvenance } from "../apps/web/scripts/build-provider.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("shadow app configs keep security headers provider-safe", () => {
  const web = read("apps/web/next.config.ts");
  const admin = read("apps/admin/next.config.ts");
  assert.doesNotMatch(web, /from "\.\.\/next-security-headers\.mjs"/);
  assert.match(web, /function buildNextSecurityHeaders/);
  assert.match(web, /Content-Security-Policy/);
  assert.doesNotMatch(web, /runtime-environment/);
  assert.match(web, /WEB_VERCEL_PROJECT_ID/);
  assert.match(web, /function isWebSanityLaneAllowed/);
  assert.match(admin, /from "\.\.\/next-security-headers\.mjs"/);
  assert.doesNotMatch(web, /\.\.\/\.\.\/lib\/security-policy/);
  assert.doesNotMatch(admin, /\.\.\/\.\.\/lib\/security-policy/);
});

test("shared shadow security policy preserves production HTTPS and review Sanity access", () => {
  const production = buildNextSecurityHeaders({
    isReviewEnvironment: false,
    sanityProjectId: "kyfxgjnq",
    nodeEnv: "production",
    appEnvironment: "production",
  });
  const csp = production.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
  assert.match(csp, /upgrade-insecure-requests/);
  assert.match(csp, /https:\/\/kyfxgjnq\.api\.sanity\.io/);
  assert.ok(production.some((header) => header.key === "Strict-Transport-Security"));
  assert.doesNotMatch(csp, /core\.sanity-cdn\.com/);

  const review = buildNextSecurityHeaders({
    isReviewEnvironment: true,
    sanityProjectId: "ccb9lnw5",
    nodeEnv: "production",
    appEnvironment: "web-uat",
  });
  const reviewCsp = review.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
  assert.match(reviewCsp, /core\.sanity-cdn\.com/);
  assert.match(reviewCsp, /https:\/\/ccb9lnw5\.api\.sanity\.io/);
});

function runReadiness(extraEnv = {}) {
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: "production",
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "web",
    CCPUN_RELEASE_STAGE: "live",
    CCPUN_APP_ENV: "production",
    NEXT_PUBLIC_CCPUN_APP_ENV: "production",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq",
    NEXT_PUBLIC_SANITY_DATASET: "production",
    CCPUN_UAT_MODE: "0",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "1",
    CCPUN_GIT_REF: "v4-production",
    CCPUN_GIT_SHA: "5fc13ac7f18c4200b02d09c4a812869c2c0b57af",
    CCPUN_RELEASE_ID: "hostinger-web-5fc13ac7",
    ...extraEnv,
  };
  return spawnSync(process.execPath, ["scripts/check-hostinger-readiness.mjs"], {
    cwd: new URL("..", import.meta.url),
    env,
    encoding: "utf8",
  });
}

test("Hostinger root build routes both workspaces and preserves native builds and child failures", { skip: process.platform === "win32" }, () => {
  const rootPackage = JSON.parse(read("package.json"));
  assert.equal(rootPackage.scripts.build, "node scripts/build-root.mjs");
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-root-build-"));
  try {
    mkdirSync(join(fixture, "scripts"));
    writeFileSync(join(fixture, "scripts/build-root.mjs"), read("scripts/build-root.mjs"));
    for (const command of ["npm", "next"]) {
      const executable = join(fixture, command);
      writeFileSync(executable, `#!${process.execPath}\nconsole.log(JSON.stringify({ command: ${JSON.stringify(command)}, args: process.argv.slice(2), cwd: process.cwd() })); process.exit(Number(process.env.FIXTURE_EXIT ?? 0));\n`);
      chmodSync(executable, 0o755);
    }
    for (const [provider, role, command, args] of [
      ["hostinger", "web", "npm", ["run", "build", "--workspace", "@ccpun/web"]],
      [" HOSTINGER ", " ADMIN ", "npm", ["run", "build", "--workspace", "@ccpun/admin"]],
      ["vercel", "admin", "next", ["build"]],
      ["local", "web", "next", ["build"]],
      ["", "", "next", ["build"]],
      ["hostinger", "unknown", "next", ["build"]],
    ]) {
      for (const exitCode of [0, 7]) {
        const result = spawnSync(process.execPath, [join(fixture, "scripts/build-root.mjs")], {
          cwd: tmpdir(), encoding: "utf8",
          env: { PATH: fixture, CCPUN_DEPLOYMENT_PROVIDER: provider, CCPUN_DEPLOYMENT_ROLE: role, FIXTURE_EXIT: String(exitCode) },
        });
        assert.equal(result.status, exitCode, result.stderr);
        const invocation = JSON.parse(result.stdout.trim().split("\n").at(-1));
        assert.deepEqual({ command: invocation.command, args: invocation.args }, { command, args });
        assert.equal(invocation.cwd, realpathSync(fixture));
      }
    }
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test("Hostinger Web readiness accepts only the explicit live production identity", () => {
  const ok = runReadiness();
  assert.equal(ok.status, 0, ok.stderr || ok.stdout);
  assert.match(ok.stdout, /"status": "ready"/);
  assert.match(ok.stdout, /"releaseStage": "live"/);
  assert.match(ok.stdout, /"gitRef": "v4-production"/);

  const fakeVercel = runReadiness({ VERCEL_PROJECT_ID: "prj_fake" });
  assert.notEqual(fakeVercel.status, 0);
  assert.match(fakeVercel.stdout, /VERCEL_PROJECT_ID must be unset/);

  for (const [key, value] of [
    ["CCPUN_UAT_MODE", "1"],
    ["CCPUN_ENABLE_PRODUCTION_ANALYTICS", "0"],
    ["CCPUN_GIT_REF", "wrong-branch"],
    ["CCPUN_GIT_SHA", ""],
    ["CCPUN_RELEASE_ID", ""],
  ]) {
    const result = runReadiness({ [key]: value });
    assert.notEqual(result.status, 0, `${key} must block an uncertified live release`);
  }
});

test("Hostinger production candidate uses Production Sanity while remaining noindex and analytics-off", () => {
  const candidate = runReadiness({
    CCPUN_RELEASE_STAGE: "candidate",
    CCPUN_UAT_MODE: "1",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
    CCPUN_GIT_REF: "prep/hostinger-migration-readiness-20260929",
    CCPUN_GIT_SHA: "candidate-sha",
    CCPUN_RELEASE_ID: "hostinger-candidate-candidate-sha",
  });
  assert.equal(candidate.status, 0, candidate.stderr || candidate.stdout);
  assert.match(candidate.stdout, /"releaseStage": "candidate"/);

  const indexableCandidate = runReadiness({
    CCPUN_RELEASE_STAGE: "candidate",
    CCPUN_UAT_MODE: "0",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
    CCPUN_GIT_REF: "prep/hostinger-migration-readiness-20260929",
  });
  assert.notEqual(indexableCandidate.status, 0);
  assert.match(indexableCandidate.stdout, /CCPUN_UAT_MODE=.*expected.*1/);

  const trackedCandidate = runReadiness({
    CCPUN_RELEASE_STAGE: "candidate",
    CCPUN_UAT_MODE: "1",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "1",
    CCPUN_GIT_REF: "prep/hostinger-migration-readiness-20260929",
  });
  assert.notEqual(trackedCandidate.status, 0);
  assert.match(trackedCandidate.stdout, /CCPUN_ENABLE_PRODUCTION_ANALYTICS=.*expected.*0/);
});

test("Hostinger Web readiness accepts the explicit Shadow UAT identity and rejects an indexable UAT mode", () => {
  const uat = runReadiness({
    CCPUN_RELEASE_STAGE: "shadow",
    CCPUN_APP_ENV: "web-uat",
    NEXT_PUBLIC_CCPUN_APP_ENV: "web-uat",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5",
    NEXT_PUBLIC_SANITY_DATASET: "uat",
    CCPUN_UAT_MODE: "1",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
    CCPUN_GIT_REF: "",
    CCPUN_GIT_SHA: "",
    CCPUN_RELEASE_ID: "",
  });
  assert.equal(uat.status, 0, uat.stderr || uat.stdout);
  assert.match(uat.stdout, /"status": "ready"/);

  const unsafeUat = runReadiness({
    CCPUN_RELEASE_STAGE: "shadow",
    CCPUN_APP_ENV: "web-uat",
    NEXT_PUBLIC_CCPUN_APP_ENV: "web-uat",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5",
    NEXT_PUBLIC_SANITY_DATASET: "uat",
    CCPUN_UAT_MODE: "0",
    CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
    CCPUN_GIT_REF: "",
    CCPUN_GIT_SHA: "",
    CCPUN_RELEASE_ID: "",
  });
  assert.notEqual(unsafeUat.status, 0);
  assert.match(unsafeUat.stdout, /CCPUN_UAT_MODE=.*expected.*1/);
});

test("Hostinger standalone packaging traces and preserves public assets", () => {
  const buildProvider = read("apps/web/scripts/build-provider.mjs");
  const web = read("apps/web/next.config.ts");
  assert.match(web, /outputFileTracingIncludes/);
  assert.match(web, /"public\/\*\*\/\*"/);
  assert.match(web, /"\.\.\/\.\.\/public\/\*\*\/\*"/);
  assert.match(web, /HOSTINGER_PUBLIC_FALLBACK/);
  assert.match(web, /source: "\/assets\/:path\*"/);
  assert.match(web, /source: "\/llms\.txt"/);
  assert.match(web, /source: "\/\.well-known\/:path\*"/);
  assert.match(buildProvider, /\.next\/static\/ccpun-public/);
  assert.match(buildProvider, /replaceDirectory\(extractedPublic, webPublic\)/);
  assert.match(buildProvider, /"public\/llms\.txt"/);
  assert.match(buildProvider, /"public\/\.well-known\/security\.txt"/);
  assert.match(buildProvider, /"public\/favicon\.ico"/);
  assert.match(buildProvider, /"\.next\/static\/ccpun-public\/llms\.txt"/);
  assert.match(buildProvider, /"\.next\/static\/ccpun-public\/\.well-known\/security\.txt"/);
});

test("Hostinger parity gate keeps mode boundaries and fails closed on missing runtime or incorrectly grouped robots", async () => {
  const unavailable = async () => new Response("missing", { status: 404 });
  for (const targetMode of ["shadow", "candidate", "production"]) {
    const result = await runParity({ source: "https://source.example", target: "https://target.example", targetMode, fetcher: unavailable });
    assert.equal(result.blockedTarget, targetMode !== "production");
    assert.equal(result.fullContentParity, targetMode !== "shadow");
    assert.equal(result.status, "blocked");
    assert.ok(result.failures.length > 0);
  }
  await assert.rejects(() => runParity({ source: "https://source.example", target: "https://target.example", targetMode: "unknown", fetcher: unavailable }), /invalid mode/);
  assert.deepEqual(blockedRobotsErrors("User-agent: *\nDisallow: /\n"), []);
  assert.ok(blockedRobotsErrors("User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nAllow: /\n").length > 0);
});

function artifactFixture(t) {
  const repository = mkdtempSync(join(tmpdir(), "ccpun-artifact-fixture-"));
  const output = mkdtempSync(join(tmpdir(), "ccpun-artifact-output-"));
  t.after(() => { rmSync(repository, { recursive: true, force: true }); rmSync(output, { recursive: true, force: true }); });
  const root = join(repository, "apps/web");
  const runtime = join(root, ".next/standalone");
  const write = (path, content = "fixture") => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); };
  mkdirSync(root, { recursive: true });
  write(join(repository, ".gitignore"), ".next/\n");
  write(join(repository, "package-lock.json"), '{"lockfileVersion":3}\n');
  const git = (args) => { const result = spawnSync("git", args, { cwd: repository, encoding: "utf8" }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
  git(["init", "--initial-branch=fixture"]);
  git(["add", "."]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "Fixture"]);
  const variables = { CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "web", CCPUN_RELEASE_STAGE: "shadow", CCPUN_APP_ENV: "web-uat", NEXT_PUBLIC_CCPUN_APP_ENV: "web-uat", NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5", NEXT_PUBLIC_SANITY_DATASET: "uat", CCPUN_UAT_MODE: "1", CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0", CCPUN_GIT_REF: "fixture", CCPUN_GIT_SHA: git(["rev-parse", "HEAD"]), UNRELATED_PRIVATE_SETTING: "fixture-not-for-manifest" };
  for (const file of [".next/BUILD_ID", ".next/static/bootstrap.js", "public/llms.txt", "public/favicon.ico"]) write(join(runtime, file));
  write(join(runtime, "node_modules/next/package.json"), '{"name":"next"}');
  write(join(runtime, "server.js"), 'console.log("restored-launch-ok")');
  return { repository, root, runtime, output, variables, write, git, seal: () => sealStandaloneProvenance(captureStandaloneProvenance(root, variables), root) };
}

test("native UAT artifact extracts with launch inputs, relative workspace links, and verified archive digest", (t) => {
  const f = artifactFixture(t);
  symlinkSync("next", join(f.runtime, "node_modules/workspace-link"));
  f.seal();
  const result = archiveStandaloneRuntime(f.output, f.root);
  assert.equal(result.digest, createHash("sha256").update(readFileSync(result.archive)).digest("hex"));
  const restored = join(f.output, "restored");
  mkdirSync(restored);
  const extraction = spawnSync("tar", ["-xzf", result.archive, "-C", restored]);
  assert.equal(extraction.status, 0);
  assert.ok(existsSync(join(restored, ".next/BUILD_ID")));
  assert.ok(existsSync(join(restored, "public/llms.txt")));
  assert.ok(lstatSync(join(restored, "node_modules/workspace-link")).isSymbolicLink());
  const launch = spawnSync(process.execPath, ["server.js"], { cwd: restored, encoding: "utf8" });
  assert.equal(launch.status, 0);
  assert.match(launch.stdout, /restored-launch-ok/);
  assert.doesNotMatch(readFileSync(join(restored, "ccpun-build-provenance.json"), "utf8"), /UNRELATED_PRIVATE_SETTING|fixture-not-for-manifest/);
  assert.throws(() => archiveStandaloneRuntime(f.output, f.root), /already exists/);
});

test("artifact source provenance denies fake SHA/ref, dirty source, wrong lane, and stale commits", (t) => {
  const f = artifactFixture(t);
  assert.throws(() => captureStandaloneProvenance(f.root, { ...f.variables, CCPUN_GIT_SHA: "0".repeat(40) }), /SHA/);
  assert.throws(() => captureStandaloneProvenance(f.root, { ...f.variables, CCPUN_GIT_REF: "v4-production" }), /ref/);
  assert.throws(() => captureStandaloneProvenance(f.root, { ...f.variables, CCPUN_UAT_MODE: "0" }), /UAT contract/);
  f.seal();
  f.write(join(f.repository, "package-lock.json"), '{"lockfileVersion":3,"changed":true}');
  assert.throws(() => archiveStandaloneRuntime(f.output, f.root), /clean source/);
  f.git(["add", "package-lock.json"]);
  f.git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "Changed fixture"]);
  assert.throws(() => archiveStandaloneRuntime(f.output, f.root), /stale/);
});

test("artifact denies changed runtime bytes and unsupported provenance fields", (t) => {
  const f = artifactFixture(t);
  f.seal();
  f.write(join(f.runtime, "public/llms.txt"), "changed-bytes");
  assert.throws(() => archiveStandaloneRuntime(f.output, f.root), /digest mismatch/);
  const path = join(f.runtime, "ccpun-build-provenance.json");
  const provenance = JSON.parse(readFileSync(path, "utf8"));
  f.write(path, JSON.stringify({ ...provenance, unexpectedSetting: "fixture" }));
  assert.throws(() => archiveStandaloneRuntime(f.output, f.root), /Unsupported artifact provenance/);
});

test("artifact rejects escaping links and forbidden config filenames before creating an archive", async (t) => {
  for (const kind of ["escape-link", "absolute-link", "dangling-link", ".env.fixture", "auth-fixture.json", "private-secret.json", ".npmrc", "credentials"]) {
    await t.test(kind, (t) => {
      const f = artifactFixture(t);
      if (kind === "escape-link") symlinkSync("../../../../package-lock.json", join(f.runtime, "outside"));
      else if (kind === "absolute-link") symlinkSync(join(f.runtime, "server.js"), join(f.runtime, "absolute"));
      else if (kind === "dangling-link") symlinkSync("missing", join(f.runtime, "dangling"));
      else f.write(join(f.runtime, kind));
      assert.throws(() => f.seal(), /escapes|relocatable|Forbidden|unresolved/);
      assert.deepEqual(readdirSync(f.output), []);
    });
  }
});

test("artifact preflight rejects local environment files without opening them", (t) => {
  const f = artifactFixture(t);
  f.write(join(f.root, ".env.fixture"));
  assert.throws(() => captureStandaloneProvenance(f.root, f.variables), /local environment files/);
});

test("artifact refuses missing provenance and incomplete standalone launch shape", (t) => {
  const f = artifactFixture(t);
  assert.throws(() => archiveStandaloneRuntime(f.output, f.root), /Missing same-build/);
  rmSync(join(f.runtime, ".next/BUILD_ID"));
  f.seal();
  assert.throws(() => archiveStandaloneRuntime(f.output, f.root), /launch input/);
});

test("artifact output cannot alias back into the runtime being archived", (t) => {
  const f = artifactFixture(t);
  f.seal();
  const outputLink = join(f.output, "runtime-alias");
  symlinkSync(f.runtime, outputLink);
  assert.throws(() => archiveStandaloneRuntime(outputLink, f.root), /outside the runtime tree/);
  assert.equal(readdirSync(f.runtime).some((name) => name.endsWith(".tar.gz")), false);
});

test("native archive upload is manual opt-in UAT and does not add provider credentials or deployment", () => {
  const workflow = read(".github/workflows/hostinger-migration-readiness.yml");
  assert.match(workflow, /export_web_uat_artifact:[\s\S]*?type: boolean[\s\S]*?default: false/);
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch' && inputs\.export_web_uat_artifact/g);
  assert.match(workflow, /--archive-standalone \/tmp\/ccpun-native-web-artifact/);
  assert.match(workflow, /actions\/upload-artifact@v7\.0\.1/);
  assert.match(workflow, /if-no-files-found: error/);
  assert.doesNotMatch(workflow, /secrets\.|ssh |scp |hostinger.*deploy|VERCEL_TOKEN/);
});
