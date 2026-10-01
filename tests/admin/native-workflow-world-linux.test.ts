import assert from "node:assert/strict";
import { fork, execFileSync, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import type { World, QueuePayload, ValidQueueName } from "@workflow/world";

// Layer1: real isolated PostgreSQL storage/Graphile queue, synthetic receiver.
// This mounts no Next/SDK application and performs no article/provider work.
const root = path.resolve(import.meta.dirname, "../..");
const req = createRequire(path.join(root, "package.json"));
const fixtureConnection = (port: string) => `postgresql://ccpun_workflow_lab:ccpun-workflow-lab-only@127.0.0.1:${port}/ccpun_workflow_lab`;
const allowed = new Set(["CCPUN_NATIVE_WORLD_LINUX_LAB", "CCPUN_LAB_DATABASE_PORT", "CCPUN_LAB_GIT_SHA", "CCPUN_LAB_GIT_REF", "CCPUN_LAB_CONNECTION", "WORKFLOW_TARGET_WORLD", "WORKFLOW_LOCAL_BASE_URL", "WORKFLOW_JSON_MODE", "PORT"]);
type Variables = Record<string, string | undefined>;
type LabStage = "target" | "source" | "dependency" | "database" | "migration" | "receiver" | "executor" | "crash-recovery" | "delay-ack" | "close";
let stage: LabStage = "target";
const failureCodes = new Set(["LAB_NOT_OPTED_IN", "LAB_REQUIRES_REAL_LINUX", "LAB_REQUIRES_NODE24", "LAB_REQUIRES_LINUX_X64",
  "LAB_AMBIENT_CONFIG_DENIED", "LAB_PORT_INVALID", "LAB_DATABASE_IDENTITY_MISMATCH", "LAB_WORLD_MISMATCH", "LAB_SHA_REQUIRED", "LAB_REF_REQUIRED",
  "LAB_DOTENV_PRESENT", "LAB_SOURCE_MISMATCH", "LAB_SOURCE_DIRTY", "LAB_REF_MISMATCH", "LAB_DATABASE_NOT_EMPTY",
  "DELAY_NOT_DURABLY_STORED", "COMMITTED_JOB_LOST_AFTER_CRASH", "DELAY_DELIVERED_EARLY", "LAB_GRACEFUL_CLOSE_TIMEOUT", "LAB_WORKER_EXITED",
  "LAB_TIMEOUT_START", "LAB_TIMEOUT_ENQUEUE", "LAB_TIMEOUT_ACTIVE_EXECUTOR", "LAB_TIMEOUT_RECOVERED_ACTIVE_RUN", "LAB_TIMEOUT_DURABLE_DELAY", "LAB_TIMEOUT_ACKNOWLEDGED_JOB"]);
export function safeLabFailure(at: LabStage, error: unknown) {
  // Emit only source-owned constants. Raw errors, assertion values, endpoint
  // details and environment key names never reach CI output.
  const firstLine = error instanceof Error ? error.message.split("\n")[0] : "";
  const code = failureCodes.has(firstLine) ? firstLine : "UNCLASSIFIED";
  return `NATIVE_WORLD_LINUX_LAB_FAILED stage=${at} code=${code}`;
}

export function validateLab(variables: Variables, platform: string, nodeMajor: number) {
  // Before dependency import, Pool or World construction (eager LISTEN).
  assert.equal(variables.CCPUN_NATIVE_WORLD_LINUX_LAB, "1", "LAB_NOT_OPTED_IN");
  assert.equal(platform, "linux", "LAB_REQUIRES_REAL_LINUX");
  assert.equal(nodeMajor, 24, "LAB_REQUIRES_NODE24");
  for (const key of Object.keys(variables)) {
    if ((/^(?:CCPUN_|WORKFLOW_|PG|NEXT_PUBLIC_|SANITY_|VERCEL_|N8N_|AUTH_|LINE_|GOOGLE_|GSC_|GA4_|OPENAI_|META_|FACEBOOK_|TIKTOK_|AWS_|AZURE_|CLOUDFLARE_|HOSTINGER_)/i.test(key)
      || /^(?:DATABASE_URL|NODE_OPTIONS|NODE_PATH|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY)$/i.test(key)
      || /(?:_TOKEN|_SECRET|_PASSWORD|PRIVATE_KEY)(?:$|_)/i.test(key)) && !allowed.has(key)) throw new Error("LAB_AMBIENT_CONFIG_DENIED");
  }
  const port = variables.CCPUN_LAB_DATABASE_PORT ?? "";
  assert.match(port, /^[1-9]\d{0,4}$/, "LAB_PORT_INVALID");
  assert.ok(Number(port) <= 65535, "LAB_PORT_INVALID");
  assert.equal(variables.CCPUN_LAB_CONNECTION, fixtureConnection(port), "LAB_DATABASE_IDENTITY_MISMATCH");
  assert.equal(variables.WORKFLOW_TARGET_WORLD, "@workflow/world-postgres", "LAB_WORLD_MISMATCH");
  assert.match(variables.CCPUN_LAB_GIT_SHA ?? "", /^[a-f0-9]{40}$/, "LAB_SHA_REQUIRED");
  assert.match(variables.CCPUN_LAB_GIT_REF ?? "", /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/, "LAB_REF_REQUIRED");
  return { connectionString: fixtureConnection(port) };
}

function preflight() {
  stage = "target";
  const config = validateLab(process.env, process.platform, Number(process.versions.node.split(".")[0]));
  assert.equal(process.arch, "x64", "LAB_REQUIRES_LINUX_X64");
  for (const directory of [root, process.cwd()]) assert.ok(!readdirSync(directory).some((file) => /^\.env(?:\.|$)/.test(file)), "LAB_DOTENV_PRESENT");
  stage = "source";
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  assert.equal(git("rev-parse", "HEAD"), process.env.CCPUN_LAB_GIT_SHA, "LAB_SOURCE_MISMATCH");
  assert.equal(git("status", "--porcelain", "--untracked-files=no"), "", "LAB_SOURCE_DIRTY");
  // Detached checkout is allowed; its provided ref must resolve to the same SHA.
  assert.equal(git("rev-parse", process.env.CCPUN_LAB_GIT_REF!), process.env.CCPUN_LAB_GIT_SHA, "LAB_REF_MISMATCH");
  return config;
}

type Pool = { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>; end(): Promise<void> };
type LabWorld = World & { start(): Promise<void>; close(): Promise<void> };
async function databaseIdentity(pool: Pool) {
  const identity = (await pool.query("SELECT current_database() AS db, current_user AS role, current_setting('server_version_num') AS version")).rows[0];
  assert.equal(identity.db, "ccpun_workflow_lab");
  assert.equal(identity.role, "ccpun_workflow_lab");
  assert.equal(Math.floor(Number(identity.version) / 10000), 16);
  return identity;
}
function modules() {
  const entry = req.resolve("@workflow/world-postgres");
  const packageRoot = path.resolve(path.dirname(entry), "..");
  assert.equal(JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")).version, "4.3.5");
  const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
  assert.equal(lock.packages["node_modules/@workflow/world-postgres"].version, "4.3.5");
  const { Pool: PgPool } = req("pg") as { Pool: new (config: { connectionString: string; max: number }) => Pool };
  const { createWorld } = req("@workflow/world-postgres") as { createWorld(config: { pool: Pool; namespace: string; jobPrefix: string; queueConcurrency: number }): LabWorld };
  return { PgPool, createWorld, packageRoot };
}
const namespace = "ccpunlab";
const jobPrefix = "ccpun_lab_";

async function worker() {
  const config = preflight();
  assert.match(process.env.PORT ?? "", /^[1-9]\d{0,4}$/);
  assert.ok(Number(process.env.PORT) <= 65535);
  assert.equal(process.env.WORKFLOW_LOCAL_BASE_URL, `http://127.0.0.1:${process.env.PORT}`);
  const { PgPool, createWorld } = modules();
  const pool = new PgPool({ ...config, max: 4 });
  await databaseIdentity(pool);
  const world = createWorld({ pool, namespace, jobPrefix, queueConcurrency: 1 });
  await world.start();
  process.send?.({ event: "started" }); // Not readiness; parent proves delivery.
  process.on("message", async (message: { action: string; id?: string; delaySeconds?: number }) => {
    try {
      if (message.action === "enqueue" && /^(?:ready|restarted|delayed)$/.test(message.id ?? "")) {
        assert.ok([0, 8].includes(message.delaySeconds ?? 0));
        await world.queue(`__${namespace}_wkf_workflow_${message.id}` as ValidQueueName,
          { __healthCheck: true, correlationId: message.id! },
          { idempotencyKey: `ccpun-lab-${message.id}`, delaySeconds: message.delaySeconds });
        process.send?.({ event: "enqueued", id: message.id });
      } else if (message.action === "stop") {
        await world.close();
        await pool.end(); // Borrowed pool is explicitly owned by this child.
        process.disconnect();
      } else throw new Error("LAB_COMMAND_DENIED");
    } catch { process.stderr.write("LAB_WORKER_FAILED\n"); process.exit(1); }
  });
}

async function until(predicate: () => boolean | Promise<boolean>, label: string, timeout = 20_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await predicate()) return; await delay(100); }
  throw new Error(`LAB_TIMEOUT_${label}`);
}

