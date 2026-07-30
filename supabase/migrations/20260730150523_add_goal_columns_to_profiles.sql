/*
# Add goal columns to profiles table

## Overview
Extends the `profiles` table to store the user's goal/calculated fields alongside
their display name and avatar. This lets the profile + goals sync together as one
row, so on sign-in the app can hydrate local Zustand state (profile name + goals)
from a single cloud record, and on "Save profile" / "Save goals" it can upsert
everything in one call.

## 1. Modified Tables
### `profiles` — new columns (all nullable, additive only — no data loss)
- `calorie_goal` (integer) — daily calorie target
- `goal_weight` (real) — target weight, stored in kg
- `weekly_weight_target` (real) — weekly weight change, stored in kg (negative = loss)
- `weight_unit` (text) — 'kg' | 'lb' display preference
- `bmr` (real) — basal metabolic rate (calculated)
- `tdee` (real) — total daily energy expenditure (calculated)
- `calc_payload` (jsonb) — full CalcBreakdown object (bmr, tdee, dailyDeficit,
  estimatedGoalDate, recommendedMacros, suggestedMealSplit) so the entire
  calculation survives across devices, not just the summary numbers

## 2. Security
- No policy changes. RLS already enabled on `profiles` with owner-scoped CRUD;
  the new columns inherit the existing policies (auth.uid() = user_id).

## 3. Important Notes
- All new columns are nullable so existing profile rows are not affected and the
  upsert can omit fields it does not yet have.
- Uses a DO $$ ... IF NOT EXISTS ... END $$ block per column so the migration is
  safe to re-run (idempotent).
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='calorie_goal') THEN
    ALTER TABLE profiles ADD COLUMN calorie_goal integer;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='goal_weight') THEN
    ALTER TABLE profiles ADD COLUMN goal_weight real;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='weekly_weight_target') THEN
    ALTER TABLE profiles ADD COLUMN weekly_weight_target real;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='weight_unit') THEN
    ALTER TABLE profiles ADD COLUMN weight_unit text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='bmr') THEN
    ALTER TABLE profiles ADD COLUMN bmr real;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='tdee') THEN
    ALTER TABLE profiles ADD COLUMN tdee real;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='calc_payload') THEN
    ALTER TABLE profiles ADD COLUMN calc_payload jsonb;
  END IF;
END $$;
