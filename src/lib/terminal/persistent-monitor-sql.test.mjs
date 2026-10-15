/** Opt-in, LOCAL disposable database only. Never uses application DB credentials. */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const database = process.env.TERMINAL_MONITOR_TEST_DATABASE;
const enabled = Boolean(database);
if (enabled && !/^neutralis_monitor_test_[a-z0-9_]{1,45}$/.test(database)) throw new Error("TERMINAL_MONITOR_TEST_DATABASE must name a dedicated neutralis_monitor_test_* database.");
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const market = '{"kind":"market","ticker":"KXTEST-26-OCT"}';
const pair = '{"kind":"opportunity","candidateId":"v1~KXTEST-26-OCT~test-slug","pairDirection":"kalshi_yes_polymarket_no"}';
function sql(statement, { user, worker = false, allowFailure = false } = {}) {
  const prefix = worker ? "set role service_role; set request.jwt.claim.role = 'service_role';" : user ? `set role authenticated; set request.jwt.claim.sub = '${user}'; set request.jwt.claim.role = 'authenticated';` : "";
  return new Promise((resolve, reject) => {
    // Local Unix socket and database name are fixed/validated; PGHOST/PGDATABASE
    // and production Supabase URLs cannot redirect this test to another server.
    const child = spawn("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", "/tmp", "-p", "5432", "-U", "postgres", "-d", database], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => {
      const result = { code, stdout: stdout.trim(), stderr: stderr.trim() };
      if (code !== 0 && !allowFailure) reject(new Error(`Local SQL failed: ${stderr.trim()}`));
      else resolve(result);
    });
    child.stdin.end(`${prefix}\n${statement}\n`);
  });
}
async function scalar(statement, options) { return (await sql(statement, options)).stdout; }
async function json(statement, options) { return JSON.parse(await scalar(statement, options)); }
async function expectFailure(statement, pattern, options = {}) {
  const result = await sql(statement, { ...options, allowFailure: true });
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, pattern);
}
async function create(user, label, target = market, direction = "above", threshold = 0.6) {
  return json(`select public.terminal_monitor_create('${target}'::jsonb,'${label}','${direction}',${threshold});`, { user });
}
async function claim(limit = 10) { return json(`select public.terminal_monitor_claim_batch(${limit});`, { worker: true }); }
async function finish(run, checked = 0, failed = 0) {
  return scalar(`select public.terminal_monitor_finish_run('${run.runId}',${checked},${failed});`, { worker: true });
}
async function complete(job, value, observed = "clock_timestamp()", status = "ok") {
  return json(`select public.terminal_monitor_complete('${job.id}',${job.version},'${job.lease_token}','${status}',${value === null ? "null" : value},${observed});`, { worker: true });
}
async function due(id) { await sql(`update public.terminal_monitors set next_check_at=clock_timestamp()-interval '1 second' where id='${id}';`); }

