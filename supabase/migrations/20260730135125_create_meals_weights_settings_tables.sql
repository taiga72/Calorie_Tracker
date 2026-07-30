/*
# Create meals, weights, and settings tables for cloud sync

Adds three owner-scoped tables for optional cloud accounts. The app defaults to
Guest Mode (localStorage); when a user signs in, local data migrates here and
new entries sync to these tables. RLS is owner-scoped (authenticated only);
no anon access since guests use localStorage.

Tables:
- meals(id uuid PK, user_id, date, meal_type, items jsonb, calories, protein,
  carbs, fat, fiber, reasoning, image_data, image_datas jsonb, client_created_at, created_at)
- weights(user_id, date, weight, client_created_at, created_at) PK(user_id,date)
- user_settings(user_id PK, payload jsonb, updated_at)

Security: RLS enabled on all; 4 owner-scoped policies per table (auth.uid()=user_id).
user_id columns DEFAULT auth.uid() so inserts omitting user_id still pass WITH CHECK.
*/

CREATE TABLE IF NOT EXISTS meals (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  meal_type text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  calories real NOT NULL DEFAULT 0,
  protein real NOT NULL DEFAULT 0,
  carbs real NOT NULL DEFAULT 0,
  fat real NOT NULL DEFAULT 0,
  fiber real NOT NULL DEFAULT 0,
  reasoning text NOT NULL DEFAULT '',
  image_data text,
  image_datas jsonb,
  client_created_at bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meals" ON meals;
CREATE POLICY "select_own_meals" ON meals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_meals" ON meals;
CREATE POLICY "insert_own_meals" ON meals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_meals" ON meals;
CREATE POLICY "update_own_meals" ON meals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_meals" ON meals;
CREATE POLICY "delete_own_meals" ON meals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS meals_user_date_idx ON meals(user_id, date);

CREATE TABLE IF NOT EXISTS weights (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  weight real NOT NULL,
  client_created_at bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

ALTER TABLE weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_weights" ON weights;
CREATE POLICY "select_own_weights" ON weights FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_weights" ON weights;
CREATE POLICY "insert_own_weights" ON weights FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_weights" ON weights;
CREATE POLICY "update_own_weights" ON weights FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_weights" ON weights;
CREATE POLICY "delete_own_weights" ON weights FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON user_settings;
CREATE POLICY "select_own_settings" ON user_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_settings" ON user_settings;
CREATE POLICY "insert_own_settings" ON user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_settings" ON user_settings;
CREATE POLICY "update_own_settings" ON user_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_settings" ON user_settings;
CREATE POLICY "delete_own_settings" ON user_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
