/*
# Create profiles, meals, and weight_logs tables

## Overview
Sets up the core schema for MacroFlow, a multi-user nutrition tracker.
Users sign in via Supabase Auth (email/password or Google OAuth). All data
is scoped to the authenticated user via Row Level Security.

## 1. New Tables

### profiles
- `id` (uuid, PK) — references `auth.users(id)`. One row per user.
- `email_encrypted` (text) — user email encrypted at rest with `pgp_sym_encrypt`.
- `email_hash` (text) — SHA-256 hash of the email for lookups without decrypting.
- `display_name` (text) — user-chosen display name.
- `avatar_url` (text) — profile picture URL.
- `biological_sex` (text) — 'male' or 'female'. Used for BMR calculation.
- `age` (int) — user age in years.
- `height_cm` (numeric) — height in centimeters.
- `current_weight_kg` (numeric) — latest weight in kilograms.
- `activity_level` (text) — activity level enum value.
- `target_goal` (text) — 'lose', 'maintain', or 'gain'.
- `target_daily_calories` (int) — calculated daily calorie target.
- `target_protein_g` (int) — calculated protein target in grams.
- `target_carbs_g` (int) — calculated carbs target in grams.
- `target_fat_g` (int) — calculated fat target in grams.
- `setup_complete` (boolean, default false) — whether the setup wizard is done.
- `created_at` (timestamptz) — row creation timestamp.

### meals
- `id` (uuid, PK) — meal entry ID.
- `profile_id` (uuid, FK → profiles) — owner. Defaults to `auth.uid()`.
- `meal_type` (text) — 'Breakfast', 'Lunch', 'Dinner', or 'Snack'.
- `logged_at` (timestamptz) — when the meal was consumed.
- `calories` (int) — total calories.
- `protein` (int) — protein in grams.
- `carbs` (int) — carbs in grams.
- `fat` (int) — fat in grams.
- `fiber` (int) — fiber in grams.
- `food_items` (jsonb) — array of food item objects.
- `reasoning` (text) — AI reasoning text.
- `created_at` (timestamptz) — row creation timestamp.

### weight_logs
- `id` (uuid, PK) — weight log entry ID.
- `profile_id` (uuid, FK → profiles) — owner. Defaults to `auth.uid()`.
- `weight_kg` (numeric) — weight in kilograms.
- `logged_at` (timestamptz) — when the weight was recorded.
- `created_at` (timestamptz) — row creation timestamp.

## 2. Security (RLS)
- RLS enabled on all three tables.
- `profiles`: users can SELECT/INSERT/UPDATE/DELETE only their own row.
- `meals`: users can CRUD only their own rows.
- `weight_logs`: users can CRUD only their own rows.

## 3. Encryption
- `pgcrypto` extension enabled for `pgp_sym_encrypt`/`pgp_sym_decrypt`.
- `email_encrypted` stores the email encrypted at rest.
- `email_hash` stores a SHA-256 digest for lookups.
- All client-server communication encrypted in transit via TLS (HTTPS).

## 4. Indexes
- `idx_profiles_email_hash` on `profiles(email_hash)`.
- `idx_meals_profile_logged` on `meals(profile_id, logged_at DESC)`.
- `idx_weight_logs_profile_logged` on `weight_logs(profile_id, logged_at DESC)`.

## 5. Important Notes
1. Owner columns default to `auth.uid()` so frontend inserts that omit
   the owner still satisfy RLS.
2. `profiles.id` references `auth.users(id)` with `ON DELETE CASCADE`.
3. A trigger auto-creates a profile row on user signup, encrypting the
   email at rest.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_encrypted text,
  email_hash text,
  display_name text,
  avatar_url text,
  biological_sex text CHECK (biological_sex IN ('male', 'female')),
  age integer,
  height_cm numeric,
  current_weight_kg numeric,
  activity_level text CHECK (activity_level IN (
    'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'
  )),
  target_goal text CHECK (target_goal IN ('lose', 'maintain', 'gain')),
  target_daily_calories integer,
  target_protein_g integer,
  target_carbs_g integer,
  target_fat_g integer,
  setup_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

CREATE INDEX IF NOT EXISTS idx_profiles_email_hash ON profiles(email_hash);

CREATE TABLE IF NOT EXISTS meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  meal_type text NOT NULL CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  logged_at timestamptz NOT NULL DEFAULT now(),
  calories integer NOT NULL DEFAULT 0,
  protein integer NOT NULL DEFAULT 0,
  carbs integer NOT NULL DEFAULT 0,
  fat integer NOT NULL DEFAULT 0,
  fiber integer NOT NULL DEFAULT 0,
  food_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meals" ON meals;
CREATE POLICY "select_own_meals" ON meals FOR SELECT
  TO authenticated USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "insert_own_meals" ON meals;
CREATE POLICY "insert_own_meals" ON meals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "update_own_meals" ON meals;
CREATE POLICY "update_own_meals" ON meals FOR UPDATE
  TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "delete_own_meals" ON meals;
CREATE POLICY "delete_own_meals" ON meals FOR DELETE
  TO authenticated USING (auth.uid() = profile_id);

CREATE INDEX IF NOT EXISTS idx_meals_profile_logged ON meals(profile_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  weight_kg numeric NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_weight_logs" ON weight_logs;
CREATE POLICY "select_own_weight_logs" ON weight_logs FOR SELECT
  TO authenticated USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "insert_own_weight_logs" ON weight_logs;
CREATE POLICY "insert_own_weight_logs" ON weight_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "update_own_weight_logs" ON weight_logs;
CREATE POLICY "update_own_weight_logs" ON weight_logs FOR UPDATE
  TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "delete_own_weight_logs" ON weight_logs;
CREATE POLICY "delete_own_weight_logs" ON weight_logs FOR DELETE
  TO authenticated USING (auth.uid() = profile_id);

CREATE INDEX IF NOT EXISTS idx_weight_logs_profile_logged ON weight_logs(profile_id, logged_at DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.profiles (id, email_encrypted, email_hash, display_name, avatar_url)
  VALUES (
    NEW.id,
    pgp_sym_encrypt(NEW.email, 'macroflow-profile-encryption-key'),
    encode(digest(NEW.email, 'sha256'), 'hex')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
