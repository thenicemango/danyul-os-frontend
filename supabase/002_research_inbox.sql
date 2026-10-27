-- Run AFTER 001_private_state.sql. Research data kept separate from v2 artist_states.
-- RLS limits the dashboard to its authenticated user's own research records.
create extension if not exists pgcrypto;

create table if not exists public.research_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null,
  title text not null check (length(title) between 5 and 250),
  category text not null check (category in ('gig','open_mic','showcase','grant','other')),
  source_name text not null,
  source_url text not null,
  summary text not null default '',
  detected_at timestamptz not null default now(),
  status text not null default 'pending_review' check (status in ('pending_review','reviewed','dismissed')),
  -- Verification happens manually; detected != eligible or currently open.
  verification text not null default 'unverified' check (verification='unverified'),
  unique (user_id, fingerprint)
);
create index if not exists research_opps_user_created on public.research_opportunities(user_id, detected_at desc);
alter table public.research_opportunities enable row level security;
revoke all on public.research_opportunities from anon;
revoke all on public.research_opportunities from authenticated;
grant select on public.research_opportunities to authenticated;
drop policy if exists research_opps_own_select on public.research_opportunities;
create policy research_opps_own_select on public.research_opportunities for select to authenticated
using (user_id = (select auth.uid()));

create table if not exists public.research_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null unique references public.research_opportunities(id) on delete cascade,
  status text not null default 'pending_review' check (status in ('pending_review','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  note text not null default 'Research suggestion only. Review source, dates, compensation and eligibility yourself.'
);
create index if not exists research_approvals_user_created on public.research_approvals(user_id, created_at desc);
alter table public.research_approvals enable row level security;
revoke all on public.research_approvals from anon;
revoke all on public.research_approvals from authenticated;
grant select on public.research_approvals to authenticated;
drop policy if exists research_approvals_own_select on public.research_approvals;
create policy research_approvals_own_select on public.research_approvals for select to authenticated
using (user_id = (select auth.uid()));

-- Dashboard only marks research as reviewed/dismissed; it cannot send or publish.
-- Security definer uses auth.uid(), never a browser-supplied target user.
create or replace function public.triage_research_opportunity(p_opportunity_id uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_status not in ('reviewed','dismissed') then raise exception 'Invalid triage status'; end if;
  update public.research_opportunities set status=p_status
  where id=p_opportunity_id and user_id=uid and status='pending_review';
  if not found then raise exception 'No pending item owned by this account'; end if;
  update public.research_approvals
  set status=p_status,decided_at=now()
  where opportunity_id=p_opportunity_id and user_id=uid and status='pending_review';
end;
$$;
revoke all on function public.triage_research_opportunity(uuid,text) from public, anon;
grant execute on function public.triage_research_opportunity(uuid,text) to authenticated;

-- The worker alone uses a privileged server credential stored in PRIVATE repo secrets;
-- client roles have no INSERT/UPDATE/DELETE rights. Research approval is NOT outreach approval.

-- Atomic approval creation: if a worker insert succeeds, the pending approval exists.
create or replace function public.research_create_approval() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.research_approvals(user_id,opportunity_id,status)
  values (new.user_id,new.id,'pending_review')
  on conflict (opportunity_id) do nothing;
  return new;
end;
$$;
drop trigger if exists research_opportunity_review_trigger on public.research_opportunities;
create trigger research_opportunity_review_trigger
after insert on public.research_opportunities
for each row execute function public.research_create_approval();
