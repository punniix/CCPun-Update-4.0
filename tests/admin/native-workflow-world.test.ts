import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

// Local lock validation can install into a config-free fixture. CI uses the
// normal root npm ci; no connection string or provider credentials are loaded.
const dependencyRoot = process.env.CCPUN_NATIVE_WORLD_TEST_ROOT ?? path.resolve(import.meta.dirname, "../..");

function probe(failure: "none" | "migrate" | "run" = "none") {
  const script = `
    const {createRequire}=require('node:module');const Module=require('node:module');
    const path=require('node:path');const fs=require('node:fs');
    const req=createRequire(path.join(process.argv[1],'package.json'));const failure=process.argv[2];
    const trace=[];const queries=[];let blockedConnections=0,network=0;
    const forbidden=()=>{network++;throw Error('NETWORK_FORBIDDEN')};
    global.fetch=forbidden;require('node:net').Socket.prototype.connect=forbidden;
    const pg=req('pg');pg.Client.prototype.connect=pg.Pool.prototype.connect=()=>{blockedConnections++;throw Error('REAL_DB_FORBIDDEN')};
    const id=req.resolve('graphile-worker');const fake=new Module(id);fake.loaded=true;
    fake.exports={Logger:class{},async makeWorkerUtils(){trace.push('utils');return{
      async migrate(){trace.push('migrate');if(failure==='migrate')throw Error('FAKE_MIGRATION_FAILED')},
      async addJob(){throw Error('UNEXPECTED_JOB')},async release(){trace.push('release')}
    }},async run(){trace.push('run');if(failure==='run')throw Error('FAKE_RUNNER_FAILED');return{async stop(){trace.push('stop')}}}};
    require.cache[id]=fake;
    const pool={options:{},async query(statement){queries.push(typeof statement==='string'?statement:statement.text);return{rows:[]}},async end(){throw Error('BORROWED_POOL_MUST_STAY_OPEN')}};
    const {createWorld}=req('@workflow/world-postgres');const {SPEC_VERSION_CURRENT}=req('@workflow/world');
    const pkg=JSON.parse(fs.readFileSync(path.resolve(path.dirname(req.resolve('@workflow/world-postgres')),'../package.json'),'utf8'));
    const world=createWorld({pool,queueConcurrency:1});
    const constructor={queries:queries.length,blockedConnections,network};
    (async()=>{
      let error=null;
      try{await world.start();await world.start()}catch(e){error=e.message}
      await world.close();
      console.log(JSON.stringify({version:pkg.version,worldDependency:pkg.dependencies['@workflow/world'],spec:world.specVersion,expectedSpec:SPEC_VERSION_CURRENT,
        methods:['start','close','queue','createQueueHandler','getDeploymentId'].map(name=>typeof world[name]),
        constructor,error,trace,queries,blockedConnections,network,encrypted:typeof world.getEncryptionKeyForRun==='function'}));
    })().catch(()=>process.exit(1));
  `;
  const result = spawnSync(process.execPath, ["-e", script, dependencyRoot, failure], {
    encoding: "utf8", timeout: 15_000,
    env: { PATH: process.env.PATH, NODE_ENV: "test", WORKFLOW_LOCAL_BASE_URL: "https://executor.invalid" },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout) as {
    version: string; worldDependency: string; spec: number; expectedSpec: number; methods: string[];
    constructor: { queries: number; blockedConnections: number; network: number };
    error: string | null; trace: string[]; queries: string[]; blockedConnections: number; network: number; encrypted: boolean;
  };
}

test("exact Postgres World matches installed spec with zero storage SQL and trapped eager LISTEN connection", () => {
  const result = probe();
  assert.equal(result.version, "4.3.5");
  assert.equal(result.worldDependency, "4.5.0");
  assert.equal(result.spec, result.expectedSpec);
  assert.deepEqual(result.methods, Array(5).fill("function"));
  // The backend eagerly initializes its LISTEN client. Intercept that call;
  // do not misrepresent construction as a side-effect-free startup gate.
  assert.deepEqual(result.constructor, { queries: 0, blockedConnections: 1, network: 0 });
  assert.equal(result.blockedConnections, 1);
  assert.equal(result.network, 0);
  // This official backend supplies no encryption key; the native Production
  // store/transport security gate must remain separate from this import probe.
  assert.equal(result.encrypted, false);
});

test("mock-only start is idempotent and close stops/releases worker without owning the supplied pool", () => {
  const result = probe();
  assert.equal(result.error, null);
  assert.deepEqual(result.trace, ["utils", "migrate", "run", "stop", "release"]);
  assert.ok(result.queries.length > 0, "start must inspect/recover stored runs");
  assert.ok(result.queries.every((query) => /^\s*SELECT\b/i.test(query)), "all pool calls are simulated empty reads");
  assert.equal(result.blockedConnections, 1);
  assert.equal(result.network, 0);
});

test("migration/worker failures reject startup and release fake resources without execution", () => {
  for (const failure of ["migrate", "run"] as const) {
    const result = probe(failure);
    assert.equal(result.error, failure === "migrate" ? "FAKE_MIGRATION_FAILED" : "FAKE_RUNNER_FAILED");
    assert.deepEqual(result.constructor, { queries: 0, blockedConnections: 1, network: 0 });
    assert.deepEqual(result.trace, failure === "migrate" ? ["utils", "migrate", "release"] : ["utils", "migrate", "run", "release"]);
    assert.equal(result.blockedConnections, 1);
    assert.equal(result.network, 0);
  }
});
