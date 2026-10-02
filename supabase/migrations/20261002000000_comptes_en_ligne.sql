-- Rallye Club : comptes en ligne, sauvegarde cloud et classements.
-- À exécuter une fois sur le projet Supabase (SQL Editor, ou `supabase db push`).

-- ---------------------------------------------------------------- profils
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null unique check (char_length(pseudo) between 3 and 20),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profils visibles par tous"
  on public.profiles for select
  using (true);

create policy "Chacun modifie son profil"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Création automatique du profil à l'inscription, avec un pseudo unique.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n integer := 0;
begin
  base := left(trim(coalesce(new.raw_user_meta_data ->> 'pseudo', '')), 16);
  if char_length(base) < 3 then
    base := 'Pilote';
  end if;
  candidate := base;
  while exists (select 1 from public.profiles where pseudo = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;
  insert into public.profiles (id, pseudo) values (new.id, candidate);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- sauvegardes
create table public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

create policy "Chacun lit sa sauvegarde"
  on public.saves for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Chacun crée sa sauvegarde"
  on public.saves for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Chacun met à jour sa sauvegarde"
  on public.saves for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- classements
-- Un seul temps par joueur et par spéciale : son meilleur.
create table public.stage_times (
  user_id uuid not null references auth.users (id) on delete cascade,
  stage_key text not null check (char_length(stage_key) between 1 and 40),
  car_id text not null check (char_length(car_id) between 1 and 40),
  time_ms integer not null check (time_ms between 20000 and 3600000),
  created_at timestamptz not null default now(),
  primary key (user_id, stage_key)
);

create index stage_times_classement on public.stage_times (stage_key, time_ms);

alter table public.stage_times enable row level security;

create policy "Temps visibles par tous"
  on public.stage_times for select
  using (true);
-- Aucune politique d'écriture : les temps passent uniquement par submit_time().

create function public.submit_time(p_stage text, p_car text, p_time integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  insert into public.stage_times as t (user_id, stage_key, car_id, time_ms)
  values (auth.uid(), p_stage, p_car, p_time)
  on conflict (user_id, stage_key) do update
    set time_ms = excluded.time_ms, car_id = excluded.car_id, created_at = now()
    where excluded.time_ms < t.time_ms;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke execute on function public.submit_time(text, text, integer) from public, anon;
grant execute on function public.submit_time(text, text, integer) to authenticated;

create view public.leaderboard
with (security_invoker = true)
as
select
  t.stage_key,
  rank() over (partition by t.stage_key order by t.time_ms) as rang,
  p.pseudo,
  t.user_id,
  t.car_id,
  t.time_ms,
  t.created_at
from public.stage_times t
join public.profiles p on p.id = t.user_id;
