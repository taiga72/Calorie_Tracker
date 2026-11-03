# The iPhone app

The iPhone app is this same web app inside a native shell
([Capacitor](https://capacitorjs.com)), plus what a web app can't do:

- **Apple Health**: workouts from your watch (any watch app that saves to
  Health, e.g. CMF Watch) and weigh-ins from a smart scale come in on their
  own; the calories of meals you log are written to Health.
  Settings → Goals → Apple Health.
- **Reminders that arrive when the app is closed** (scheduled with iOS).
- **iPhone haptics** and **voice input** with iOS's own speech recognition.

The web version keeps working exactly as before; the native parts only switch
on inside the app.

## What you need

- A Mac with **Xcode** (free, from the Mac App Store), opened once so it can
  install its components.
- **Node.js 20+** (`brew install node`, or from nodejs.org).
- An iPhone and a USB cable (or the same Wi-Fi, once paired).
- An **Apple ID**. A free one is enough to run the app on your own phone; the
  app then has to be re-installed from Xcode every 7 days. The paid Apple
  Developer Program ($99/year) removes that limit and is needed for TestFlight
  and the App Store.

## First run

1. Get the code and install it:
   ```sh
   git clone https://github.com/taiga72/Calorie_Tracker.git
   cd Calorie_Tracker
   npm install
   ```
2. Create `.env` with the same values as on Vercel (Vercel → Project →
   Settings → Environment Variables):
   ```sh
   cp .env.example .env
   # then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   # (and VITE_GEMINI_API_KEY if Vercel has one; otherwise the app uses the
   # key saved in Settings)
   ```
3. Build the web app into the iPhone project and open Xcode:
   ```sh
   npm run ios
   npm run ios:open
   ```
4. In Xcode, select the **App** project → **App** target → **Signing &
   Capabilities**:
   - **Team**: add your Apple ID (Xcode → Settings → Accounts) and pick it.
   - **Bundle Identifier**: `com.taiga72.calorietracker` — change it if Xcode
     says it's taken (e.g. add your initials).
   - Check that **HealthKit** is listed; if not, **+ Capability → HealthKit**.
5. On the iPhone: Settings → Privacy & Security → **Developer Mode** → on
   (iOS asks once, then restarts).
6. Plug in the iPhone, pick it at the top of Xcode, and press **▶ Run**.
   The first time, the iPhone may ask you to trust the developer: Settings →
   General → VPN & Device Management → your Apple ID → Trust.

> If Xcode refuses the HealthKit capability with a free Apple ID, everything
> else still works; Apple Health turns on once you have the developer
> account.

## After a code change

One command gets the latest code, builds it and installs it on the iPhone
(plugged in and unlocked), without opening Xcode:

```sh
npm run ios:update
```

It asks which device to use: pick your iPhone with the arrow keys and press
Return. Your Xcode signing settings are kept (`git pull --autostash` sets your
local changes aside and puts them back).

If it fails, do it the long way:

```sh
git pull
npm install
npm run ios      # rebuilds the web app and copies it in
```
then **▶ Run** in Xcode again. The free Apple ID's 7-day renewal works the
same way: either `npm run ios:update` or **▶ Run**.

## Apple Health

Settings → Goals → **Apple Health** → **Connect Apple Health**, and allow
Workouts, Heart Rate, Weight and Dietary Energy. Then:

- New workouts are imported when the app opens or comes back to the front
  (the first time, the last 30 days). Strength sessions use about two thirds of
  the heart-rate calories, like watch screenshots; the original figure and
  average heart rate go into the workout's notes.
- Weigh-ins fill in days you haven't logged a weight yourself.
- Meals logged from then on are saved to Health as calories (Health doesn't
  take protein, carbs or fat from this app yet). Editing or deleting a meal
  afterwards doesn't change what's already in Health.
- Each workout and weigh-in is imported once: delete one here and it stays
  deleted.

In the CMF Watch app, make sure syncing to Apple Health is on (Profile →
Settings → third-party services → Apple Health).

## Before the App Store (later)

- The Gemini key should move from the app into a Supabase Edge Function.
- A privacy policy page, the App Store privacy answers, screenshots and the
  listing text.
- Archive in Xcode (Product → Archive) → Distribute → App Store Connect →
  TestFlight.