await test("persistent monitor migration on an explicitly selected disposable local PostgreSQL database", { skip: !enabled }, async (t) => {
  // Intentionally fails on a reused/nonempty DB. These auth stubs exist only in
  // this disposable database; no cluster role is created, changed, or removed.
  await sql(`
    do $$ begin
      if exists(select 1 from pg_namespace where nspname='auth')
        or exists(select 1 from pg_tables where schemaname='public') then
        raise exception 'Disposable monitor test database must be empty';
      end if;
      if (select count(*) from pg_roles where rolname in ('anon','authenticated','service_role')) <> 3 then
        raise exception 'Existing anon/authenticated/service_role roles are required; this test does not create roles';
      end if;
    end $$;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.role() to anon,authenticated,service_role;
    insert into auth.users(id) values ('${A}'),('${B}'),('${C}');
  `);
  await sql(await readFile(new URL("../../../supabase/migrations/20261015_terminal_monitors.sql", import.meta.url), "utf8"));

  await t.test("server-owned fields and worker RPCs cannot be written or invoked by authenticated users", async () => {
    assert.equal(await scalar("select count(*) from public.terminal_monitor_worker where completed_at is null;", { user: A }), "1");
    await expectFailure(`insert into public.terminal_monitors(user_id,target,label,direction,threshold) values ('${A}','${market}','forged','above',0.5);`, /permission denied/, { user: A });
    await expectFailure("update public.terminal_monitor_worker set completed_at=now();", /permission denied/, { user: A });
    await expectFailure("select public.terminal_monitor_claim_batch(10);", /permission denied/, { user: A });
    await expectFailure("select public.terminal_monitor_finish_run(gen_random_uuid(),0,0);", /permission denied/, { user: A });
    await expectFailure(`select public.terminal_monitor_create('${market}','anon','above',0.5);`, /MONITOR_UNAUTHENTICATED/, { user: "" });
  });

  await t.test("direct RPC validation rejects malformed authority, null pair direction, invalid numeric limits and extra fields", async () => {
    for (const [target, threshold] of [
      ['{"kind":"market","ticker":"KXTEST","user_id":"forged"}', "0.5"],
      ['{"kind":"market","ticker":null}', "0.5"],
      ['{"kind":"opportunity","candidateId":"v1~KXTEST~test","pairDirection":null}', "0.05"],
      ['{"kind":"opportunity","candidateId":"other","pairDirection":"kalshi_yes_polymarket_no"}', "0.05"],
      [market, "-0.1"], [market, "1.1"], [market, "0.12345"], [market, "'NaN'::numeric"], [market, "null"],
    ]) await expectFailure(`select public.terminal_monitor_create('${target}','invalid','above',${threshold});`, /MONITOR_INVALID/, { user: A });
    assert.equal(await scalar("select count(*) from public.terminal_monitors;"), "0");
  });

  await t.test("30 concurrent create transactions enforce the per-user quota of 25", async () => {
    const results = await Promise.all(Array.from({ length: 30 }, (_, index) => sql(`select public.terminal_monitor_create('${market}','quota-${index}','above',0.6);`, { user: A, allowFailure: true })));
    assert.equal(results.filter((result) => result.code === 0).length, 25);
    const denied = results.filter((result) => result.code !== 0);
    assert.equal(denied.length, 5);
    for (const result of denied) assert.match(result.stderr, /MONITOR_QUOTA/);
    assert.equal(await scalar(`select count(*) from public.terminal_monitors where user_id='${A}';`), "25");
    await sql(`update public.terminal_monitors set state='paused' where user_id='${A}';`);
  });

  let first, paired;
  await t.test("RLS and owner RPCs isolate users while independent users retain their own quota", async () => {
    first = await create(B, "owned market");
    paired = await create(C, "owned fixed pair", pair, "above", 0.03);
    assert.equal(await scalar("select count(*) from public.terminal_monitors;", { user: B }), "1");
    assert.equal(await scalar("select count(*) from public.terminal_monitors;", { user: C }), "1");
    assert.equal(await scalar(`select count(*) from public.terminal_monitors where id='${first.id}';`, { user: A }), "0");
    await expectFailure(`select public.terminal_monitor_update('${first.id}',1,'pause');`, /MONITOR_NOT_FOUND/, { user: A });
    await expectFailure(`select public.terminal_monitor_delete('${first.id}',1);`, /MONITOR_NOT_FOUND/, { user: A });
    await expectFailure(`select public.terminal_monitor_update('${first.id}',99,'pause');`, /MONITOR_VERSION_CONFLICT/, { user: B });
  });

  let firstRun, oldMarketJob, pairJob;
  await t.test("concurrent worker claims serialize one bounded run and do not mark a completed heartbeat", async () => {
    const runs = await Promise.all([claim(), claim()]);
    assert.equal(runs.filter((run) => run.busy === true).length, 1);
    firstRun = runs.find((run) => !run.busy);
    assert.equal(firstRun.jobs.length, 2);
    oldMarketJob = firstRun.jobs.find((job) => job.id === first.id);
    pairJob = firstRun.jobs.find((job) => job.id === paired.id);
    assert.ok(oldMarketJob.lease_token);
    assert.equal(await scalar("select count(*) from public.terminal_monitor_worker where completed_at is null;"), "1");
  });

  await t.test("pause invalidates an in-flight quote, pair trigger inserts exactly one immutable alert, and alerts obey RLS", async () => {
    const paused = await json(`select public.terminal_monitor_update('${first.id}',1,'pause');`, { user: B });
    assert.equal(paused.version, 2);
    assert.deepEqual(await complete(oldMarketJob, 0.9), { applied: false, triggered: false });
    const result = await complete(pairJob, 0.04);
    assert.equal(result.applied, true); assert.equal(result.triggered, true);
    assert.deepEqual(await complete(pairJob, 0.04), { applied: false, triggered: false });
    const alert = await json(`select row_to_json(a) from public.terminal_monitor_alerts a where monitor_id='${paired.id}';`, { user: C });
    assert.equal(alert.arm_version, 1); assert.equal(alert.target.pairDirection, "kalshi_yes_polymarket_no");
    assert.equal(alert.observed_value, 0.04); assert.equal(alert.threshold, 0.03);
    assert.equal(await scalar("select count(*) from public.terminal_monitor_alerts;", { user: B }), "0");
    await expectFailure(`delete from public.terminal_monitor_alerts where id='${alert.id}';`, /permission denied/, { user: C });
    assert.equal(await finish(firstRun, 1), "t");
    assert.equal(await finish(firstRun, 1), "f");
    assert.equal(await scalar("select count(*) from public.terminal_monitor_worker where completed_at is not null;"), "1");
  });

  await t.test("rearm increments arm identity and old deliveries cannot trigger the new arm", async () => {
    const rearmed = await json(`select public.terminal_monitor_update('${paired.id}',2,'rearm');`, { user: C });
    assert.equal(rearmed.arm_version, 2); assert.equal(rearmed.version, 3);
    assert.deepEqual(await complete(pairJob, 0.1), { applied: false, triggered: false });
    const run = await claim();
    const job = run.jobs.find((value) => value.id === paired.id);
    const result = await complete(job, 0.05);
    assert.equal(result.triggered, true);
    assert.equal(await scalar(`select count(*) from public.terminal_monitor_alerts where monitor_id='${paired.id}';`), "2");
    assert.equal(await finish(run, 1), "t");
  });

  await t.test("fresh successful observations survive stale, future, unavailable and non-monotonic responses without alerts", async () => {
    await json(`select public.terminal_monitor_update('${first.id}',2,'resume');`, { user: B });
    let run = await claim(); let job = run.jobs.find((value) => value.id === first.id);
    assert.equal((await complete(job, 0.4)).triggered, false);
    await finish(run, 1);
    const saved = await json(`select row_to_json(m) from public.terminal_monitors m where id='${first.id}';`);
    for (const [value, time, status] of [[0.9, "clock_timestamp()-interval '60 seconds'", "ok"], [0.9, "clock_timestamp()+interval '60 seconds'", "ok"], [null, "null", "unavailable"], [0.9, `'${saved.last_observed_at}'::timestamptz-interval '1 second'`, "ok"]]) {
      await due(first.id); run = await claim(); job = run.jobs.find((value) => value.id === first.id);
      const result = await complete(job, value, time, status);
      assert.equal(result.applied, true); assert.equal(result.triggered, false);
      await finish(run, 1, 1);
      const retained = await json(`select row_to_json(m) from public.terminal_monitors m where id='${first.id}';`);
      assert.equal(retained.last_value, 0.4); assert.equal(retained.last_observed_at, saved.last_observed_at);
      assert.equal(retained.last_check_status, "unavailable");
    }
    assert.equal(await scalar(`select count(*) from public.terminal_monitor_alerts where monitor_id='${first.id}';`), "0");
  });

  await t.test("expired monitor and run leases cannot apply a quote or advance heartbeat", async () => {
    await due(first.id); const run = await claim(); const job = run.jobs.find((value) => value.id === first.id);
    const before = await scalar("select completed_at::text from public.terminal_monitor_worker;");
    await sql(`update public.terminal_monitors set lease_until=clock_timestamp()-interval '1 second' where id='${first.id}'; update public.terminal_monitor_worker set lease_until=clock_timestamp()-interval '1 second';`);
    assert.deepEqual(await complete(job, 0.9), { applied: false, triggered: false });
    assert.equal(await finish(run, 1), "f");
    assert.equal(await scalar("select completed_at::text from public.terminal_monitor_worker;"), before);
  });

  await t.test("deleting after a claim fences delivery and owner deletion removes associated alert records", async () => {
    const run = await claim(); const job = run.jobs.find((value) => value.id === first.id);
    assert.equal(await scalar(`select public.terminal_monitor_delete('${first.id}',3);`, { user: B }), "t");
    assert.deepEqual(await complete(job, 0.9), { applied: false, triggered: false });
    await finish(run, 0);
    assert.equal(await scalar(`select public.terminal_monitor_delete('${paired.id}',4);`, { user: C }), "t");
    assert.equal(await scalar(`select count(*) from public.terminal_monitor_alerts where monitor_id='${paired.id}';`), "0");
  });

  await t.test("missing worker singleton fails closed rather than manufacturing a completed run", async () => {
    await sql("delete from public.terminal_monitor_worker;");
    await expectFailure("select public.terminal_monitor_claim_batch(10);", /MONITOR_STORAGE_UNAVAILABLE/, { worker: true });
  });
});
