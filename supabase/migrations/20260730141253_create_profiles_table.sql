/*
# Create profiles table for per-user account records

## Overview
Adds an owner-scoped `profiles` table. The migration layer ensures a profile row
exists for a user before inserting meals or weights, so dependent tables always
have a parent record. This is a prerequisite table for the safe migration wrapper.

## 1. New Tables
### `profiles`
- `user_id` (uuid, PK, DEFAULT auth.uid()) — owner; references auth.users with cascade delete
- `name` (text, NOT NULL DEFAULT '') — display name from local profile
- `avatar_url` (text) — optional avatar URL (e.g. from Google OAuth)
- `email` (text) — cached email for display
- `created_at` (timestamptz, DEFAULT now())
- `updated_at` (timestamptz, DEFAULT now())

## 2. Security (RLS)
- RLS enabled on `profiles`.
- Owner-scoped CRUD: each authenticated user can only access their own row
  (auth.uid() = user_id). No anon access — profiles are for signed-in users.

## 3. Important Notes
- `user_id` defaults to auth.uid() so an upsert omitting user_id still passes
  the INSERT WITH CHECK policy.
- The migration wrapper upserts a profile row first; only on success does it
  proceed to meals/weights, so a missing profile never blocks partial sync.
*/

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid NOT NULL DEFAULT auth.uid() PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  avatar_url text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