async function realLab() {
  const config = preflight();
  stage = "dependency";
  const { PgPool, createWorld, packageRoot } = modules();
  const pool = new PgPool({ ...config, max: 4 });
  let world: LabWorld | undefined;
  let child: ChildProcess | undefined;
  const messages: { event: string; id?: string }[] = [];
  const delivered: string[] = [];
  const delayedReceipts: number[] = [];
  const server = createServer();
  let receiverHost = "";
  try {
    stage = "database";
    const identity = await databaseIdentity(pool);
    assert.equal((await pool.query("SELECT count(*) AS count FROM information_schema.schemata WHERE schema_name IN ('workflow','workflow_drizzle','graphile_worker')")).rows[0].count, "0", "LAB_DATABASE_NOT_EMPTY");
    assert.equal((await pool.query("SELECT count(*) AS count FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')")).rows[0].count, "0", "LAB_DATABASE_NOT_EMPTY");
    // One migration owner, exact package SQL; no CLI/dotenv/default URL.
    stage = "migration";
    const { drizzle } = req("drizzle-orm/node-postgres") as { drizzle(pool: Pool): unknown };
    const { migrate } = req("drizzle-orm/node-postgres/migrator") as { migrate(db: unknown, config: Record<string, string>): Promise<void> };
    await migrate(drizzle(pool), { migrationsFolder: path.join(packageRoot, "src/drizzle/migrations"), migrationsSchema: "workflow_drizzle", migrationsTable: "workflow_migrations" });
    const { makeWorkerUtils } = req("graphile-worker") as { makeWorkerUtils(config: { pgPool: Pool }): Promise<{ migrate(): Promise<void>; release(): Promise<void> }> };
    const utils = await makeWorkerUtils({ pgPool: pool });
    try { await utils.migrate(); } finally { await utils.release(); }
    stage = "receiver";
    world = createWorld({ pool, namespace, jobPrefix, queueConcurrency: 1 });
    assert.equal(typeof world.getEncryptionKeyForRun, "undefined", "Layer1 must not claim encrypted production storage");
    const receiver = world.createQueueHandler(`__${namespace}_wkf_workflow_`, async (input) => {
      const payload = input as QueuePayload;
      if ("__healthCheck" in payload) {
        assert.ok(["ready", "restarted", "delayed"].includes(payload.correlationId));
        if (payload.correlationId === "delayed") delayedReceipts.push(Date.now());
        delivered.push(payload.correlationId);
      } else if ("runId" in payload) {
        const run = await world!.runs.get(payload.runId);
        assert.equal(run.workflowName, "ccpunLabRecovered");
        if (run.status === "pending") await world!.events.create(run.runId, { eventType: "run_started" });
        if (run.status !== "completed") await world!.events.create(run.runId, { eventType: "run_completed", eventData: { output: "SYNTHETIC_NOOP" } });
        delivered.push(run.runId);
      } else throw new Error("LAB_PAYLOAD_DENIED");
    });
    server.on("request", async (incoming, outgoing) => {
      try {
        if (incoming.method !== "POST" || incoming.headers.host !== receiverHost || incoming.url !== "/.well-known/workflow/v1/flow" || incoming.headers.origin || incoming.headers.forwarded
          || Object.keys(incoming.headers).some((key) => key.startsWith("x-forwarded-"))) { outgoing.writeHead(404).end(); return; }
        const chunks: Buffer[] = [];
        for await (const chunk of incoming) { chunks.push(Buffer.from(chunk)); if (chunks.reduce((n, item) => n + item.length, 0) > 8192) throw new Error("LAB_BODY_LIMIT"); }
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) if (typeof value === "string") headers.set(key, value);
        const response = await receiver(new Request(`http://${receiverHost}${incoming.url}`, { method: "POST", headers, body: Buffer.concat(chunks) }));
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        outgoing.end(await response.text());
      } catch { outgoing.writeHead(500).end("LAB_RECEIVER_FAILED"); }
    });
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    receiverHost = `127.0.0.1:${address.port}`;
    assert.equal((await fetch(`http://${receiverHost}/.well-known/workflow/v1/flow`)).status, 404);
    assert.equal((await fetch(`http://${receiverHost}/.well-known/workflow/v1/flow`, { method: "POST", headers: { origin: "https://fixture.invalid" }, body: "SYNTHETIC_NOOP" })).status, 404);
    assert.equal(delivered.length, 0);
    const start = async () => {
      messages.length = 0;
      const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, NODE_ENV: "test" };
      for (const key of allowed) if (process.env[key]) env[key] = process.env[key];
      env.PORT = String(address.port);
      env.WORKFLOW_LOCAL_BASE_URL = `http://127.0.0.1:${address.port}`;
      env.WORKFLOW_JSON_MODE = "1";
      child = fork(fileURLToPath(import.meta.url), ["--lab-worker"], { execArgv: ["--import", "tsx"], env, stdio: ["ignore", "ignore", "pipe", "ipc"] });
      // Never replay dependency error text or connection details.
      child.stderr?.resume();
      child.on("message", (message: { event: string; id?: string }) => messages.push(message));
      await until(() => { assert.equal(child!.exitCode, null, "LAB_WORKER_EXITED"); return messages.some((item) => item.event === "started"); }, "START");
    };
    const enqueue = async (id: string, delaySeconds = 0) => {
      child!.send({ action: "enqueue", id, delaySeconds });
      await until(() => messages.some((item) => item.event === "enqueued" && item.id === id), "ENQUEUE");
    };
    stage = "executor";
    await start();
    await enqueue("ready");
    await until(() => delivered.includes("ready"), "ACTIVE_EXECUTOR");
    await enqueue("delayed", 8);
    const pending = async () => (await pool.query("SELECT id, run_at FROM graphile_worker.jobs WHERE payload->>'id' = $1", ["delayed"])).rows;
    const before = await pending();
    assert.equal(before.length, 1, "DELAY_NOT_DURABLY_STORED");
    const due = new Date(String(before[0].run_at)).getTime();
    assert.ok(due > Date.now());
    const created = await world.events.create(null, { eventType: "run_created", specVersion: world.specVersion,
      eventData: { deploymentId: "postgres", workflowName: "ccpunLabRecovered", input: "SYNTHETIC_NOOP" } });
    assert.ok(created.run);
    const runId = created.run.runId;
    assert.equal((await world.runs.get(runId)).status, "pending");
    stage = "crash-recovery";
    const crashed = child!;
    const stopped = new Promise<void>((resolve) => crashed.once("exit", () => resolve()));
    crashed.kill("SIGKILL"); // Exact owned lab child; retain database and queue.
    await stopped;
    assert.equal(delivered.includes("delayed"), false);
    assert.equal((await pending())[0].id, before[0].id, "COMMITTED_JOB_LOST_AFTER_CRASH");
    assert.equal((await world.runs.get(runId)).status, "pending");
    await start();
    await enqueue("restarted");
    await until(() => delivered.includes("restarted") && delivered.includes(runId), "RECOVERED_ACTIVE_RUN");
    assert.equal((await world.runs.get(runId)).status, "completed");
    stage = "delay-ack";
    await until(() => delivered.includes("delayed"), "DURABLE_DELAY");
    assert.equal(delayedReceipts.length, 1);
    assert.ok(delayedReceipts[0] >= due, "DELAY_DELIVERED_EARLY");
    await until(async () => (await pending()).length === 0, "ACKNOWLEDGED_JOB");
    assert.equal(delivered.filter((id) => id === "delayed").length, 1);
    stage = "close";
    const graceful = child!;
    const exited = new Promise<void>((resolve) => graceful.once("exit", () => resolve()));
    graceful.send({ action: "stop" });
    await Promise.race([exited, delay(10_000).then(() => { throw new Error("LAB_GRACEFUL_CLOSE_TIMEOUT"); })]);
    assert.equal(graceful.exitCode, 0);
    child = undefined;
    console.log(JSON.stringify({ layer: "storage-queue-only", sourceSha: process.env.CCPUN_LAB_GIT_SHA, node: process.versions.node,
      sourceRef: process.env.CCPUN_LAB_GIT_REF, rootLockSha256: createHash("sha256").update(readFileSync(path.join(root, "package-lock.json"))).digest("hex"),
      platform: process.platform, architecture: process.arch, postgresVersion: identity.version, backend: "4.3.5", recoveredRun: true, delayedJobSurvivedCrash: true,
      actualExecutorRoundTrip: true, gracefulClose: true, compiledNextAcceptance: false, productionReady: false }));
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) { const stopped = new Promise<void>((resolve) => child!.once("exit", () => resolve())); child.kill("SIGKILL"); await stopped; }
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    try { await world?.close(); } finally { await pool.end(); }
    // No DROP/reset of an external database. GitHub owns the disposable service.
  }
}

