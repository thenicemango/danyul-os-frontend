-- Safe role simulation. Paste into Supabase SQL Editor after creating TWO test users
-- via Authentication > Users > Add user. Replace placeholders with their Auth UUIDs.
-- Run inside a transaction so no dummy records persist. Expected: user B sees zero A rows.
begin;
insert into public.research_opportunities
 (user_id,fingerprint,title,category,source_name,source_url,summary)
values ('REPLACE_WITH_USER_A_UUID','temporary-rls-test-2026','TEST ONLY Jazz showcase','showcase',
 'RLS Test','https://example.org/rls-test','This record is rolled back')
on conflict (user_id,fingerprint) do nothing;
insert into public.artist_states(user_id,state,revision)
values ('REPLACE_WITH_USER_A_UUID','{"version":1,"songs":[],"opportunities":[],"approvals":[],"experiments":[],"contacts":[],"shows":[],"metrics":[],"tasks":[],"activity":[],"settings":{}}'::jsonb,1)
on conflict (user_id) do nothing;
set local role authenticated;
select set_config('request.jwt.claim.sub','REPLACE_WITH_USER_B_UUID',true);
select set_config('request.jwt.claim.role','authenticated',true);
-- Expect count = 0 for the specific test record:
select count(*) as should_be_zero from public.research_opportunities
where fingerprint='temporary-rls-test-2026' and user_id='REPLACE_WITH_USER_A_UUID';
-- Expect count = 0 for user A's artist state as seen by user B:
select count(*) as artist_state_should_be_zero from public.artist_states
where user_id='REPLACE_WITH_USER_A_UUID';
-- Expect permission denied (this role cannot write research rows):
-- INSERT deliberately omitted from executable transaction; run manually if desired.
rollback;
