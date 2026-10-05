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
