-- Additive migration after 001_private_state.sql and 002_research_inbox.sql.
-- Central source of truth for existing bookings. Only the signed-in owner can read.
create table if not exists public.artist_commitments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, venue text not null, event_date date not null,
 status text not null default 'confirmed' check(status in ('confirmed','cancelled')),
 notes text not null default '',
 created_at timestamptz not null default now(),
 unique(user_id, venue, event_date)
);
create index if not exists artist_commitments_owner_date on public.artist_commitments(user_id,event_date);
alter table public.artist_commitments enable row level security;
revoke all on public.artist_commitments from anon,authenticated;
grant select on public.artist_commitments to authenticated;
drop policy if exists commitments_owner_select on public.artist_commitments;
create policy commitments_owner_select on public.artist_commitments for select to authenticated using(user_id=(select auth.uid()));

-- A known, user-confirmed commitment. This adds a record only for the signed-in account.
create or replace function public.record_confirmed_kulaks()
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.artist_commitments(user_id,title,venue,event_date,status,notes)
 values(auth.uid(),'DANYUL live performance','Kulak''s Woodshed','2026-11-14','confirmed',
 'User-confirmed date and venue. Set length, arrival, equipment, and event format unverified.')
 on conflict(user_id,venue,event_date) do nothing;
end $$;
revoke all on function public.record_confirmed_kulaks() from public,anon;
grant execute on function public.record_confirmed_kulaks() to authenticated;
