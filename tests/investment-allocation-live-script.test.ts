// Self-test for qa/investment-allocation-live.mjs: runs the script against a local
// HTTP server that serves the real route bodies backed by the SEC v2 contract
// fixtures, so the script's own checks and pass/fail/skip accounting are verified
// offline. The live SEC run happens on UAT, not here.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import test from "node:test";
import { InvestmentApiRateLimiter } from "../features/investment-allocation/server/rate-limit";
import { fixtureSec, routeHandler, type Route } from "./fixtures/investment-allocation/harness";

const SCRIPT = resolve(process.cwd(), "qa/investment-allocation-live.mjs");

async function serve(options: { key?: string | null; pageStatus?: number } = {}): Promise<{ server: Server; base: string }> {
  const sec = fixtureSec({ aia: true });
  const limiter = new InvestmentApiRateLimiter();
  const handlers = Object.fromEntries((["amcs", "catalog", "detail", "funds"] as Route[]).map((name) => [name, routeHandler(name, sec, { lane: "web-uat", key: options.key, limiter })]));
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    // Mirror the Hostinger proxy (apps/web/proxy.ts): slashless paths answer a
    // 308 to the trailing-slash URL, which the script must not depend on.
    if (/\/[^/.]+$/.test(url.pathname)) {
      res.writeHead(308, { location: `${url.pathname}/${url.search}` }).end();
      return;
    }
    const api = url.pathname.match(/^\/api\/investment-allocation\/(amcs|catalog|detail|funds)\/$/);
    if (api) {
      const response = await handlers[api[1]](new Request(url, { headers: { "x-forwarded-for": "203.0.113.50" } }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
      return;
    }
    if (url.pathname === "/tools/investment-allocation/") {
      res.writeHead(options.pageStatus ?? 200, { "content-type": "text/html" });
      res.end('<!doctype html><html><head><meta name="robots" content="noindex, nofollow"></head><body></body></html>');
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

function run(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((done) => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: "test", PATH: process.env.PATH ?? "" };
    const child = spawn(process.execPath, [SCRIPT, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("close", (code: number | null) => done({ code, stdout, stderr }));
  });
}

test("live script passes every check against a healthy SEC-backed deployment and reports the skip separately", async () => {
  const { server, base } = await serve();
  try {
    const { code, stdout } = await run(["--base-url", base, "--json"]);
    const report = JSON.parse(stdout);
    const failed = report.results.filter((row: { status: string }) => row.status === "fail");
    assert.deepEqual(failed, []);
    assert.equal(code, 0);
    assert.deepEqual(report.counts, { pass: 14, fail: 0, skip: 1 });
    assert.equal(report.results.find((row: { status: string }) => row.status === "skip").name, "rate limit answers 429 with Retry-After");
    for (const endpoint of ["general-info/amcs", "general-info/profiles", "general-info/specifications", "factsheet/risk-spectrum", "factsheet/asset-allocation", "factsheet/subscription-redemption-periods"]) {
      assert.ok(report.results.some((row: { name: string; status: string }) => row.name.includes(endpoint) && row.status === "pass"), endpoint);
    }
  } finally { server.close(); }
});

test("live script exercises the rate limit only when asked", async () => {
  const { server, base } = await serve();
  try {
    const { code, stdout } = await run(["--base-url", base, "--json", "--check-rate-limit"]);
    const report = JSON.parse(stdout);
    assert.equal(code, 0, stdout);
    assert.deepEqual(report.counts, { pass: 15, fail: 0, skip: 0 });
  } finally { server.close(); }
});

test("live script fails when the deployment serves synthetic or closed data instead of live SEC", async () => {
  const { server, base } = await serve({ key: null, pageStatus: 404 });
  try {
    const { code, stdout } = await run(["--base-url", base, "--json"]);
    const report = JSON.parse(stdout);
    assert.equal(code, 1);
    assert.ok(report.counts.fail >= 3, JSON.stringify(report.counts));
    assert.match(report.results.find((row: { name: string }) => row.name.includes("general-info/amcs")).detail, /uat_synthetic/);
    assert.ok(report.results.filter((row: { status: string }) => row.status === "skip").length >= 5, "detail checks without a live fund are skips, not passes");
  } finally { server.close(); }
});

test("live script refuses Production and unknown hosts before any request", async () => {
  for (const base of ["https://ccpun.com", "https://www.ccpun.com", "https://example.org"]) {
    const { code, stderr, stdout } = await run(["--base-url", base]);
    assert.equal(code, 2, base);
    assert.match(stderr, /Refusing target/);
    assert.equal(stdout, "");
  }
});
