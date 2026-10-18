import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as contract from "../../lib/admin/operations/article-schedule-contract";
import { bangkokLocalDateTimeToIso } from "../../cms/sanity/policy/article-scheduling";
import { isPostPublishAdminOriginAllowed } from "../../lib/admin/seo-intelligence/post-publish-origin";

test("schedule POST and DELETE accept verified Hostinger ingress after internal URL rewriting and reject forged origins", async () => {
  const env = { AUTH_URL: "https://admin.ccpun.com", CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin" };
  let owner = true; let cancellations = 0;
  const compiled = ts.transpileModule(readFileSync(new URL("../../lib/admin/article-schedule-handler.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const handlers = {} as typeof import("../../lib/admin/article-schedule-handler");
  new Function("require", "exports", "process", compiled)((id: string) => {
    if (id === "next/server") return { NextResponse: { json: Response.json } };
    if (id === "@/lib/admin/identity") return { getAdminIdentity: async () => owner ? { actorType: "human", role: "owner", actor: "owner@example.invalid" } : null };
    if (id === "@/lib/admin/rbac") return { hasAdminPermission: () => true };
    if (id === "@/lib/admin/environment") return { getAdminEnvironment: () => "production-admin" };
    if (id === "@/lib/admin/seo-intelligence/post-publish-origin") return { isPostPublishAdminOriginAllowed };
    if (id === "@/lib/admin/operations/article-schedule-contract") return contract;
    if (id === "@/cms/sanity/policy/article-scheduling") return { bangkokLocalDateTimeToIso };
    if (id === "@/lib/admin/article-scheduling") return { cancelArticleSchedule: async () => { cancellations++; return null; } };
    throw new Error(`Unexpected schedule dependency ${id}`);
  }, handlers, { env });
  const generation = "11111111-1111-4111-8111-111111111111";
  const headers = { host: "admin.ccpun.com", origin: "https://admin.ccpun.com", "x-forwarded-host": "admin.ccpun.com", "x-forwarded-proto": "https", "content-type": "application/json" };
  const context = () => ({ params: Promise.resolve({ id: "fixture" }) });
  for (const method of ["POST", "DELETE"]) {
    const request = (values: Record<string, string>) => new Request("http://127.0.0.1:3000/api/admin/content/fixture/schedule/", { method, headers: values, body: JSON.stringify(method === "POST" ? { scheduledLocal: "2026-10-20T12:00", draftRevision: "draft-rev", publishedRevision: null, expectedGeneration: null, expectedVersion: 0, requestId: generation } : { expectedGeneration: generation, expectedVersion: 2 }) });
    const invoke = async (values: Record<string, string>) => method === "POST"
      ? handlers.readArticleSchedulePostRequest(request(values), context())
      : handlers.deleteArticleScheduleResponse(request(values), context());
    const accepted = await invoke(headers);
    assert.equal(accepted instanceof Response ? accepted.status : accepted.ok, method === "POST" ? true : 200);
    for (const change of [{ host: "attacker.example" }, { "x-forwarded-host": "attacker.example" }, { "x-forwarded-host": "admin.ccpun.com, attacker.example" }, { "x-forwarded-proto": "http" }, { origin: "https://attacker.example" }, { origin: "" }]) {
      const result = await invoke({ ...headers, ...change });
      const response = result instanceof Response ? result : result.ok ? null : result.response;
      assert.ok(response);
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "invalid-origin" });
    }
    owner = false;
    const forbidden = await invoke(headers);
    const response = forbidden instanceof Response ? forbidden : forbidden.ok ? null : forbidden.response;
    assert.ok(response);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "forbidden" });
    owner = true;
  }
  assert.equal(cancellations, 1);
});
