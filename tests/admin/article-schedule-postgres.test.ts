import assert from "node:assert/strict";
import test from "node:test";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { buildArticleSchedulerMigration, ARTICLE_SCHEDULER_CHECKSUM } from "../../db/migrations/20260911_article_scheduling_v1";
import { PREPARE_ARTICLE_SCHEDULE, ACK_ARTICLE_DISPATCH, CANCEL_ARTICLE_SCHEDULE, CLAIM_ARTICLE_SCHEDULE, AUTHORIZE_ARTICLE_EXECUTION, FINISH_ARTICLE_SCHEDULE } from "../../lib/admin/operations/article-schedule-sql";

const enabled = process.env.CCPUN_SCHEDULER_PG_TEST === "1";
const args = ["-X","-q","-A","-t","-v","ON_ERROR_STOP=1"];
const sql = (statement: string) => execFileSync("psql",args,{input:statement,encoding:"utf8",stdio:["pipe","pipe","pipe"],timeout:15_000}).trim();
const literal = (value: unknown): string => value === null ? "NULL" : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'","''")}'`;
function bind(statement: string, values: unknown[]) {
  return statement.replace(/\$(\d+)/g,(_match,index)=>literal(values[Number(index)-1])).replace(/SELECT \* FROM changed$/, "SELECT COALESCE(json_agg(changed),'[]'::json) FROM changed");
}
const query = (statement: string, values: unknown[]) => JSON.parse(sql(`SET ROLE ccpun_admin_runtime; ${bind(statement,values)};`)) as Array<Record<string, unknown>>;

test("real Postgres: additive migration, least privileges, durable CAS, audit and cancellation races", {skip: !enabled}, async () => {
  // Only the disposable PostgreSQL service in this CI job uses PG* credentials.
  assert.equal(process.env.PGHOST,"127.0.0.1"); assert.equal(process.env.PGDATABASE,"neondb");
  sql(`CREATE ROLE neondb_owner CREATEROLE; GRANT CREATE ON DATABASE neondb TO neondb_owner;
    CREATE ROLE scheduler_outsider NOLOGIN;
    SET ROLE neondb_owner; CREATE SCHEMA ccpun_admin;
    CREATE TABLE ccpun_admin.system_identity(singleton boolean,project_id text,branch_id text,endpoint_id text,database_name text);
    INSERT INTO ccpun_admin.system_identity VALUES(true,'young-term-47483330','br-crimson-mouse-az7ajkv8','ep-mute-frost-aztvz394','neondb');`);
  const migration = buildArticleSchedulerMigration("uat");
  sql(`SET ROLE neondb_owner; ${migration}`); sql(`SET ROLE neondb_owner; ${migration}`);
  assert.equal(sql("SELECT migration_checksum FROM ccpun_admin.article_scheduler_identity"),ARTICLE_SCHEDULER_CHECKSUM);
  assert.equal(sql("SELECT enabled FROM ccpun_admin.article_scheduler_identity"),"f");
  assert.equal(sql("SELECT rolcanlogin FROM pg_roles WHERE rolname='ccpun_admin_runtime'"),"f");
  for (const statement of ["UPDATE ccpun_admin.article_scheduler_identity SET enabled=true", "DELETE FROM ccpun_admin.article_schedule", "TRUNCATE ccpun_admin.article_schedule", "UPDATE ccpun_admin.article_schedule_audit SET actor='tampered'"]) assert.throws(()=>sql(`SET ROLE ccpun_admin_runtime; ${statement};`));
  assert.throws(()=>sql("SET ROLE scheduler_outsider; SELECT * FROM ccpun_admin.article_schedule;"));

  const generation = randomUUID();
  const target = new Date(Date.now()+3_600_000).toISOString();
  const create = ["article-pg",generation,"draft-1",null,target,"owner@example.test",null,0];
  assert.deepEqual(query(PREPARE_ARTICLE_SCHEDULE,create),[]);
  sql("UPDATE ccpun_admin.article_scheduler_identity SET enabled=true");
  let row=query(PREPARE_ARTICLE_SCHEDULE,create)[0]; assert.equal(row.status,"preparing");
  assert.equal(query(PREPARE_ARTICLE_SCHEDULE,[...create.slice(0,1),randomUUID(),...create.slice(2)]).length,0);
  assert.equal(query(CLAIM_ARTICLE_SCHEDULE,["article-pg",generation,randomUUID()]).length,0);
  row=query(ACK_ARTICLE_DISPATCH,["article-pg",generation,"run-pg"])[0]; assert.equal(row.status,"scheduled");
  assert.equal(query(CLAIM_ARTICLE_SCHEDULE,["article-pg",generation,randomUUID()]).length,0,"no early publication");
  assert.equal(query(CANCEL_ARTICLE_SCHEDULE,["article-pg",generation,1,"owner@example.test"]).length,0,"old tab cannot cancel new row version");

  const newGeneration=randomUUID();
  row=query(PREPARE_ARTICLE_SCHEDULE,["article-pg",newGeneration,"draft-1",null,target,"owner@example.test",generation,Number(row.row_version)])[0];
  assert.equal(row.generation,newGeneration);
  assert.equal(query(CANCEL_ARTICLE_SCHEDULE,["article-pg",generation,2,"owner@example.test"]).length,0);
  row=query(ACK_ARTICLE_DISPATCH,["article-pg",newGeneration,"run-pg-2"])[0];
  sql("UPDATE ccpun_admin.article_schedule SET scheduled_at=clock_timestamp()-interval '1 minute' WHERE article_id='article-pg'");
  const asyncExec=promisify(execFile);
  const claims=await Promise.all([randomUUID(),randomUUID()].map(async (executionId)=>{
    const result=await asyncExec("psql",[...args,"-c",`SET ROLE ccpun_admin_runtime; ${bind(CLAIM_ARTICLE_SCHEDULE,["article-pg",newGeneration,executionId])};`],{timeout:15_000});
    return JSON.parse(result.stdout.trim()) as Array<Record<string,unknown>>;
  }));
  assert.equal(claims.flat().length,1,"only one of simultaneous deliveries owns the lease");
  const claimed=claims.flat()[0];
  assert.equal(query(CANCEL_ARTICLE_SCHEDULE,["article-pg",newGeneration,Number(claimed.row_version),"owner@example.test"]).length,0,"cannot report cancelled after execution begins");
  assert.equal(query(PREPARE_ARTICLE_SCHEDULE,["article-pg",randomUUID(),"draft-2",null,target,"owner@example.test",newGeneration,Number(claimed.row_version)]).length,0);
  assert.equal(sql(`SET ROLE ccpun_admin_runtime; ${bind(AUTHORIZE_ARTICLE_EXECUTION,["article-pg",newGeneration,claimed.execution_id])}`),"t");
  sql("UPDATE ccpun_admin.article_scheduler_identity SET enabled=false");
  assert.equal(sql(`SET ROLE ccpun_admin_runtime; ${bind(AUTHORIZE_ARTICLE_EXECUTION,["article-pg",newGeneration,claimed.execution_id])}`),"f");
  assert.throws(()=>query(FINISH_ARTICLE_SCHEDULE,["article-pg",newGeneration,claimed.execution_id,"published",null,"receipt-pg"]),"UAT cannot record real publication");
  row=query(FINISH_ARTICLE_SCHEDULE,["article-pg",newGeneration,claimed.execution_id,"validated",null,null])[0]; assert.equal(row.status,"validated");
  assert.equal(query(CLAIM_ARTICLE_SCHEDULE,["article-pg",newGeneration,randomUUID()]).length,0,"completed lease is not reclaimed");
  assert.equal(Number(sql("SELECT count(*) FROM ccpun_admin.article_schedule_audit WHERE article_id='article-pg'")),6);

  sql("UPDATE ccpun_admin.article_scheduler_identity SET enabled=true");
  const cancelGen=randomUUID();
  const next=query(PREPARE_ARTICLE_SCHEDULE,["cancel-pg",cancelGen,"draft-3",null,target,"owner@example.test",null,0])[0];
  sql("UPDATE ccpun_admin.article_scheduler_identity SET enabled=false");
  assert.equal(query(CANCEL_ARTICLE_SCHEDULE,["cancel-pg",cancelGen,Number(next.row_version),"owner@example.test"])[0].status,"cancelled","kill switch leaves cancellation available");
  sql("UPDATE ccpun_admin.article_scheduler_identity SET migration_checksum='tampered'");
  assert.throws(()=>sql(`SET ROLE neondb_owner; ${migration}`),"checksum drift cannot be silently accepted");
});
