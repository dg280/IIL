-- Célestine — schéma initial (M1) : comptes famille, profils enfants pseudo,
-- consentement parental, quotas GenAI serveur, publications par lien.
-- Région du projet : UE (eu-central / eu-west) — non négociable (RGPD-enfants).
-- Minimisation : AUCUN prénom d'enfant, AUCUN email d'enfant en base — le
-- parent est le compte (auth.users), l'enfant est un pseudo.

-- ─────────────────────────────────────────────────────────── familles/profils

-- Le parent EST l'utilisateur Supabase (magic link sur son email).
-- Un profil enfant = un pseudo + réglages, rattaché au parent.
create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users (id) on delete cascade,
  pseudo text not null check (char_length(pseudo) between 1 and 20),
  universe text not null default 'sakura',
  -- interrupteurs du portail parental (doc 07)
  genai_enabled boolean not null default true,
  sharing_enabled boolean not null default true,
  genai_daily_quota int not null default 20 check (genai_daily_quota between 0 and 200),
  created_at timestamptz not null default now()
);

-- Consentement parental vérifiable (RGPD art. 8) : horodaté, versionné, révocable.
create table public.parental_consents (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users (id) on delete cascade,
  child_profile_id uuid not null references public.child_profiles (id) on delete cascade,
  policy_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- ─────────────────────────────────────────────────────────── quotas GenAI

-- Compteur journalier par profil, incrémenté par l'Edge Function (service role).
create table public.genai_usage (
  child_profile_id uuid not null references public.child_profiles (id) on delete cascade,
  day date not null default current_date,
  images int not null default 0,
  primary key (child_profile_id, day)
);

-- incrément atomique + verdict quota, appelé par l'Edge Function uniquement
create or replace function public.genai_try_consume(p_profile uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  q int;
  used int;
begin
  select genai_daily_quota into q from child_profiles where id = p_profile and genai_enabled;
  if q is null then
    return false; -- profil inconnu ou GenAI coupée par le parent
  end if;
  insert into genai_usage (child_profile_id, day, images)
  values (p_profile, current_date, 1)
  on conflict (child_profile_id, day)
  do update set images = genai_usage.images + 1
  returning images into used;
  if used > q then
    -- au-delà du quota : on rend le crédit et on refuse
    update genai_usage set images = images - 1
    where child_profile_id = p_profile and day = current_date;
    return false;
  end if;
  return true;
end;
$$;

-- ─────────────────────────────────────────────────────────── publications

-- Snapshot immuable d'une histoire publiée (doc 02) : lisible par lien non
-- devinable (slug aléatoire), dé-publiable instantanément.
create table public.published_stories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default encode(gen_random_bytes(16), 'hex'),
  child_profile_id uuid not null references public.child_profiles (id) on delete cascade,
  title text not null check (char_length(title) <= 80),
  author_pen text not null default '' check (char_length(author_pen) <= 20),
  -- le bundle complet (histoire + avatars), même format que le partage CEL1.
  snapshot jsonb not null,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  unpublished_at timestamptz
);

-- Réactions stickers (liste blanche) + fins atteintes — anonymes (doc 07).
create table public.story_reactions (
  id bigint generated always as identity primary key,
  story_id uuid not null references public.published_stories (id) on delete cascade,
  sticker text not null check (sticker in ('💖', '😂', '😱', '🌟', '👏')),
  created_at timestamptz not null default now()
);

create table public.story_endings (
  story_id uuid not null references public.published_stories (id) on delete cascade,
  ending_id text not null,
  reached int not null default 0,
  primary key (story_id, ending_id)
);

-- ─────────────────────────────────────────────────────────── RLS

alter table public.child_profiles enable row level security;
alter table public.parental_consents enable row level security;
alter table public.genai_usage enable row level security;
alter table public.published_stories enable row level security;
alter table public.story_reactions enable row level security;
alter table public.story_endings enable row level security;

-- Le parent voit et gère SA famille, rien d'autre.
create policy parent_owns_profiles on public.child_profiles
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());
create policy parent_owns_consents on public.parental_consents
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());
create policy parent_reads_usage on public.genai_usage
  for select using (exists (select 1 from child_profiles c where c.id = child_profile_id and c.parent_id = auth.uid()));
create policy parent_owns_stories on public.published_stories
  for all using (exists (select 1 from child_profiles c where c.id = child_profile_id and c.parent_id = auth.uid()))
  with check (exists (select 1 from child_profiles c where c.id = child_profile_id and c.parent_id = auth.uid()));
create policy parent_reads_reactions on public.story_reactions
  for select using (exists (
    select 1 from published_stories s join child_profiles c on c.id = s.child_profile_id
    where s.id = story_id and c.parent_id = auth.uid()));
create policy parent_reads_endings on public.story_endings
  for select using (exists (
    select 1 from published_stories s join child_profiles c on c.id = s.child_profile_id
    where s.id = story_id and c.parent_id = auth.uid()));

-- Lecture PUBLIQUE d'une histoire publiée : uniquement via la fonction (par
-- slug complet, jamais de listing) — le player invité n'a pas de compte.
create or replace function public.get_published_story(p_slug text)
returns table (title text, author_pen text, snapshot jsonb)
language sql
security definer
set search_path = public
stable
as $$
  select title, author_pen, snapshot
  from published_stories
  where slug = p_slug and published;
$$;

-- Réaction sticker + fin atteinte par une invitée anonyme (via slug uniquement).
create or replace function public.react_to_story(p_slug text, p_sticker text, p_ending text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  select id into sid from published_stories where slug = p_slug and published;
  if sid is null then
    return; -- lien mort : silencieux
  end if;
  if p_sticker is not null then
    insert into story_reactions (story_id, sticker) values (sid, p_sticker);
  end if;
  if p_ending is not null then
    insert into story_endings (story_id, ending_id, reached) values (sid, p_ending, 1)
    on conflict (story_id, ending_id) do update set reached = story_endings.reached + 1;
  end if;
end;
$$;

-- Droit à l'effacement : la suppression du compte parent (auth.users) cascade
-- sur tout (profils → consentements, usage, publications, réactions, stats).
