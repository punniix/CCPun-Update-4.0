import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type Named = { name: string; type: string; parameters: { jsonBody?: unknown } };

// Parsed n8n source JSON stays loosely typed, as in the other workflow contract tests.
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const relay = read("workers/local-ai/n8n/google-read-only-relay.direct.json");
const owner = read("workers/local-ai/n8n/owner-export-google-sheet.direct.json");
const node = (workflow: { nodes: Named[] }, name: string) => {
  const found = workflow.nodes.find((item) => item.name === name);
  assert.ok(found, `missing node ${name}`);
  return found as ReturnType<typeof read>;
};

test("relay sub-workflow takes three declared inputs and keeps Admin as the planner and validator", () => {
  assert.equal(relay.active, false);
  assert.deepEqual(node(relay, "Relay · Start").parameters.workflowInputs.values.map((value: { name: string }) => value.name), ["endpoint", "source", "lookbackDays"]);
  const admin = node(relay, "Relay · Admin");
  assert.match(admin.parameters.url, /\/api\/internal\/marketing\/refresh\//);
  assert.match(admin.parameters.url, /\/api\/internal\/analytics\/daily\//);
  assert.deepEqual(Object.keys(admin.credentials ?? {}), ["httpHeaderAuth"]);
  assert.match(String(node(relay, "Relay · Build body").parameters.jsCode), /RELAY_INVALID_JOB/);
  assert.match(node(relay, "Relay · ต้องดึงเพิ่ม?").parameters.conditions.conditions[0].leftValue, /round < 5/);
});

test("relay fetches Google only with n8n's own read-only credentials and never throws on provider status", () => {
  for (const [name, credential] of [["Google · GSC", "googleOAuth2Api"], ["Google · GA4", "googleAnalyticsOAuth2"]] as const) {
    const google = node(relay, name);
    assert.equal(google.type, "n8n-nodes-base.httpRequest");
    assert.equal(google.parameters.authentication, "predefinedCredentialType");
    assert.equal(google.parameters.nodeCredentialType, credential);
    assert.deepEqual(Object.keys(google.credentials ?? {}), [credential]);
    assert.equal(google.parameters.url, "={{ $json.url }}");
    assert.equal(google.parameters.options.response.response.neverError, true);
    assert.equal(google.parameters.options.response.response.fullResponse, true);
  }
  // Provider rows never leave the sub-workflow: the caller only receives Admin's verdict.
  assert.match(String(node(relay, "Relay · ผลลัพธ์").parameters.jsCode), /\$\('Relay · Admin'\)\.last\(\)\.json/);
});

test("source-controlled n8n workflows carry credential references only, never secrets", () => {
  for (const workflow of [relay, owner]) {
    const text = JSON.stringify(workflow);
    assert.doesNotMatch(text, /Bearer\s+[A-Za-z0-9._-]{12,}|"(?:accessToken|refreshToken|clientSecret|password)"\s*:/);
  }
  assert.equal(relay.settings.saveDataSuccessExecution, "none");
  assert.equal(relay.settings.saveDataErrorExecution, "none");
});

test("Owner Export collects GSC and GA4 through the native Execute Workflow relay; Meta stays on Admin", () => {
  const expected: Record<string, { endpoint: string; source: string }> = {
    "Daily · GSC": { endpoint: "daily", source: "gsc" },
    "Daily · GA4": { endpoint: "daily", source: "ga4" },
    "Marketing Daily · GSC 7 วัน": { endpoint: "marketing", source: "gsc" },
    "Marketing Daily · GA4 7 วัน": { endpoint: "marketing", source: "ga4" },
  };
  for (const [name, inputs] of Object.entries(expected)) {
    const call = node(owner, name);
    assert.equal(call.type, "n8n-nodes-base.executeWorkflow");
    assert.equal(call.parameters.workflowId.value, "pcDVd2P6ipg8b6p4");
    assert.deepEqual(call.parameters.workflowInputs.value, { ...inputs, lookbackDays: 7 });
    assert.equal(call.parameters.options.waitForSubWorkflow, true);
    assert.equal(call.onError, "continueRegularOutput");
  }
  assert.equal(owner.connections["Daily · เก็บข้อมูล 06:00"].main[0][0].node, "Daily · GSC");
  assert.equal(owner.connections["Daily · GSC"].main[0][0].node, "Daily · GA4");
  assert.equal(owner.connections["Daily · GA4"].main[0][0].node, "Daily · META");
  const meta = node(owner, "Daily · META");
  assert.equal(meta.type, "n8n-nodes-base.httpRequest");
  assert.deepEqual(JSON.parse(meta.parameters.jsonBody), { source: "meta" });
  assert.equal(owner.nodes.filter((item: Named) => item.type === "n8n-nodes-base.httpRequest" && /"source":"(?:gsc|ga4)"/.test(String(item.parameters.jsonBody ?? ""))).length, 0);
});
