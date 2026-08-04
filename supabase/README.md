# Supabase setup

1. Create a free project at https://supabase.com (or use an existing one).
2. In the Supabase dashboard, go to **SQL Editor -> New query**, paste the contents of `schema.sql` in this folder, and run it. This creates the `meals`, `weights`, `settings`, and `profiles` tables with row-level security so each signed-in user can only see their own data.
3. Go to **Project Settings -> API** and copy the **Project URL** and the **anon public** key.
4. In the app's root, copy `.env.example` to `.env` and fill in:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
5. In **Authentication -> Providers**, Email sign-in is on by default. If you don't want new signups to require email confirmation while testing, go to **Authentication -> Settings** and turn off "Confirm email" (you can turn it back on later).
6. Restart the dev server (`npm run dev`) after adding the `.env` file so Vite picks up the new variables.

That's it — the app will show a sign-in/sign-up screen, and all meals, weights, settings, and profile data will be stored in your Supabase project instead of the browser's localStorage.
