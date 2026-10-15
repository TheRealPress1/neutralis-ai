-- Read-only monitor scheduler. This source migration is not applied by the app.
-- The application never grants monitors any trading, credential, or messaging tools.
create table public.terminal_monitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target jsonb not null,
  label text not null check (char_length(label) between 1 and 160),
  direction text not null check (direction in ('above','below')),
  threshold numeric(8,4) not null check (threshold between -1 and 1),
  state text not null default 'watching' check (state in ('watching','paused','triggered')),
  version integer not null default 1 check (version > 0),
  arm_version integer not null default 1 check (arm_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  next_check_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_check_status text not null default 'never' check (last_check_status in ('never','ok','unavailable','closed')),
  last_value numeric,
  last_observed_at timestamptz,
  last_error text,
  triggered_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  check (jsonb_typeof(target) = 'object'),
  check (last_value is null or last_value between -1 and 1)
);
create index terminal_monitors_user on public.terminal_monitors(user_id, created_at desc);
create index terminal_monitors_due on public.terminal_monitors(next_check_at) where state = 'watching';

create table public.terminal_monitor_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  monitor_id uuid not null references public.terminal_monitors(id) on delete cascade,
  arm_version integer not null,
  target jsonb not null,
  label text not null,
  direction text not null check (direction in ('above','below')),
  threshold numeric(8,4) not null,
  observed_value numeric not null check (observed_value between -1 and 1),
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (monitor_id, arm_version)
);
create index terminal_monitor_alerts_user on public.terminal_monitor_alerts(user_id, created_at desc);
create table public.terminal_monitor_worker (
  singleton boolean primary key default true check (singleton),
  run_id uuid,
  lease_until timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  checked_count integer not null default 0,
  failure_count integer not null default 0
);
insert into public.terminal_monitor_worker(singleton) values (true);

alter table public.terminal_monitors enable row level security;
alter table public.terminal_monitor_alerts enable row level security;
alter table public.terminal_monitor_worker enable row level security;
revoke all on public.terminal_monitors, public.terminal_monitor_alerts, public.terminal_monitor_worker from anon, authenticated;
grant select on public.terminal_monitors, public.terminal_monitor_alerts, public.terminal_monitor_worker to authenticated;
grant all on public.terminal_monitors, public.terminal_monitor_alerts, public.terminal_monitor_worker to service_role;
create policy terminal_monitors_read_own on public.terminal_monitors for select to authenticated using (auth.uid() = user_id);
create policy terminal_monitor_alerts_read_own on public.terminal_monitor_alerts for select to authenticated using (auth.uid() = user_id);
create policy terminal_monitor_worker_read_health on public.terminal_monitor_worker for select to authenticated using (true);

-- Ownership comes exclusively from the authenticated session. The advisory lock
-- serializes count + insert, including concurrent creates on different servers.
create function public.terminal_monitor_create(p_target jsonb, p_label text, p_direction text, p_threshold numeric)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare owner uuid := auth.uid(); result public.terminal_monitors; key_count integer;
begin
  if owner is null then raise exception 'MONITOR_UNAUTHENTICATED'; end if;
  if p_target is null or jsonb_typeof(p_target) <> 'object' then raise exception 'MONITOR_INVALID'; end if;
  select count(*) into key_count from jsonb_object_keys(p_target);
  if p_target->>'kind' = 'market' then
    if key_count <> 2 or not (p_target ? 'ticker') or jsonb_typeof(p_target->'ticker') <> 'string'
      or (p_target->>'ticker') !~ '^[A-Z0-9][A-Z0-9.-]{0,119}$' or p_threshold < 0 then raise exception 'MONITOR_INVALID'; end if;
  elsif p_target->>'kind' = 'opportunity' then
    if key_count <> 3 or not (p_target ? 'candidateId' and p_target ? 'pairDirection')
      or jsonb_typeof(p_target->'candidateId') <> 'string'
      or (p_target->>'candidateId') !~ '^v1~[A-Z0-9][A-Z0-9.-]{0,119}~[a-z0-9][a-z0-9_-]{0,199}$'
      or jsonb_typeof(p_target->'pairDirection') is distinct from 'string'
      or coalesce(p_target->>'pairDirection','') not in ('kalshi_yes_polymarket_no','polymarket_yes_kalshi_no') then raise exception 'MONITOR_INVALID'; end if;
  else raise exception 'MONITOR_INVALID'; end if;
  if p_label is null or char_length(btrim(p_label)) not between 1 and 160 or p_label ~ '[[:cntrl:]]'
    or p_direction is null or p_direction not in ('above','below') or p_threshold is null
    or p_threshold not between -1 and 1 or p_threshold * 10000 <> trunc(p_threshold * 10000) then raise exception 'MONITOR_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('terminal-monitors:' || owner::text, 0));
  if (select count(*) from public.terminal_monitors where user_id = owner) >= 25 then raise exception 'MONITOR_QUOTA'; end if;
  insert into public.terminal_monitors(user_id,target,label,direction,threshold)
    values (owner,p_target,btrim(p_label),p_direction,p_threshold) returning * into result;
  return to_jsonb(result);
