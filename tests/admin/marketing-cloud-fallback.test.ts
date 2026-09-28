import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import test from "node:test";
import { z } from "zod";
import { MARKETING_ANALYSIS_INSTRUCTION, buildMarketingInferenceRequest, marketingAnalysisInputSchema, marketingInterpretationSelectionSchema, marketingSnapshotSchema } from "../../lib/local-ai/contracts";
const directory=mkdtempSync(join(tmpdir(),"marketing-cloud-test-")),stub=join(directory,"stub.cjs");writeFileSync(stub,"module.exports={};");registerHooks({resolve(specifier,context,next){return specifier==="server-only"?{url:pathToFileURL(stub).href,shortCircuit:true}:next(specifier,context);}});

test("OpenAI native node receives a bounded strict schema while the database keeps one cloud attempt", async () => {
  const {MARKETING_CLOUD_MIGRATION_CHECKSUM,MARKETING_CLOUD_PROMPT_MIGRATION_CHECKSUM,MARKETING_CLOUD_PROMPT_VERSION,marketingOpenAiStrictSchema,buildMarketingCloudRequest}=await import("../../lib/admin/marketing/analysis");
  const schema = marketingOpenAiStrictSchema(z.toJSONSchema(marketingInterpretationSelectionSchema)) as Record<string, unknown>;
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const object = node as Record<string, unknown>;
    for (const key of ["$schema", "minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum", "pattern", "format", "default", "const"]) assert.equal(key in object, false, key);
    if (object.type === "object") {
      assert.equal(object.additionalProperties, false);
      assert.deepEqual(object.required, Object.keys(object.properties as object));
    }
    Object.values(object).forEach(visit);
  };
  visit(schema);
  const sql = readFileSync("db/migrations/20260928_marketing_cloud_fallback_v1.sql", "utf8");
  const body = sql.split("-- checksum-source-begin\n")[1]!.split("-- checksum-source-end")[0]!;
  assert.equal(MARKETING_CLOUD_MIGRATION_CHECKSUM, `sha256:${createHash("sha256").update(body).digest("hex")}`);
  assert.match(sql, /analysis_id uuid PRIMARY KEY/);
  assert.match(sql, /model text NOT NULL DEFAULT 'gpt-6-luna'/);
  assert.match(sql, /CREATE TRIGGER marketing_cloud_block_local_enqueue/);
  assert.match(sql, /j\.status NOT IN\('failed','cancelled','expired','reconciliation-required'\)/);
  assert.match(sql, /a\.created_at>now\(\)-interval '10 minutes'/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION ccpun_admin\.admin_read_marketing_analysis/);
  const promptSql=readFileSync("db/migrations/20260928_marketing_cloud_prompt_v2.sql","utf8");
  const promptBody=promptSql.split("-- checksum-source-begin\n")[1]!.split("-- checksum-source-end")[0]!;
  assert.equal(MARKETING_CLOUD_PROMPT_MIGRATION_CHECKSUM,`sha256:${createHash("sha256").update(promptBody).digest("hex")}`);
  assert.match(promptSql,/cloud_prompt_digest text/);
  assert.match(promptSql,/status<>'ready' OR cloud_prompt_digest IS NOT NULL/);
  const snapshot=marketingSnapshotSchema.parse({promptVersion:"marketing-performance-v1",analysisType:"weekly_performance",definitionVersions:{analytics:"marketing-v2",rules:"marketing-rules-v1",identity:"marketing-identity-v1",freshness:"marketing-calendar-v2"},period:{key:"this_week",currentStart:"2026-09-21",currentEnd:"2026-09-24",previousStart:"2026-09-14",previousEnd:"2026-09-17",calendarPolicy:"Common mature native date"},sourceManifest:[],sourceManifestHash:"a".repeat(64),evidence:[{id:"e1",kind:"kpi",assetId:null,label:"คลิกจาก Google",metric:"search_clicks",current:3,previous:0,absoluteChange:3,percentageChange:null,sampleStatus:"low",coverageStatus:"complete",freshnessStatus:"expected_lag",evidenceRef:"sql:search_clicks",measurementStatus:null}],coverage:{prepared:1,sent:1,dropped:0},limitations:["Qualified conversations are unavailable"]});
  const context=marketingAnalysisInputSchema.parse({...snapshot,snapshotHash:"b".repeat(64)});
  const local=buildMarketingInferenceRequest(context),cloud=buildMarketingCloudRequest(context);
  assert.equal(local.messages[0]!.content,MARKETING_ANALYSIS_INSTRUCTION);
  assert.doesNotMatch(local.messages[0]!.content,/Do not use learning/);
  assert.match(cloud.messages[0]!.content,/Do not use learning/);
  assert.notEqual(MARKETING_CLOUD_PROMPT_VERSION,context.promptVersion);
  assert.equal(cloud.cloudPromptDigest,createHash("sha256").update(JSON.stringify({version:MARKETING_CLOUD_PROMPT_VERSION,messages:cloud.messages,format:cloud.format})).digest("hex"));
  rmSync(directory,{recursive:true,force:true});
});
