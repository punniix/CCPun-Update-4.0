import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { derivePinnedHostingerWebUatGitMetadata, stageStandaloneRuntime } from "../apps/web/scripts/build-provider.mjs";

test("repeated standalone staging materializes public symlinks into an independently publishable runtime", () => {
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-hostinger-package-"));
  const web = join(fixture, "apps/web");
  const standalone = join(web, ".next/standalone");
  const nested = join(standalone, "apps/web");
  const put = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };
  try {
    for (const path of ["llms.txt", ".well-known/security.txt", "favicon.ico", "assets/hero.png"]) put(join(fixture, "public", path), path);
    mkdirSync(web, { recursive: true });
    symlinkSync("../../public", join(web, "public"));
    put(join(nested, "server.js"), "server");
    put(join(nested, "package.json"), "{}");
    put(join(nested, ".next/BUILD_ID"), "build");
    put(join(standalone, "node_modules/next/package.json"), "{}");
    put(join(web, ".next/static/chunk.js"), "chunk");
    // Reproduces a restored provider tree whose published public paths were symlinks.
    symlinkSync(join(fixture, "public"), join(nested, "public"));
    symlinkSync(join(fixture, "public"), join(standalone, "public"));
    stageStandaloneRuntime(web);
    stageStandaloneRuntime(web);
    assert.equal(lstatSync(join(standalone, "public")).isDirectory(), true);
    assert.equal(lstatSync(join(nested, "public")).isDirectory(), true);
    assert.equal(readFileSync(join(standalone, ".next/static/ccpun-public/assets/hero.png"), "utf8"), "assets/hero.png");
    rmSync(join(fixture, "public"), { recursive: true });
    assert.equal(readFileSync(join(standalone, "public/assets/hero.png"), "utf8"), "assets/hero.png");
    assert.equal(existsSync(join(standalone, ".next/static/chunk.js")), true);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test("immutable Web UAT checkout derives six Git fields and seals only those fields over stale runtime values", () => {
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-web-pinned-git-"));
  const web = join(fixture, "apps/web");
  const put = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: fixture, encoding: "utf8" });
    assert.equal(result.status, 0, "synthetic Git fixture must succeed");
    return result.stdout.trim();
  };
  const variables = {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "web", CCPUN_RELEASE_STAGE: "shadow",
    CCPUN_APP_ENV: "web-uat", NEXT_PUBLIC_CCPUN_APP_ENV: "web-uat", NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5",
    NEXT_PUBLIC_SANITY_DATASET: "uat", CCPUN_UAT_MODE: "1", CCPUN_ENABLE_PRODUCTION_ANALYTICS: "0",
    CCPUN_GIT_REF: "stale-ref", CCPUN_GIT_SHA: "stale-sha", CCPUN_RELEASE_ID: "stale-release",
    NEXT_PUBLIC_CCPUN_GIT_REF: "stale-public-ref", NEXT_PUBLIC_CCPUN_GIT_SHA: "stale-public-sha", NEXT_PUBLIC_CCPUN_RELEASE_ID: "stale-public-release",
    CCPUN_PRIVATE_SECRET: "synthetic-private-value", CCPUN_INVESTMENT_ALLOCATION_ENABLED: "1",
  };
  try {
    mkdirSync(web, { recursive: true });
    assert.equal(derivePinnedHostingerWebUatGitMetadata(web, variables), null, "ordinary source without Git retains the existing manual contract");
    assert.throws(() => derivePinnedHostingerWebUatGitMetadata(web, { ...variables, CCPUN_GIT_REF: `codex/hostinger-release-uat-${"a".repeat(40)}` }), /attached Git checkout/);
    put(join(fixture, ".gitignore"), "apps/web/.next/\n");
    put(join(fixture, "package-lock.json"), "{}");
    put(join(fixture, "package.json"), "{}");
    put(join(fixture, "tracked-public.txt"), "synthetic original");
    for (const path of ["llms.txt", ".well-known/security.txt", "favicon.ico"]) put(join(web, "public", path), path);
    git("init", "-q"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
    git("add", "."); git("commit", "-qm", "synthetic source");
    const sha = git("rev-parse", "HEAD");
    git("checkout", "-qb", `codex/hostinger-release-uat-${sha}`);
    const seal = derivePinnedHostingerWebUatGitMetadata(web, variables);
    const expected = { CCPUN_GIT_REF: `codex/hostinger-release-uat-${sha}`, CCPUN_GIT_SHA: sha, CCPUN_RELEASE_ID: `hostinger-web-uat-${sha.slice(0, 12)}` };
    assert.deepEqual(seal, { ...expected, ...Object.fromEntries(Object.entries(expected).map(([key, value]) => [`NEXT_PUBLIC_${key}`, value])) });
    assert.equal(variables.CCPUN_GIT_SHA, "stale-sha", "derivation must not mutate caller configuration");
    for (const [key, value] of [["NEXT_PUBLIC_SANITY_PROJECT_ID", "kyfxgjnq"], ["CCPUN_ENABLE_PRODUCTION_ANALYTICS", "1"], ["CCPUN_UAT_MODE", "0"], ["CCPUN_RELEASE_STAGE", "live"], ["NEXT_PUBLIC_CCPUN_APP_ENV", "production"]]) {
      assert.throws(() => derivePinnedHostingerWebUatGitMetadata(web, { ...variables, [key]: value }), /isolated lane contract/);
    }
    put(join(fixture, "package-lock.json"), "changed");
    assert.throws(() => derivePinnedHostingerWebUatGitMetadata(web, variables), /clean source checkout/);
    put(join(fixture, "package.json"), "changed manifest");
    put(join(fixture, "tracked-public.txt"), "changed public fixture");
    put(join(web, "node_modules/synthetic-package/index.js"), "synthetic dependency");
    const privateName = "private-customer-token-SYNTHETIC-NAME.txt";
    const privateValue = "SYNTHETIC-SECRET-CONTENT-NEVER-LOG";
    put(join(fixture, privateName), privateValue);
    assert.throws(() => derivePinnedHostingerWebUatGitMetadata(web, variables), (error) => {
      assert.equal(error.message, 'Artifact requires a clean source checkout. {"trackedManifestChanged":true,"trackedLockChanged":true,"otherTrackedCount":1,"untrackedNestedNodeModulesCount":1,"otherUntrackedCount":1}');
      assert.doesNotMatch(error.stack, /private-customer-token|SYNTHETIC-NAME|SYNTHETIC-SECRET-CONTENT|tracked-public|synthetic-package|package-lock\.json/);
      return true;
    });
    rmSync(join(web, "node_modules"), { recursive: true });
    rmSync(join(fixture, privateName));
    git("checkout", "--", "package.json", "tracked-public.txt");
    git("checkout", "--", "package-lock.json");
    git("checkout", "-qb", `codex/hostinger-release-uat-${"f".repeat(40)}`);
    assert.throws(() => derivePinnedHostingerWebUatGitMetadata(web, variables), /does not match checkout SHA/);
    git("checkout", "--detach", "-q", sha);
    assert.equal(derivePinnedHostingerWebUatGitMetadata(web, variables), null, "ordinary detached CI/feature source retains the existing guard");
    assert.throws(() => derivePinnedHostingerWebUatGitMetadata(web, { ...variables, CCPUN_GIT_REF: expected.CCPUN_GIT_REF }), /attached Git checkout/);
    git("checkout", "-qb", "manual-uat");
    assert.equal(derivePinnedHostingerWebUatGitMetadata(web, variables), null);
    assert.equal(derivePinnedHostingerWebUatGitMetadata(web, { ...variables, CCPUN_APP_ENV: "production" }), null);
    git("checkout", "-q", expected.CCPUN_GIT_REF);
    const standalone = join(web, ".next/standalone");
    put(join(standalone, "server.js"), "");
    put(join(standalone, "node_modules/next/package.json"), "{}");
    put(join(standalone, ".next/BUILD_ID"), "build");
    put(join(web, ".next/static/chunk.js"), "chunk");
    stageStandaloneRuntime(web, { ...variables, ...seal }, seal);
    const server = readFileSync(join(standalone, "server.js"), "utf8");
    const runtimeEnv = { ...variables, AUTH_SECRET: "synthetic-auth", NEXT_PUBLIC_SANITY_DATASET: "protected-existing" };
    runInNewContext(server, { process: { env: runtimeEnv } });
    for (const [key, value] of Object.entries(seal)) assert.equal(runtimeEnv[key], value, key);
    for (const [key, value] of Object.entries(variables).filter(([key]) => !Object.hasOwn(seal, key))) assert.equal(runtimeEnv[key], key === "NEXT_PUBLIC_SANITY_DATASET" ? "protected-existing" : value, key);
    assert.equal(runtimeEnv.AUTH_SECRET, "synthetic-auth");
    assert.doesNotMatch(server, /synthetic-private-value|CCPUN_PRIVATE_SECRET|CCPUN_INVESTMENT_ALLOCATION_ENABLED|AUTH_SECRET/);
    assert.throws(() => stageStandaloneRuntime(web, variables, { ...seal, AUTH_SECRET: "must-not-serialize" }), /Invalid pinned Web UAT Git metadata seal/);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});


test("standalone Web runtime carries only the safe Hostinger lane identity it was built with", () => {
  const fixture = mkdtempSync(join(tmpdir(), "ccpun-hostinger-runtime-env-"));
  const web = join(fixture, "apps/web");
  const standalone = join(web, ".next/standalone");
  const nested = join(standalone, "apps/web");
  const put = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };
  try {
    for (const path of ["llms.txt", ".well-known/security.txt", "favicon.ico"]) put(join(fixture, "public", path), path);
    mkdirSync(web, { recursive: true });
    symlinkSync("../../public", join(web, "public"));
    put(join(nested, "server.js"), "console.log(process.env.CCPUN_APP_ENV);\n");
    put(join(nested, "package.json"), "{}");
    put(join(nested, ".next/BUILD_ID"), "build");
    put(join(standalone, "node_modules/next/package.json"), "{}");
    put(join(web, ".next/static/chunk.js"), "chunk");

    stageStandaloneRuntime(web, {
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
      CCPUN_GIT_SHA: "a".repeat(40),
      CCPUN_RELEASE_ID: "hostinger-web-prod-aaaaaaaaaaaa",
      CCPUN_PRIVATE_SECRET: "must-not-ship",
    });

    const server = readFileSync(join(standalone, "server.js"), "utf8");
    assert.match(server, /CCPUN_RUNTIME_ENV_BOOTSTRAP/);
    assert.match(server, /CCPUN_APP_ENV.*production/);
    assert.match(server, /NEXT_PUBLIC_SANITY_PROJECT_ID.*kyfxgjnq/);
    assert.match(server, /CCPUN_ENABLE_PRODUCTION_ANALYTICS.*1/);
    assert.doesNotMatch(server, /CCPUN_PRIVATE_SECRET|must-not-ship/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
