import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";

const root = path.resolve(import.meta.dirname, "../..");
const paths = [
  "apps/admin/app/api/admin/line/inbox/[leadId]/screenshot-ocr/route.ts",
  "apps/admin/app/api/admin/line/inbox/[leadId]/screenshot-ocr/confirm/route.ts",
] as const;
const validLead = "a1000000-0000-4000-8000-000000000001";

type Identity = { role: string } | null;
type ResponseResult = { body: { error: string }; status: number; headers: Record<string, string> };
type Route = (request: unknown, context: { params: Promise<{ leadId: string }> }) => Promise<ResponseResult>;

function loadRoute(routePath: string, options: { identity: Identity; validOrigin: boolean; enabled: boolean }) {
  const source = readFileSync(path.join(root, routePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: { POST?: Route } = {};
  runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      if (name === "next/server") return {
        NextResponse: { json: (body: ResponseResult["body"], opts: { status?: number; headers?: Record<string, string> }) => ({
          body, status: opts?.status ?? 200, headers: opts?.headers ?? {},
        }) },
      };
      if (name === "zod") return { z };
      if (name === "@/lib/admin/identity") return { getAdminIdentity: async () => options.identity };
      if (name === "@/lib/admin/rbac") return { hasAdminPermission: () => true };
      if (name === "@/lib/admin/auth-config") return { isSameOriginAdminMutation: () => options.validOrigin };
      throw new Error("unexpected module dependency");
    },
    process: { env: { CCPUN_CHAT_OCR_ENABLED: options.enabled ? "true" : "false" } },
  });
  assert.equal(typeof exports.POST, "function");
  return exports.POST!;
}

test("Upload and confirmation remain closed before any private body read, network or write", async () => {
  for (const routePath of paths) {
    for (const enabled of [false, true]) {
      let bodyReads = 0;
      const request = {
        url: "https://admin-test.ccpun.com/private/synthetic",
        headers: { get: () => "https://admin-test.ccpun.com" },
        formData: async () => { bodyReads++; throw new Error("body must not be read"); },
        text: async () => { bodyReads++; throw new Error("body must not be read"); },
        json: async () => { bodyReads++; throw new Error("body must not be read"); },
      };
      const route = loadRoute(routePath, { identity: { role: "owner" }, validOrigin: true, enabled });
      const result = await route(request, { params: Promise.resolve({ leadId: validLead }) });
      assert.equal(result.status, 503, routePath);
      assert.equal(result.body.error, enabled
        ? (routePath.endsWith("/confirm/route.ts")
          ? "chat-ocr-proposal-verification-required"
          : "chat-ocr-private-gateway-required")
        : "chat-ocr-disabled");
      assert.equal(bodyReads, 0);
      assert.match(result.headers["Cache-Control"], /no-store/);
    }
  }
});

test("Both private OCR routes reject anonymous, non-owner, invalid origin and invalid lead", async () => {
  for (const routePath of paths) {
    for (const scenario of [
      { identity: null, validOrigin: true, lead: validLead, expected: 401, error: "unauthorized" },
      { identity: { role: "editor" }, validOrigin: true, lead: validLead, expected: 403, error: "forbidden" },
      { identity: { role: "owner" }, validOrigin: false, lead: validLead, expected: 403, error: "invalid-origin" },
      { identity: { role: "owner" }, validOrigin: true, lead: "not-a-uuid", expected: 400, error: "invalid-lead" },
    ]) {
      const route = loadRoute(routePath, {
        identity: scenario.identity, validOrigin: scenario.validOrigin, enabled: true,
      });
      const result = await route({
        url: "https://admin-test.ccpun.com/private/synthetic",
        headers: { get: () => "https://admin-test.ccpun.com" },
      }, { params: Promise.resolve({ leadId: scenario.lead }) });
      assert.equal(result.status, scenario.expected);
      assert.equal(result.body.error, scenario.error);
    }
  }
});
