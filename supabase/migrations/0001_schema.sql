-- =============================================================================
-- Kiné · Bibliothèque d'exercices — schéma Supabase (version 1)
--
-- À exécuter une fois dans l'éditeur SQL du projet Supabase (ou via
-- `supabase db push`). Le script est idempotent : il peut être relancé.
--
-- Modèle : une « bibliothèque » regroupe familles de tags, tags, exercices,
-- médias et fiches. Chaque utilisateur possède sa bibliothèque et peut y
-- inviter des collègues (collaborateur = editor, lecteur = reader). Toute la
-- sécurité repose sur les politiques RLS ci-dessous, pas sur l'interface.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Rôles de partage
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.member_role as enum ('owner', 'editor', 'reader');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------
create table if not exists public.libraries (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null default 'Ma bibliothèque',
  created_at  timestamptz not null default now()
);

create table if not exists public.library_members (
  library_id  uuid not null references public.libraries (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.member_role not null default 'reader',
  email       text,
  created_at  timestamptz not null default now(),
  primary key (library_id, user_id)
);

create table if not exists public.library_invitations (
  id          uuid primary key default gen_random_uuid(),
  library_id  uuid not null references public.libraries (id) on delete cascade,
  email       text not null,
  role        public.member_role not null default 'reader'
              check (role <> 'owner'),
  created_at  timestamptz not null default now()
);
create unique index if not exists library_invitations_unique
  on public.library_invitations (library_id, lower(email));

create table if not exists public.tag_families (
  id          uuid primary key default gen_random_uuid(),
  library_id  uuid not null references public.libraries (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  description text not null default '',
  color       text not null default 'sable',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists tag_families_unique_name
  on public.tag_families (library_id, lower(name));

create table if not exists public.tags (
  id          uuid primary key default gen_random_uuid(),
  library_id  uuid not null references public.libraries (id) on delete cascade,
  family_id   uuid not null references public.tag_families (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists tags_unique_name
  on public.tags (family_id, lower(name));
create index if not exists tags_family_idx on public.tags (family_id);

create table if not exists public.exercises (
  id              uuid primary key default gen_random_uuid(),
  library_id      uuid not null references public.libraries (id) on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  description     text not null default '',
  instructions    text not null default '',
  start_position  text not null default '',
  equipment       text not null default '',
  dosage_sets     text not null default '',
  dosage_reps     text not null default '',
  dosage_duration text not null default '',
  dosage_rest     text not null default '',
  difficulty      smallint check (difficulty between 1 and 5),
  variants        text not null default '',
  progressions    text not null default '',
  precautions     text not null default '',
  notes           text not null default '',
  video_url       text not null default '',
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists exercises_library_idx on public.exercises (library_id);

create table if not exists public.exercise_tags (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  tag_id      uuid not null references public.tags (id) on delete cascade,
  library_id  uuid not null references public.libraries (id) on delete cascade,
  primary key (exercise_id, tag_id)
);
create index if not exists exercise_tags_tag_idx on public.exercise_tags (tag_id);

create table if not exists public.exercise_media (
  id            uuid primary key default gen_random_uuid(),
  library_id    uuid not null references public.libraries (id) on delete cascade,
  exercise_id   uuid not null references public.exercises (id) on delete cascade,
  kind          text not null check (kind in ('image', 'video')),
  storage_path  text not null,
  mime_type     text not null default '',
  caption       text not null default '',
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists exercise_media_exercise_idx on public.exercise_media (exercise_id);

create table if not exists public.sheets (
  id          uuid primary key default gen_random_uuid(),
  library_id  uuid not null references public.libraries (id) on delete cascade,
  title       text not null,
  subtitle    text not null default '',
  options     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.sheet_items (
  sheet_id    uuid not null references public.sheets (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  library_id  uuid not null references public.libraries (id) on delete cascade,
  position    integer not null default 0,
  primary key (sheet_id, exercise_id)
);

-- -----------------------------------------------------------------------------
-- 3. Fonctions d'autorisation (utilisées par les politiques RLS)
-- -----------------------------------------------------------------------------
create or replace function public.library_role(p_library uuid)
returns public.member_role
language sql stable security definer
set search_path = public
as $$
  select m.role
  from public.library_members m
  where m.library_id = p_library and m.user_id = auth.uid()
  limit 1
$$;

create or replace function public.can_read(p_library uuid)
returns boolean language sql stable set search_path = public
as $$ select p_library is not null and public.library_role(p_library) is not null $$;

create or replace function public.can_edit(p_library uuid)
returns boolean language sql stable set search_path = public
as $$ select p_library is not null and public.library_role(p_library) in ('owner', 'editor') $$;

create or replace function public.is_owner(p_library uuid)
returns boolean language sql stable set search_path = public
as $$ select p_library is not null and public.library_role(p_library) = 'owner' $$;

-- -----------------------------------------------------------------------------
-- 4. Triggers de cohérence
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists exercises_touch on public.exercises;
create trigger exercises_touch before update on public.exercises
  for each row execute function public.touch_updated_at();

drop trigger if exists sheets_touch on public.sheets;
create trigger sheets_touch before update on public.sheets
  for each row execute function public.touch_updated_at();

-- Le propriétaire d'une bibliothèque en devient automatiquement membre.
create or replace function public.libraries_add_owner()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.library_members (library_id, user_id, role, email)
  values (new.id, new.owner_id, 'owner', (select u.email from auth.users u where u.id = new.owner_id))
  on conflict (library_id, user_id) do update set role = 'owner';
  return new;
end $$;

drop trigger if exists libraries_add_owner on public.libraries;
create trigger libraries_add_owner after insert on public.libraries
  for each row execute function public.libraries_add_owner();

-- Un tag appartient à la bibliothèque de sa famille.
create or replace function public.tags_set_library()
returns trigger language plpgsql
set search_path = public
as $$
begin
  select f.library_id into new.library_id from public.tag_families f where f.id = new.family_id;
  if new.library_id is null then raise exception 'Famille de tags inconnue'; end if;
  return new;
end $$;

drop trigger if exists tags_set_library on public.tags;
create trigger tags_set_library before insert or update of family_id on public.tags
  for each row execute function public.tags_set_library();

-- Une association exercice/tag reste dans une seule bibliothèque.
create or replace function public.exercise_tags_set_library()
returns trigger language plpgsql
set search_path = public
as $$
declare tag_library uuid;
begin
  select e.library_id into new.library_id from public.exercises e where e.id = new.exercise_id;
  select t.library_id into tag_library from public.tags t where t.id = new.tag_id;
  if new.library_id is null or tag_library is null or tag_library <> new.library_id then
    raise exception 'Le tag et l''exercice doivent appartenir à la même bibliothèque';
  end if;
  return new;
end $$;

drop trigger if exists exercise_tags_set_library on public.exercise_tags;
create trigger exercise_tags_set_library before insert or update on public.exercise_tags
  for each row execute function public.exercise_tags_set_library();

create or replace function public.exercise_media_set_library()
returns trigger language plpgsql
set search_path = public
as $$
begin
  select e.library_id into new.library_id from public.exercises e where e.id = new.exercise_id;
  if new.library_id is null then raise exception 'Exercice inconnu'; end if;
  return new;
end $$;

drop trigger if exists exercise_media_set_library on public.exercise_media;
create trigger exercise_media_set_library before insert or update of exercise_id on public.exercise_media
  for each row execute function public.exercise_media_set_library();

create or replace function public.sheet_items_set_library()
returns trigger language plpgsql
set search_path = public
as $$
declare exercise_library uuid;
begin
  select s.library_id into new.library_id from public.sheets s where s.id = new.sheet_id;
  select e.library_id into exercise_library from public.exercises e where e.id = new.exercise_id;
  if new.library_id is null or exercise_library is null or exercise_library <> new.library_id then
    raise exception 'La fiche et l''exercice doivent appartenir à la même bibliothèque';
  end if;
  return new;
end $$;

drop trigger if exists sheet_items_set_library on public.sheet_items;
create trigger sheet_items_set_library before insert or update on public.sheet_items
  for each row execute function public.sheet_items_set_library();

-- -----------------------------------------------------------------------------
-- 5. Fonctions appelées par l'application (RPC)
-- -----------------------------------------------------------------------------

-- Transforme les invitations adressées à l'e-mail de l'utilisateur connecté
-- en adhésions. Appelée à chaque ouverture de session.
create or replace function public.accept_invitations()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  mail text := lower(auth.email());
  n    integer := 0;
begin
  if uid is null or mail is null then return 0; end if;
  insert into public.library_members (library_id, user_id, role, email)
  select i.library_id, uid, i.role, mail
  from public.library_invitations i
  where lower(i.email) = mail
  on conflict (library_id, user_id) do update
    set role = excluded.role
    where public.library_members.role <> 'owner';
  get diagnostics n = row_count;
  delete from public.library_invitations where lower(email) = mail;
  return n;
end $$;

-- Garantit que l'utilisateur connecté possède une bibliothèque et renvoie
-- toutes celles auxquelles il a accès (la sienne en premier).
create or replace function public.ensure_library()
returns setof public.libraries
language plpgsql security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Authentification requise'; end if;
  perform public.accept_invitations();
  if not exists (select 1 from public.libraries l where l.owner_id = uid) then
    insert into public.libraries (owner_id, name) values (uid, 'Ma bibliothèque');
  end if;
  return query
    select l.*
    from public.libraries l
    join public.library_members m on m.library_id = l.id
    where m.user_id = uid
    order by (l.owner_id = uid) desc, l.created_at;
end $$;

-- Membres d'une bibliothèque avec leur e-mail (lecture réservée aux membres).
create or replace function public.library_people(p_library uuid)
returns table (user_id uuid, email text, role public.member_role, is_owner boolean)
language sql stable security definer
set search_path = public
as $$
  select m.user_id,
         coalesce(u.email, m.email) as email,
         m.role,
         (l.owner_id = m.user_id) as is_owner
  from public.library_members m
  join public.libraries l on l.id = m.library_id
  left join auth.users u on u.id = m.user_id
  where m.library_id = p_library and public.can_read(p_library)
  order by (l.owner_id = m.user_id) desc, coalesce(u.email, m.email)
$$;

revoke all on function public.ensure_library() from public, anon;
revoke all on function public.accept_invitations() from public, anon;
revoke all on function public.library_people(uuid) from public, anon;
grant execute on function public.ensure_library() to authenticated;
grant execute on function public.accept_invitations() to authenticated;
grant execute on function public.library_people(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.libraries           enable row level security;
alter table public.library_members     enable row level security;
alter table public.library_invitations enable row level security;
alter table public.tag_families        enable row level security;
alter table public.tags                enable row level security;
alter table public.exercises           enable row level security;
alter table public.exercise_tags       enable row level security;
alter table public.exercise_media      enable row level security;
alter table public.sheets              enable row level security;
alter table public.sheet_items         enable row level security;

-- Bibliothèques
drop policy if exists libraries_select on public.libraries;
create policy libraries_select on public.libraries for select to authenticated
  using (public.can_read(id));
drop policy if exists libraries_insert on public.libraries;
create policy libraries_insert on public.libraries for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists libraries_update on public.libraries;
create policy libraries_update on public.libraries for update to authenticated
  using (public.is_owner(id)) with check (owner_id = auth.uid());
drop policy if exists libraries_delete on public.libraries;
create policy libraries_delete on public.libraries for delete to authenticated
  using (public.is_owner(id));

-- Membres : lisibles par les membres, gérés par le propriétaire.
drop policy if exists members_select on public.library_members;
create policy members_select on public.library_members for select to authenticated
  using (public.can_read(library_id));
drop policy if exists members_insert on public.library_members;
create policy members_insert on public.library_members for insert to authenticated
  with check (public.is_owner(library_id) and role <> 'owner');
drop policy if exists members_update on public.library_members;
create policy members_update on public.library_members for update to authenticated
  using (public.is_owner(library_id) and role <> 'owner')
  with check (public.is_owner(library_id) and role <> 'owner');
drop policy if exists members_delete on public.library_members;
create policy members_delete on public.library_members for delete to authenticated
  using ((public.is_owner(library_id) and role <> 'owner') or (user_id = auth.uid() and role <> 'owner'));

-- Invitations : réservées au propriétaire.
drop policy if exists invitations_all on public.library_invitations;
create policy invitations_all on public.library_invitations for all to authenticated
  using (public.is_owner(library_id)) with check (public.is_owner(library_id));

-- Contenu : lecture pour tous les membres, écriture pour propriétaire et éditeurs.
do $$
declare t text;
begin
  foreach t in array array['tag_families', 'tags', 'exercises', 'exercise_tags', 'exercise_media', 'sheets', 'sheet_items']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.can_read(library_id))', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.can_edit(library_id))', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.can_edit(library_id)) with check (public.can_edit(library_id))', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.can_edit(library_id))', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Stockage des médias (bucket privé « media »)
--    Chemin des fichiers : <library_id>/<exercise_id>/<fichier>
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', false, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.media_library(object_name text)
returns uuid language sql immutable
as $$
  select case
    when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(object_name, '/', 1)::uuid
    else null
  end
$$;

drop policy if exists media_select on storage.objects;
create policy media_select on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.can_read(public.media_library(name)));
drop policy if exists media_insert on storage.objects;
create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.can_edit(public.media_library(name)));
drop policy if exists media_update on storage.objects;
create policy media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.can_edit(public.media_library(name)))
  with check (bucket_id = 'media' and public.can_edit(public.media_library(name)));
drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.can_edit(public.media_library(name)));
