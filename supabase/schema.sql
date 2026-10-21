-- Calorie Tracker schema
-- Run this once in your Supabase project's SQL editor (Project -> SQL Editor -> New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar text
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calorie_goal numeric not null default 2200,
  goal_weight numeric not null default 75,
  weekly_weight_target numeric not null default -0.3,
  weight_unit text not null default 'kg',
  gemini_api_key text not null default '',
  calc jsonb
);

-- Personalization that follows the account: Home/Statistics layout, goal
-- phases, weekday goals, milestones, coach memory… (added later, so it's
-- also added to existing databases here).
alter table public.settings add column if not exists prefs jsonb;

create table if not exists public.meals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  meal_type text not null,
  items jsonb not null default '[]'::jsonb,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric not null default 0,
  reasoning text not null default '',
  image_data text,
  image_datas jsonb,
  created_at bigint not null
);
create index if not exists meals_user_date_idx on public.meals(user_id, date);
create index if not exists meals_user_created_idx on public.meals(user_id, created_at desc);

create table if not exists public.weights (
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  weight numeric not null,
  created_at bigint not null,
  primary key (user_id, date)
);

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.meals enable row level security;
alter table public.weights enable row level security;

drop policy if exists "Users manage their own profile" on public.profiles;
create policy "Users manage their own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own settings" on public.settings;
create policy "Users manage their own settings" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own meals" on public.meals;
create policy "Users manage their own meals" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own weights" on public.weights;
create policy "Users manage their own weights" on public.weights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Pinned meals (added later — re-running this file creates it).
create table if not exists public.pinned_meals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  meal_type text not null,
  items jsonb not null default '[]'::jsonb,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric not null default 0,
  created_at bigint not null
);
create index if not exists pinned_meals_user_idx on public.pinned_meals(user_id, created_at desc);

alter table public.pinned_meals enable row level security;

drop policy if exists "Users manage their own pinned meals" on public.pinned_meals;
create policy "Users manage their own pinned meals" on public.pinned_meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Meal photos (added later — re-running this file creates it). A private
-- Storage bucket with one folder per user; meals reference files by path
-- instead of carrying base64 images inline.
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

drop policy if exists "Users read their own meal photos" on storage.objects;
create policy "Users read their own meal photos" on storage.objects
  for select using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users upload their own meal photos" on storage.objects;
create policy "Users upload their own meal photos" on storage.objects
  for insert with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update their own meal photos" on storage.objects;
create policy "Users update their own meal photos" on storage.objects
  for update using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete their own meal photos" on storage.objects;
create policy "Users delete their own meal photos" on storage.objects
  for delete using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Workouts (added later — re-running this file creates the table). Until
-- then they stay on each device.
create table if not exists public.workouts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  kind text not null default 'other',
  name text not null default '',
  minutes numeric not null default 0,
  calories numeric not null default 0,
  sets jsonb,
  notes text,
  created_at bigint not null
);
create index if not exists workouts_user_date_idx on public.workouts(user_id, date);

alter table public.workouts enable row level security;

drop policy if exists "Users manage their own workouts" on public.workouts;
create policy "Users manage their own workouts" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- When each row last changed, so the app downloads only what changed since
-- its last sync instead of everything every time. Set by the database on
-- every insert and update (the app never sends it).
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.meals add column if not exists updated_at timestamptz not null default now();
alter table public.weights add column if not exists updated_at timestamptz not null default now();
alter table public.workouts add column if not exists updated_at timestamptz not null default now();

drop trigger if exists meals_touch_updated_at on public.meals;
create trigger meals_touch_updated_at before update on public.meals
  for each row execute function public.touch_updated_at();
drop trigger if exists weights_touch_updated_at on public.weights;
create trigger weights_touch_updated_at before update on public.weights
  for each row execute function public.touch_updated_at();
drop trigger if exists workouts_touch_updated_at on public.workouts;
create trigger workouts_touch_updated_at before update on public.workouts
  for each row execute function public.touch_updated_at();

create index if not exists meals_user_updated_idx on public.meals(user_id, updated_at);
create index if not exists weights_user_updated_idx on public.weights(user_id, updated_at);
create index if not exists workouts_user_updated_idx on public.workouts(user_id, updated_at);

-- Lets a signed-in user delete their own account (Settings → Account).
-- Their rows go with it (every table cascades on auth.users); the app
-- removes their photos from Storage first.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = public, auth
as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
