-- Jeu d'essai des politiques RLS : à exécuter après 00_stubs.sql et la migration.

\set ON_ERROR_STOP on
insert into auth.users values ('11111111-1111-1111-1111-111111111111','alice@example.org'),
  ('22222222-2222-2222-2222-222222222222','bob@example.org'),
  ('33333333-3333-3333-3333-333333333333','carol@example.org');

-- Alice creates her library and content
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@example.org"}', true);
select count(*) as alice_libraries from public.ensure_library();
select count(*) as alice_libraries_again from public.ensure_library();
\gset
create temp table ctx as select id as lib from public.libraries limit 1;
select lib as alice_lib from ctx \gset
insert into public.tag_families (library_id, name) select lib, 'Objectifs structurels' from ctx;
insert into public.tags (family_id, name) select f.id, 'Renforcement MI' from public.tag_families f;
insert into public.exercises (library_id, name) select lib, 'Assis-debout' from ctx;
insert into public.exercise_tags (exercise_id, tag_id) select e.id, t.id from public.exercises e, public.tags t;
select 'alice sees' as who, (select count(*) from public.exercises) as exercises, (select count(*) from public.tags) as tags, (select library_id is not null from public.tags limit 1) as tag_lib_set;
insert into public.library_invitations (library_id, email, role) select lib, 'Bob@Example.org', 'reader' from ctx;
insert into storage.objects (bucket_id, name) select 'media', lib || '/x/photo.jpg' from ctx;
select * from public.library_people((select lib from ctx));
commit;

-- Bob, before accepting: sees nothing of Alice's
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@example.org"}', true);
-- note: ensure_library accepts the invitation
select count(*) as bob_libraries from public.ensure_library();
select 'bob sees' as who, (select count(*) from public.exercises) as exercises;

commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@example.org"}', true);
select 'bob storage read' as who, count(*) from storage.objects;
-- Bob is reader: writes must fail
do $$ begin
  insert into public.exercises (library_id, name) select l.id, 'Pirate' from public.libraries l where l.owner_id = '11111111-1111-1111-1111-111111111111';
  raise exception 'FAIL: reader could insert';
exception when insufficient_privilege then raise notice 'OK: reader insert denied'; end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) select 'media', l.id || '/x/evil.jpg' from public.libraries l where l.owner_id = '11111111-1111-1111-1111-111111111111';
  raise exception 'FAIL: reader could upload';
exception when insufficient_privilege then raise notice 'OK: reader upload denied'; end $$;
commit;

-- Carol: a stranger sees nothing
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","email":"carol@example.org"}', true);
select count(*) as carol_libraries_before from public.libraries;
select count(*) as carol_libraries from public.ensure_library();
select 'carol sees' as who, (select count(*) from public.exercises) as exercises, (select count(*) from public.tags) as tags, (select count(*) from storage.objects) as objects;
do $$ declare alice_lib uuid; n integer; begin
  -- Alice's library id is unknown to Carol through RLS; fetch it as the function owner would not: use a definer-free trick (hardcode via members table is impossible), so query libraries as superuser is not available here. Instead try every uuid visible in exercise_tags? none visible. Use invitation path instead:
  insert into public.library_members (library_id, user_id, role)
    select l.id, '33333333-3333-3333-3333-333333333333', 'editor' from public.libraries l where l.owner_id <> auth.uid();
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL: carol could add herself'; end if;
  raise notice 'OK: carol sees no foreign library to join (% rows)', n;
end $$;
-- Direct attempt against Alice's id (passed in by the test harness)
create temp table foreign_lib as select :'alice_lib'::uuid as id;
do $$ begin
  insert into public.library_members (library_id, user_id, role)
    select id, '33333333-3333-3333-3333-333333333333', 'editor' from foreign_lib;
  raise exception 'FAIL: carol could add herself to a foreign library';
exception when insufficient_privilege then raise notice 'OK: self-add to foreign library denied'; end $$;
commit;

-- Alice promotes Bob to editor; Bob can then write
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@example.org"}', true);
update public.library_members set role = 'editor' where user_id = '22222222-2222-2222-2222-222222222222';
select 'members' as what, count(*) from public.library_members;
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@example.org"}', true);
insert into public.exercises (library_id, name) select l.id, 'Ajout par Bob' from public.libraries l where l.owner_id = '11111111-1111-1111-1111-111111111111';
insert into storage.objects (bucket_id, name) select 'media', l.id || '/x/bob.jpg' from public.libraries l where l.owner_id = '11111111-1111-1111-1111-111111111111';
-- cross-library tagging must fail (Bob's own exercise + Alice's tag)
do $$ declare own_lib uuid; ex uuid; begin
  select id into own_lib from public.libraries where owner_id = '22222222-2222-2222-2222-222222222222';
  insert into public.exercises (library_id, name) values (own_lib, 'Perso') returning id into ex;
  insert into public.exercise_tags (exercise_id, tag_id) select ex, t.id from public.tags t limit 1;
  raise exception 'FAIL: cross-library tag accepted';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'OK: cross-library tag rejected (%)', sqlerrm;
end $$;
select 'bob editor sees' as who, (select count(*) from public.exercises) as exercises, (select count(*) from storage.objects) as objects;
commit;
