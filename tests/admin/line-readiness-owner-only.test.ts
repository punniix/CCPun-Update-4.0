import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../..");
const source = readFileSync(path.join(root, "apps/admin/app/api/admin/line/readiness/route.ts"), "utf8");

type MockOptions = {
  role: string | null;
  channelSecret: boolean;
  lane: boolean;
  crypto: boolean;
};
function load(options: MockOptions) {
  let laneChecks = 0;
  let cryptoChecks = 0;
  const exports: Record<string, unknown> = {};
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(output, {
    exports,
    process: { env: { LINE_CHANNEL_SECRET: options.channelSecret ? "synthetic-nonsecret" : "" } },
    require: (name: string) => {
      if (name === "next/server") return {
        NextResponse: { json: (body: unknown, opts: unknown) => ({ body, ...(opts as object) }) },
      };
      if (name === "@/lib/admin/identity") return {
        getAdminIdentity: async () => options.role ? { role: options.role } : null,
      };
      if (name === "@/lib/admin/line/private-ingestion") return {
        resolveLineIngestRuntime: () => { laneChecks++; return options.lane ? { opaque: true } : null; },
      };
      if (name === "@/lib/line/private-crypto") return {
        createLinePrivateCrypto: () => { cryptoChecks++; if (!options.crypto) throw Error("SYNTHETIC_PRIVATE_CONFIG_INVALID"); return {}; },
      };
      throw Error("unexpected-import");
    },
  });
  return {
    GET: exports.GET as () => Promise<{ body: unknown; status: number; headers: Record<string, string> }>,
    probes: () => ({ laneChecks, cryptoChecks }),
  };
}

test("LINE readiness never reveals config checks to anonymous or non-owner", async () => {
  for (const [role, status, error] of [
    [null, 401, "unauthorized"], ["editor", 403, "forbidden"],
  ] as const) {
    const fn = load({ role, channelSecret: true, lane: true, crypto: true });
    const value = await fn.GET();
    assert.equal(value.status, status);
    assert.deepEqual(JSON.parse(JSON.stringify(value.body)), { error });
    assert.deepEqual(fn.probes(), { laneChecks: 0, cryptoChecks: 0 });
    assert.match(value.headers["Cache-Control"], /no-store/);
  }
});

test("LINE readiness checks synthetic configuration without outputting source values", async () => {
  for (const channelSecret of [false, true]) {
    for (const lane of [false, true]) {
      for (const crypto of [false, true]) {
        const fn = load({ role: "owner", channelSecret, lane, crypto });
        const value = await fn.GET();
        const ready = channelSecret && lane && crypto;
        assert.equal(value.status, ready ? 200 : 503);
        assert.deepEqual(JSON.parse(JSON.stringify(value.body)), {
          status: ready ? "ready" : "not-ready",
          checks: {
            channelSignatureConfiguration: channelSecret,
            runtimeLane: lane,
            privateCrypto: crypto,
          },
          appliesTo: "line-ingress-configuration-only",
        });
        assert.deepEqual(fn.probes(), { laneChecks: 1, cryptoChecks: 1 });
        assert.equal(JSON.stringify(value).includes("synthetic-nonsecret"), false);
        assert.equal(JSON.stringify(value).includes("SYNTHETIC_PRIVATE_CONFIG_INVALID"), false);
        assert.match(value.headers["Vary"], /Cookie/);
        assert.match(value.headers["X-Robots-Tag"], /noindex/);
      }
    }
  }
});