if (process.argv.includes("--lab-worker")) {
  worker().catch(() => { process.stderr.write("LAB_WORKER_START_FAILED\n"); process.exit(1); });
} else {
  test("Linux lab rejects ambient/provider/default targets before constructor", () => {
    const variables = { CCPUN_NATIVE_WORLD_LINUX_LAB: "1", CCPUN_LAB_DATABASE_PORT: "5432", CCPUN_LAB_CONNECTION: fixtureConnection("5432"),
      CCPUN_LAB_GIT_SHA: "a".repeat(40), CCPUN_LAB_GIT_REF: "fixture", WORKFLOW_TARGET_WORLD: "@workflow/world-postgres" };
    assert.equal(validateLab(variables, "linux", 24).connectionString, fixtureConnection("5432"));
    for (const patch of [{ CCPUN_NATIVE_WORLD_LINUX_LAB: "0" }, { CCPUN_LAB_DATABASE_PORT: "0" }, { CCPUN_LAB_DATABASE_PORT: "65536" },
      { CCPUN_LAB_CONNECTION: undefined }, { CCPUN_LAB_CONNECTION: fixtureConnection("5432").replace("127.0.0.1", "localhost") },
      { CCPUN_LAB_CONNECTION: `${fixtureConnection("5432")}?options=unsafe` }, { WORKFLOW_TARGET_WORLD: "local" },
      { CCPUN_LAB_GIT_SHA: "latest" }, { CCPUN_LAB_GIT_REF: "" }, { DATABASE_URL: "fixture" }, { PGHOST: "fixture" }, { PGOPTIONS: "fixture" },
      { CCPUN_ADMIN_DATABASE_URL: "fixture" }, { SANITY_API_TOKEN: "fixture" }, { VERCEL_PROJECT_ID: "fixture" }, { AUTH_SECRET: "fixture" },
      { LINE_CHANNEL_ACCESS_TOKEN: "fixture" }, { GOOGLE_CLIENT_ID: "fixture" }, { GSC_PROPERTY: "fixture" }, { GA4_ID: "fixture" },
      { OPENAI_API_KEY: "fixture" }, { META_PIXEL_ID: "fixture" }, { NODE_OPTIONS: "fixture" }, { NODE_PATH: "fixture" }, { HTTPS_PROXY: "fixture" },
    ]) assert.throws(() => validateLab({ ...variables, ...patch }, "linux", 24));
    assert.throws(() => validateLab(variables, "darwin", 24));
    assert.throws(() => validateLab(variables, "linux", 22));
  });
  test("clean CI launch drops inherited tooling and safe failure codes never replay payloads", () => {
    // Exercise env -i with synthetic ambient tokens, not a real runner token.
    const launch = spawnSync("env", ["-i", "PATH=" + (process.env.PATH ?? ""), "NODE_ENV=test", "CCPUN_NATIVE_WORLD_LINUX_LAB=1",
      process.execPath, "-e", "console.log(JSON.stringify(Object.keys(process.env).sort()))"], {
      encoding: "utf8", env: { PATH: process.env.PATH, NODE_ENV: "test", AZURE_HTTP_USER_AGENT: "SYNTHETIC_ONLY", ACTIONS_RUNTIME_TOKEN: "SYNTHETIC_ONLY", DATABASE_URL: "SYNTHETIC_ONLY" },
    });
    assert.equal(launch.status, 0);
    // macOS may inject its text-encoding key after exec; the real lab is Linux.
    const keys = (JSON.parse(launch.stdout) as string[]).filter((key) => !(process.platform === "darwin" && key === "__CF_USER_TEXT_ENCODING"));
    assert.deepEqual(keys, ["CCPUN_NATIVE_WORLD_LINUX_LAB", "NODE_ENV", "PATH"]);
    assert.equal(safeLabFailure("target", new Error("LAB_AMBIENT_CONFIG_DENIED")), "NATIVE_WORLD_LINUX_LAB_FAILED stage=target code=LAB_AMBIENT_CONFIG_DENIED");
    assert.equal(safeLabFailure("source", new Error("LAB_SHA_REQUIRED\nSYNTHETIC_PRIVATE_PAYLOAD")), "NATIVE_WORLD_LINUX_LAB_FAILED stage=source code=LAB_SHA_REQUIRED");
    assert.equal(safeLabFailure("database", new Error("SYNTHETIC_PRIVATE_ENDPOINT_PASSWORD")), "NATIVE_WORLD_LINUX_LAB_FAILED stage=database code=UNCLASSIFIED");
  });
  test("real Linux PostgreSQL migrations, active delivery, crash/restart recovery and graceful close (Layer1 only)",
    { skip: process.env.CCPUN_NATIVE_WORLD_LINUX_LAB !== "1", timeout: 90_000 }, async () => {
      try { await realLab(); } catch (error) { throw new Error(safeLabFailure(stage, error)); }
    });
}
