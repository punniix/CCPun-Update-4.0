import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const { transpileModule, ModuleKind } = createRequire(import.meta.url)("typescript") as typeof import("typescript");
const source = readFileSync(new URL("../../apps/admin/app/api/internal/line/rich-menu/reconcile/route.ts", import.meta.url), "utf8");
const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;

function handler(env: Record<string, string | undefined>) {
  const loaded = { exports: {} as { GET: (request: Request) => Promise<Response> } };
  runInNewContext(compiled, {
    exports: loaded.exports,
    module: loaded,
    process: { env },
    require: (name: string) => {
      assert.equal(name, "next/server", "retired HTTP reconciler loaded an execution dependency");
      return { NextResponse: { json: Response.json } };
    },
  });
  return loaded.exports.GET;
}

test("retired LINE rich-menu HTTP reconciler keeps auth and never executes provider work", async () => {
  for (const [env, authorization, status, error] of [
    [{}, "Bearer FIXTURE_ONLY", 503, "rich-menu-reconciler-not-configured"],
    [{ CRON_SECRET: "FIXTURE_ONLY" }, "", 401, "unauthorized"],
    [{ CRON_SECRET: "FIXTURE_ONLY" }, "Bearer WRONG", 401, "unauthorized"],
    [{ CRON_SECRET: "FIXTURE_ONLY" }, "Bearer FIXTURE_ONLY", 503, "rich-menu-reconciler-unavailable"],
  ] as const) {
    const response = await handler(env)(new Request("https://admin.example/api/internal/line/rich-menu/reconcile/", {
      headers: { authorization },
    }));
    assert.equal(response.status, status);
    assert.match(response.headers.get("Cache-Control") ?? "", /no-store/);
    assert.deepEqual(await response.json(), { error });
  }
});