end $$;

create function public.terminal_monitor_update(p_id uuid, p_version integer, p_action text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare owner uuid := auth.uid(); current_row public.terminal_monitors;
begin
  if owner is null then raise exception 'MONITOR_UNAUTHENTICATED'; end if;
  select * into current_row from public.terminal_monitors where id=p_id and user_id=owner for update;
  if not found then raise exception 'MONITOR_NOT_FOUND'; end if;
  if p_version is null or current_row.version <> p_version then raise exception 'MONITOR_VERSION_CONFLICT'; end if;
  if p_action is null or not ((p_action='pause' and current_row.state='watching') or (p_action='resume' and current_row.state='paused') or (p_action='rearm' and current_row.state='triggered')) then raise exception 'MONITOR_STATE_CONFLICT'; end if;
  update public.terminal_monitors set state=case when p_action='pause' then 'paused' else 'watching' end,
    version=version+1, arm_version=arm_version+case when p_action='rearm' then 1 else 0 end,
    triggered_at=case when p_action='rearm' then null else triggered_at end,
    lease_token=null,lease_until=null,next_check_at=now(),updated_at=now()
    where id=p_id and user_id=owner returning * into current_row;
  return to_jsonb(current_row);
end $$;

create function public.terminal_monitor_delete(p_id uuid, p_version integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare owner uuid := auth.uid(); current_version integer;
begin
  if owner is null then raise exception 'MONITOR_UNAUTHENTICATED'; end if;
  select version into current_version from public.terminal_monitors where id=p_id and user_id=owner for update;
  if not found then raise exception 'MONITOR_NOT_FOUND'; end if;
  if p_version is null or current_version <> p_version then raise exception 'MONITOR_VERSION_CONFLICT'; end if;
  delete from public.terminal_monitors where id=p_id and user_id=owner;
  return true;
end $$;

-- Single bounded run across instances. Individual monitor leases and versions
-- independently fence completion after pause/delete/rearm or an expired worker.
create function public.terminal_monitor_claim_batch(p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare run uuid := gen_random_uuid(); worker public.terminal_monitor_worker; jobs jsonb;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'MONITOR_FORBIDDEN'; end if;
  if p_limit is null or p_limit not between 1 and 10 then raise exception 'MONITOR_INVALID'; end if;
  select * into worker from public.terminal_monitor_worker where singleton for update;
  if not found then raise exception 'MONITOR_STORAGE_UNAVAILABLE'; end if;
  if worker.lease_until > clock_timestamp() then return jsonb_build_object('busy',true,'jobs','[]'::jsonb); end if;
  update public.terminal_monitor_worker set run_id=run,lease_until=clock_timestamp()+interval '120 seconds',started_at=clock_timestamp() where singleton;
  with due as (
    select id from public.terminal_monitors where state='watching' and next_check_at<=clock_timestamp()
      and (lease_until is null or lease_until<=clock_timestamp()) order by next_check_at,id for update skip locked limit p_limit
  ), claimed as (
    update public.terminal_monitors m set lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds'
      from due where m.id=due.id returning m.*
  ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into jobs from claimed;
  return jsonb_build_object('busy',false,'runId',run,'jobs',jobs);
end $$;

create function public.terminal_monitor_complete(p_id uuid,p_version integer,p_lease_token uuid,p_status text,p_value numeric,p_observed_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare m public.terminal_monitors; valid_quote boolean; triggered boolean := false; alert_id uuid; checked timestamptz := clock_timestamp();
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'MONITOR_FORBIDDEN'; end if;
  select * into m from public.terminal_monitors where id=p_id for update;
  if not found or m.state<>'watching' or p_version is null or m.version<>p_version or p_lease_token is null
    or m.lease_token is distinct from p_lease_token or m.lease_until is null or m.lease_until<=checked then
    return jsonb_build_object('applied',false,'triggered',false);
  end if;
  if p_status is null or p_status not in ('ok','unavailable','closed') then raise exception 'MONITOR_INVALID'; end if;
  valid_quote := coalesce(p_status='ok' and p_value between case when m.target->>'kind'='market' then 0 else -1 end and 1
    and p_observed_at>=checked-interval '45 seconds' and p_observed_at<=checked+interval '5 seconds'
    and (m.last_observed_at is null or p_observed_at>=m.last_observed_at),false);
  triggered := valid_quote and case when m.direction='above' then p_value>=m.threshold else p_value<=m.threshold end;
  if triggered then
    insert into public.terminal_monitor_alerts(user_id,monitor_id,arm_version,target,label,direction,threshold,observed_value,observed_at)
      values(m.user_id,m.id,m.arm_version,m.target,m.label,m.direction,m.threshold,p_value,p_observed_at)
      on conflict(monitor_id,arm_version) do nothing returning id into alert_id;
  end if;
  update public.terminal_monitors set state=case when triggered then 'triggered' else state end,
    version=version+case when triggered then 1 else 0 end,
    triggered_at=case when triggered then checked else triggered_at end,
    last_checked_at=checked,last_check_status=case when valid_quote then 'ok' when p_status='closed' then 'closed' else 'unavailable' end,
    last_value=case when valid_quote then p_value else last_value end,
    last_observed_at=case when valid_quote then p_observed_at else last_observed_at end,
    last_error=case when valid_quote then null when p_status='closed' then 'Market is closed; no alert was triggered.' else 'Fresh public quote unavailable; no alert was triggered.' end,
    lease_token=null,lease_until=null,next_check_at=checked+interval '60 seconds',updated_at=checked where id=m.id;
  return jsonb_build_object('applied',true,'triggered',triggered,'alertId',alert_id);
end $$;

create function public.terminal_monitor_finish_run(p_run_id uuid,p_checked integer,p_failed integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'MONITOR_FORBIDDEN'; end if;
  if p_checked is null or p_failed is null or p_checked not between 0 and 10 or p_failed not between 0 and 10 then raise exception 'MONITOR_INVALID'; end if;
  update public.terminal_monitor_worker set completed_at=clock_timestamp(),checked_count=p_checked,failure_count=p_failed,lease_until=null
    where singleton and run_id=p_run_id and lease_until>clock_timestamp();
  return found;
end $$;

revoke all on function public.terminal_monitor_create(jsonb,text,text,numeric),public.terminal_monitor_update(uuid,integer,text),public.terminal_monitor_delete(uuid,integer) from public,anon;
grant execute on function public.terminal_monitor_create(jsonb,text,text,numeric),public.terminal_monitor_update(uuid,integer,text),public.terminal_monitor_delete(uuid,integer) to authenticated;
revoke all on function public.terminal_monitor_claim_batch(integer),public.terminal_monitor_complete(uuid,integer,uuid,text,numeric,timestamptz),public.terminal_monitor_finish_run(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.terminal_monitor_claim_batch(integer),public.terminal_monitor_complete(uuid,integer,uuid,text,numeric,timestamptz),public.terminal_monitor_finish_run(uuid,integer,integer) to service_role;
