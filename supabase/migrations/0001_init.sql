-- ============================================================
--  Constellations — schéma initial (Supabase / Postgres)
--  App personnelle : chaque utilisateur authentifié ne voit
--  et ne modifie QUE ses propres données (isolation via RLS).
-- ============================================================

-- ---- État de l'atlas : une ligne par utilisateur -----------
create table if not exists public.atlas_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  trees      jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.atlas_state enable row level security;

-- Un utilisateur ne peut lire/écrire que SA ligne.
create policy "read own atlas"
  on public.atlas_state for select
  using (auth.uid() = user_id);

create policy "insert own atlas"
  on public.atlas_state for insert
  with check (auth.uid() = user_id);

create policy "update own atlas"
  on public.atlas_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own atlas"
  on public.atlas_state for delete
  using (auth.uid() = user_id);

-- Tient updated_at à jour automatiquement à chaque écriture.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists atlas_state_touch on public.atlas_state;
create trigger atlas_state_touch
  before update on public.atlas_state
  for each row execute function public.touch_updated_at();

-- ---- Stockage des images des notes -------------------------
-- Bucket public en LECTURE (URL stables, non expirantes — l'URL est
-- stockée dans la note) : les fichiers sont rangés sous <user_id>/<uuid>,
-- chemins non devinables. L'écriture et la suppression restent réservées
-- au propriétaire.
insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', true)
on conflict (id) do update set public = true;

create policy "upload own images"
  on storage.objects for insert
  with check (bucket_id = 'note-images' and owner = auth.uid());

create policy "delete own images"
  on storage.objects for delete
  using (bucket_id = 'note-images' and owner = auth.uid());
