import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const workflow = JSON.parse(readFileSync(new URL("../../workers/local-ai/n8n/operations-monitor-uat-safe-canary.json", import.meta.url), "utf8"));
test("P1 UAT monitor template is inert, does not call production, and rejects upstream 401", () => {
  assert.equal(workflow.active, false);
  assert.equal(workflow.settings.saveDataSuccessExecution, "none");
  assert.equal(workflow.settings.saveDataErrorExecution, "none");
  assert.equal(workflow.nodes.find((n: {name:string}) => n.name === "Every 5 Minutes")?.disabled, true);
  for (const node of workflow.nodes.filter((n: {type:string}) => n.type.endsWith("httpRequest"))) assert.equal(node.disabled, true);
  const assess = workflow.nodes.find((n: {name:string}) => n.name === "Assess Operations Health")?.parameters.jsCode;
  assert.match(assess, /statusCode === 401/);
  assert.match(assess, /upstream-unauthorized/);
  assert.match(assess, /outcome: unauthorized \? 'failed'/);
});
