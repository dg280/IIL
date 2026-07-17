-- Célestine — M1-3 : sauvegarde cloud des créations (« cache vidé ≠ tout perdu »).
-- Les créations d'un profil enfant : histoires (bundle jsonb), roster (jsonb),
-- images générées (Storage, préfixe = id du profil) + leurs métadonnées.
-- Politique v1 : dernière écriture gagne par histoire (updated_at) ; la
-- restauration ne détruit jamais du local plus récent (géré côté client).

create table public.synced_stories (
  child_profile_id uuid not null references public.child_profiles (id) on delete cascade,
  story_id text not null check (char_length(story_id) <= 60),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (child_profile_id, story_id)
);

create table public.synced_roster (
  child_profile_id uuid primary key references public.child_profiles (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.synced_assets (
  child_profile_id uuid not null references public.child_profiles (id) on delete cascade,
  asset_id text not null check (char_length(asset_id) <= 80),
  -- méta complète de l'asset (mime, label, universe, prompt modéré, gen…) :
  -- la restauration reconstruit l'asset à l'identique, id compris
  meta jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (child_profile_id, asset_id)
);

alter table public.synced_stories enable row level security;
alter table public.synced_roster enable row level security;
alter table public.synced_assets enable row level security;

create policy parent_owns_synced_stories on public.synced_stories
  for all using (exists (select 1 from child_profiles c where c.id = child_profile_id and c.parent_id = auth.uid()))
  with check (exists (select 1 from child_profiles c where c.id = child_profile_id and c.parent_id = auth.uid()));
create policy parent_owns_synced_roster on public.synced_roster
  for all using (exists (select 1 from child_profiles c where c.id = child_profile_id and c.parent_id = auth.uid()))
  with check (exists (select 1 from child_profiles c where c.id = child_profile_id and c.parent_id = auth.uid()));
create policy parent_owns_synced_assets on public.synced_assets
  for all using (exists (select 1 from child_profiles c where c.id = child_profile_id and c.parent_id = auth.uid()))
  with check (exists (select 1 from child_profiles c where c.id = child_profile_id and c.parent_id = auth.uid()));

-- Bucket privé des images générées ; chemin imposé : <child_profile_id>/<asset_id>
insert into storage.buckets (id, name, public) values ('creations', 'creations', false)
on conflict (id) do nothing;

create policy parent_owns_creation_files on storage.objects
  for all using (
    bucket_id = 'creations'
    and exists (
      select 1 from public.child_profiles c
      where c.id::text = split_part(name, '/', 1) and c.parent_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'creations'
    and exists (
      select 1 from public.child_profiles c
      where c.id::text = split_part(name, '/', 1) and c.parent_id = auth.uid()
    )
  );
