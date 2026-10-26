import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { accessSync, constants, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import test from 'node:test';

// Only a fresh cluster owned by this test; ambient PG connections/services are never used.
const programs = ['initdb', 'pg_ctl', 'psql'];
const directories = process.env.CCPUN_C7B_PG_BINDIR
  ? [process.env.CCPUN_C7B_PG_BINDIR]
  : (process.env.PATH ?? '').split(delimiter).filter(Boolean);
const bin = directories.find(directory => programs.every(program => {
  try { accessSync(join(directory, program), constants.X_OK); return true; } catch { return false; }
}));
const required = process.env.CCPUN_C7B_REQUIRE_POSTGRES === '1';
const unavailable = 'Real PostgreSQL unavailable: initdb, pg_ctl and psql must share an installed bin directory; no install or existing DB connection attempted';
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";

test('real PostgreSQL: v1/v2/v2, fixed-window coverage and bounded GSC reconciliation', {
  skip: !bin && !required ? unavailable : false, timeout: 90_000,
}, async t => {
  assert.ok(bin, unavailable);
  const directory = mkdtempSync('/tmp/ccpun-c7b-pg-');
  const data = join(directory, 'data');
  const env = { PATH: process.env.PATH ?? '', LANG: 'C', LC_ALL: 'C',
    PGPASSFILE: join(directory, 'unused-passfile'), PGSERVICEFILE: join(directory, 'unused-servicefile') };
  const run = (program, args, input) => execFileSync(join(bin, program), args, {
    env, input, encoding: 'utf8', timeout: 20_000, maxBuffer: 1_048_576, stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
  const args = ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate',
    '-h', directory, '-U', 'c7b_fixture', '-d', 'neondb'];
  const sql = statement => run('psql', args, statement);
  const worker = statement => sql('SET ROLE ccpun_seo_post_publish_worker; ' + statement);
  const windowFor = job => sql(`SELECT gsc_window_id FROM ccpun_admin.seo_post_publish_step WHERE job_id=${quote(job)} AND step='gsc-sitemap-submit'`);
  const claim = lease => worker(`SELECT window_id FROM ccpun_admin.seo_claim_gsc_window(${quote(lease)})`);
  const begin = (window, lease, jobs) => worker(`SELECT ccpun_admin.seo_begin_gsc_window(${quote(window)},${quote(lease)},ARRAY[${jobs.map(quote).join(',')}]::uuid[],'{}'::uuid[],20)`);
  const finish = (window, lease, state) => worker(`SELECT ccpun_admin.seo_finish_gsc_window(${quote(window)},${quote(lease)},${quote(state)},NULL,'{}'::jsonb)`);
  const reconcile = (window, confirmed) => {
    sql(`UPDATE ccpun_admin.seo_gsc_window SET next_reconcile_at=clock_timestamp()-interval '1 second' WHERE window_id=${quote(window)}`);
    const lease = randomUUID();
    assert.equal(worker(`SELECT window_id FROM ccpun_admin.seo_claim_gsc_reconciliation(${quote(lease)},20)`), window);
    return worker(`SELECT ccpun_admin.seo_finish_gsc_reconciliation(${quote(window)},${quote(lease)},${confirmed},'{"fixture":true}'::jsonb)`);
  };
  const seed = label => {
    const id = randomUUID(); const lease = randomUUID();
    sql(`INSERT INTO ccpun_admin.seo_post_publish_job(job_id,article_id,content_version,source,owner_approved,actor,request_id,state,lease_id,lease_until)
      VALUES(${quote(id)},${quote('TEST-' + label)},clock_timestamp(),'owner',true,'fixture',${quote(randomUUID())},'processing',${quote(lease)},clock_timestamp()+interval '4 minutes')`);
    return { id, lease };
  };
  const enroll = job => worker(`SELECT ccpun_admin.seo_enroll_gsc_window(${quote(job.id)},${quote(job.lease)})`);
  // Advance only this fixture's persisted clock fields instead of waiting 30 real minutes.
  const ageWindow = (window, minutes) => sql(`
    UPDATE ccpun_admin.seo_gsc_window SET opened_at=opened_at-interval '${minutes} minutes',closes_at=closes_at-interval '${minutes} minutes',next_attempt_at=next_attempt_at-interval '${minutes} minutes' WHERE window_id=${quote(window)};
    UPDATE ccpun_admin.seo_post_publish_step SET gsc_ready_at=gsc_ready_at-interval '${minutes} minutes',next_attempt_at=next_attempt_at-interval '${minutes} minutes' WHERE gsc_window_id=${quote(window)};`);
  const reset = () => sql('TRUNCATE ccpun_admin.seo_post_publish_job,ccpun_admin.seo_post_publish_intent,ccpun_admin.seo_post_publish_step,ccpun_admin.seo_gsc_window,ccpun_admin.seo_sitemap_submit_ledger CASCADE');
  let started = false;
  try {
    run('initdb', ['-D', data, '-U', 'c7b_fixture', '--auth-local=trust', '--auth-host=reject', '--no-locale']);
    // Unix socket inside the owned temporary directory; TCP listening is disabled.
    run('pg_ctl', ['-D', data, '-l', join(directory, 'postgres.log'), '-o', `-k ${directory} -c listen_addresses=''`, '-w', 'start']);
    started = true;
    run('psql', [...args.slice(0, -1), 'postgres'], 'CREATE DATABASE neondb');
    assert.equal(sql('SELECT current_database()'), 'neondb');
    assert.equal(sql("SELECT to_regnamespace('ccpun_admin') IS NULL"), 't');
    sql(`CREATE ROLE ccpun_admin_runtime NOLOGIN; CREATE SCHEMA ccpun_admin;
      CREATE TABLE ccpun_admin.system_identity(singleton boolean,project_id text,branch_id text);
      INSERT INTO ccpun_admin.system_identity VALUES(true,'young-term-47483330','br-crimson-mouse-az7ajkv8');
      GRANT USAGE ON SCHEMA ccpun_admin TO ccpun_admin_runtime;`);
    sql(read('db/migrations/20261008_seo_post_publish_durable_v1.sql'));
    const v2 = read('db/migrations/20261026_seo_post_publish_webhook_v2.sql');
    sql(v2);
    const legacy = seed('legacy-coalesced');
    sql(`INSERT INTO ccpun_admin.seo_post_publish_step(job_id,step,state) VALUES(${quote(legacy.id)},'gsc-sitemap-submit','coalesced')`);
    sql(v2);
    assert.equal(sql(`SELECT state||':'||error_code FROM ccpun_admin.seo_post_publish_step WHERE job_id=${quote(legacy.id)}`), 'pending:gsc-legacy-uncovered');
    assert.throws(() => sql(`SET ROLE ccpun_admin_runtime; SELECT ccpun_admin.seo_enroll_gsc_window(${quote(legacy.id)},${quote(legacy.lease)})`), 'producer cannot execute worker functions');

    await t.test('two publishes five minutes apart reserve exactly once at window end and both are covered', () => {
      reset();
      const first = seed('batch-first'); assert.equal(enroll(first), 'deferred');
      const window = windowFor(first.id); ageWindow(window, 5);
      const second = seed('batch-second'); assert.equal(enroll(second), 'deferred');
      assert.equal(windowFor(second.id), window);
      assert.equal(sql(`SELECT floor(extract(epoch FROM max(gsc_ready_at)-min(gsc_ready_at))) BETWEEN 299 AND 301 FROM ccpun_admin.seo_post_publish_step WHERE gsc_window_id=${quote(window)}`), 't');
      assert.equal(claim(randomUUID()), '', 'no early submit');
      assert.equal(sql("SELECT coalesce(sum(submits),0) FROM ccpun_admin.seo_sitemap_submit_ledger WHERE provider='gsc'"), '0');
      ageWindow(window, 26);
      const late = seed('after-cutoff'); assert.equal(enroll(late), 'deferred');
      assert.notEqual(windowFor(late.id), window, 'a late publication cannot join a closed window even before its claim');
      const lease = randomUUID(); assert.equal(claim(lease), window);
      assert.equal(begin(window, lease, [first.id, second.id]), 'reserved');
      assert.equal(begin(window, lease, [first.id, second.id]), 'denied', 'a reservation cannot be replayed');
      assert.equal(claim(randomUUID()), '', 'another lease cannot claim the processing window');
      // Simulate the provider acknowledgement; the executable test never calls a provider.
      assert.equal(finish(window, lease, 'succeeded'), 't');
      assert.equal(claim(randomUUID()), '');
      assert.equal(sql("SELECT sum(submits) FROM ccpun_admin.seo_sitemap_submit_ledger WHERE provider='gsc'"), '1');
      assert.equal(sql(`SELECT count(*) FROM ccpun_admin.seo_post_publish_step WHERE gsc_window_id=${quote(window)} AND state='succeeded'`), '2');
      assert.equal(sql(`SELECT count(*) FROM ccpun_admin.seo_post_publish_job WHERE job_id=ANY(ARRAY[${quote(first.id)},${quote(second.id)}]::uuid[]) AND gsc_submit_at IS NOT NULL`), '2');
      assert.equal(sql(`SELECT state FROM ccpun_admin.seo_post_publish_step WHERE job_id=${quote(late.id)} AND step='gsc-sitemap-submit'`), 'pending');
    });

    await t.test('uncertain GSC allows new IndexNow and a confirmed read covers its members', () => {
      reset();
      const first = seed('uncertain'); assert.equal(enroll(first), 'deferred');
      const window = windowFor(first.id); ageWindow(window, 31);
      const lease = randomUUID(); assert.equal(claim(lease), window);
      assert.equal(begin(window, lease, [first.id]), 'reserved'); assert.equal(finish(window, lease, 'uncertain'), 't');
      const next = seed('independent-indexnow'); assert.equal(enroll(next), 'deferred');
      assert.equal(worker(`SELECT ccpun_admin.seo_reserve_notification(${quote(next.id)},${quote(next.lease)},'indexnow',800)`), 'reserved');
      ageWindow(windowFor(next.id), 31);
      assert.equal(claim(randomUUID()), '', 'uncertainty fences GSC');
      sql(`UPDATE ccpun_admin.seo_gsc_window SET started_at=clock_timestamp()-interval '31 minutes' WHERE window_id=${quote(window)}`);
      assert.equal(reconcile(window, true), 'succeeded');
      assert.equal(sql(`SELECT state FROM ccpun_admin.seo_post_publish_step WHERE job_id=${quote(first.id)} AND step='gsc-sitemap-submit'`), 'succeeded');
      assert.equal(sql(`SELECT gsc_submit_at IS NOT NULL FROM ccpun_admin.seo_post_publish_job WHERE job_id=${quote(first.id)}`), 't');
    });

    await t.test('three unconfirmed reads release one retry, preserve debounce and never release a second retry', () => {
      reset();
      const job = seed('bounded-retry'); assert.equal(enroll(job), 'deferred');
      const window = windowFor(job.id); ageWindow(window, 31);
      let lease = randomUUID(); assert.equal(claim(lease), window);
      assert.equal(begin(window, lease, [job.id]), 'reserved'); assert.equal(finish(window, lease, 'uncertain'), 't');
      sql(`UPDATE ccpun_admin.seo_gsc_window SET started_at=clock_timestamp()-interval '91 minutes' WHERE window_id=${quote(window)}`);
      assert.equal(reconcile(window, false), 'uncertain'); assert.equal(reconcile(window, false), 'uncertain');
      assert.equal(reconcile(window, false), 'pending');
      assert.equal(sql(`SELECT retry_released FROM ccpun_admin.seo_gsc_window WHERE window_id=${quote(window)}`), 't');
      lease = randomUUID(); assert.equal(claim(lease), window);
      assert.equal(begin(window, lease, [job.id]), 'retry-later', 'retry still respects the 30-minute ledger debounce');
      sql(`UPDATE ccpun_admin.seo_sitemap_submit_ledger SET last_attempt_at=clock_timestamp()-interval '31 minutes' WHERE provider='gsc';
        UPDATE ccpun_admin.seo_gsc_window SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE window_id=${quote(window)}`);
      lease = randomUUID(); assert.equal(claim(lease), window);
      sql("UPDATE ccpun_admin.seo_sitemap_submit_ledger SET submits=20 WHERE provider='gsc'");
      assert.equal(begin(window, lease, [job.id]), 'budget-exhausted', 'released retry cannot bypass the daily budget');
      sql(`UPDATE ccpun_admin.seo_sitemap_submit_ledger SET submits=1 WHERE provider='gsc';
        UPDATE ccpun_admin.seo_gsc_window SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE window_id=${quote(window)}`);
      lease = randomUUID(); assert.equal(claim(lease), window);
      assert.equal(begin(window, lease, [job.id]), 'reserved'); assert.equal(finish(window, lease, 'uncertain'), 't');
      sql(`UPDATE ccpun_admin.seo_gsc_window SET started_at=clock_timestamp()-interval '91 minutes' WHERE window_id=${quote(window)}`);
      assert.equal(reconcile(window, false), 'uncertain'); assert.equal(reconcile(window, false), 'uncertain');
      assert.equal(reconcile(window, false), 'blocked');
      assert.equal(claim(randomUUID()), '');
      assert.equal(sql("SELECT sum(submits) FROM ccpun_admin.seo_sitemap_submit_ledger WHERE provider='gsc'"), '2');
      assert.equal(sql(`SELECT last_error_code FROM ccpun_admin.seo_gsc_window WHERE window_id=${quote(window)}`), 'gsc-uncertain-exhausted');
    });

    await t.test('an expired third reconciliation lease releases once instead of deadlocking', () => {
      reset();
      const job = seed('third-claim-crash'); assert.equal(enroll(job), 'deferred');
      const window = windowFor(job.id); ageWindow(window, 31);
      const lease = randomUUID(); assert.equal(claim(lease), window);
      assert.equal(begin(window, lease, [job.id]), 'reserved'); assert.equal(finish(window, lease, 'uncertain'), 't');
      sql(`UPDATE ccpun_admin.seo_gsc_window SET state='reconciling',reconcile_attempts=3,
        started_at=clock_timestamp()-interval '91 minutes',lease_id=${quote(randomUUID())},lease_until=clock_timestamp()-interval '1 second'
        WHERE window_id=${quote(window)}`);
      assert.equal(worker(`SELECT window_id FROM ccpun_admin.seo_claim_gsc_reconciliation(${quote(randomUUID())},20)`), '');
      assert.equal(sql(`SELECT state||':'||retry_released::text FROM ccpun_admin.seo_gsc_window WHERE window_id=${quote(window)}`), 'pending:true');
      assert.equal(sql(`SELECT state FROM ccpun_admin.seo_post_publish_step WHERE job_id=${quote(job.id)} AND step='gsc-sitemap-submit'`), 'pending');
      assert.equal(claim(randomUUID()), window, 'a recovered retry is claimable');
    });

    await t.test('v2 reapply adopts legacy unresolved writes and preserves the GSC-only fence', () => {
      reset();
      const legacyJobs = [seed('old-uncertain'), seed('old-processing')];
      for (const [index, job] of legacyJobs.entries()) sql(`INSERT INTO ccpun_admin.seo_post_publish_step(job_id,step,state,attempts,started_at,lease_until)
        VALUES(${quote(job.id)},'gsc-sitemap-submit',${quote(index ? 'processing' : 'uncertain')},1,clock_timestamp()-interval '1 hour',clock_timestamp()-interval '1 second')`);
      sql(v2);
      const adopted = sql("SELECT string_agg(gsc_window_id::text,',' ORDER BY job_id) FROM ccpun_admin.seo_post_publish_step WHERE step='gsc-sitemap-submit'");
      assert.equal(sql("SELECT count(*) FROM ccpun_admin.seo_post_publish_step WHERE step='gsc-sitemap-submit' AND gsc_window_id IS NOT NULL AND state='uncertain'"), '2');
      assert.equal(sql("SELECT bool_and(next_reconcile_at>clock_timestamp()+interval '29 minutes') FROM ccpun_admin.seo_gsc_window"), 't');
      sql(v2);
      assert.equal(sql("SELECT string_agg(gsc_window_id::text,',' ORDER BY job_id) FROM ccpun_admin.seo_post_publish_step WHERE step='gsc-sitemap-submit'"), adopted, 'reapply must not recreate adopted uncertainty');
      assert.equal(enroll(legacyJobs[0]), 'gsc-reconciling');
      const fresh = seed('fresh-after-upgrade'); assert.equal(enroll(fresh), 'deferred'); ageWindow(windowFor(fresh.id), 31);
      assert.equal(claim(randomUUID()), '', 'legacy uncertainty prevents a new GSC write');
      assert.equal(worker(`SELECT ccpun_admin.seo_reserve_notification(${quote(fresh.id)},${quote(fresh.lease)},'indexnow',800)`), 'reserved');
    });
  } finally {
    if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    rmSync(directory, { recursive: true, force: true });
  }
});
