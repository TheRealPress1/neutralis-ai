-- Durable submission claims: an uncertain exchange response must never trigger a second write.
create table if not exists public.terminal_order_submissions (
  client_order_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  status text not null check (status in ('submitting', 'unknown', 'accepted', 'rejected')),
  preview_hash text not null,
  credential_binding text not null,
  order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists terminal_order_submissions_user_idx
  on public.terminal_order_submissions (user_id, created_at desc);
create unique index if not exists terminal_order_submissions_one_unresolved
  on public.terminal_order_submissions (user_id)
  where status in ('submitting', 'unknown');
alter table public.terminal_order_submissions enable row level security;
revoke all on public.terminal_order_submissions from anon, authenticated;
grant select on public.terminal_order_submissions to authenticated;
grant all on public.terminal_order_submissions to service_role;
create policy "Users may read their own manual order submissions"
  on public.terminal_order_submissions for select to authenticated
  using (auth.uid() = user_id);
-- Only the authenticated application server may claim or advance a submission.
-- Do not grant client-side INSERT/UPDATE/DELETE: users must not clear uncertainty locks.
