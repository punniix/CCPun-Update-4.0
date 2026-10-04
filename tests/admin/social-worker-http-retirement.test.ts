import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const { transpileModule, ModuleKind } = createRequire(import.meta.url)("typescript") as typeof import("typescript");
const source = readFileSync(new URL("../../apps/admin/app/api/admin/social/worker/route.ts", import.meta.url), "utf8");
const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;

function handler(env: Record<string, string | undefined>) {
  const loaded = { exports: {} as { GET: (request: Request) => Promise<Response> } };
  runInNewContext(compiled, {
    exports: loaded.exports, module: loaded, process: { env },
    require: (name: string) => {
      // An HTTP worker may use response construction only, never load an executor/provider.
      assert.equal(name, "next/server", "HTTP worker loaded an execution dependency");
      return { NextResponse: { json: Response.json } };
    },
  });
  return loaded.exports.GET;
}

test("retired Social HTTP worker retains missing/invalid cron authentication and no-store contract", async () => {
  for (const [env, authorization, status, error] of [
    [{}, "Bearer FIXTURE_ONLY", 503, "social-worker-not-configured"],
    [{ CRON_SECRET: "FIXTURE_ONLY" }, "", 401, "unauthorized"],
    [{ CRON_SECRET: "FIXTURE_ONLY" }, "Bearer WRONG", 401, "unauthorized"],
  ] as const) {
    const response = await handler(env)(new Request("https://admin.example/api/admin/social/worker/", {
      headers: { authorization },
    }));
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), { error });
  }
});

test("valid stale cron credentials cannot execute on Cloud, Vercel or spoofed VPS HTTP lanes", async () => {
  for (const placement of [
    { CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_BACKGROUND_EXECUTION_PLANE: "cloud" },
    { CCPUN_DEPLOYMENT_PROVIDER: "vercel", VERCEL_ENV: "production" },
    { CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_BACKGROUND_EXECUTION_PLANE: "vps", CCPUN_BACKGROUND_WORKER_ENABLED: "1" },
  ]) {
    for (const environment of ["production-admin", "admin-uat"]) {
      const response = await handler({ ...placement, CCPUN_APP_ENV: environment,
        CRON_SECRET: "FIXTURE_ONLY", CCPUN_SOCIAL_OPERATIONS_ENABLED: "1",
        CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED: "1" })(new Request("https://admin.example/api/admin/social/worker/", {
        headers: { authorization: "Bearer FIXTURE_ONLY" },
      }));
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.deepEqual(await response.json(), { error: "social-worker-unavailable" });
    }
  }
});
