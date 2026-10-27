-- DANYUL OS private per-user state. Run in Supabase SQL Editor.
create table if not exists public.artist_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision integer not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now()
);
alter table public.artist_states enable row level security;
revoke all on public.artist_states from anon;
grant select on public.artist_states to authenticated;
-- All writes go through the compare-and-swap RPC; clients cannot update rows directly.
revoke insert, update, delete on public.artist_states from authenticated;
drop policy if exists artist_states_select_own on public.artist_states;
create policy artist_states_select_own on public.artist_states
for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.save_artist_state(expected_revision integer, new_state jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  current_rev integer;
  next_rev integer;
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if expected_revision is null or expected_revision < 0 then
    raise exception 'Invalid expected revision' using errcode = '22023';
  end if;
  if new_state is null or jsonb_typeof(new_state) <> 'object'
     or new_state->>'version' <> '1'
     or pg_column_size(new_state) > 1048576 then
    raise exception 'Invalid state or state exceeds 1 MB' using errcode = '22023';
  end if;
  -- Race-safe creation. Every subsequent write takes a row lock.
  insert into public.artist_states (user_id, state, revision)
  values (uid, new_state, 1)
  on conflict (user_id) do nothing;
  if found then
    if expected_revision <> 0 then
      raise exception 'Cloud revision conflict; reload before writing' using errcode = '40001';
    end if;
    return 1;
  end if;
  select revision into current_rev from public.artist_states where user_id = uid for update;
  if current_rev is distinct from expected_revision then
    raise exception 'Cloud revision conflict; export backup and choose the correct copy' using errcode = '40001';
  end if;
  update public.artist_states
  set state = new_state, revision = revision + 1, updated_at = now()
  where user_id = uid returning revision into next_rev;
  return next_rev;
end;
$$;
revoke all on function public.save_artist_state(integer,jsonb) from public, anon;
grant execute on function public.save_artist_state(integer,jsonb) to authenticated;
