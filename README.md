# Protocol by MAAN.life

Rules-based training and nutrition plans that adjust every week from a 2-minute check-in. Next.js + Supabase. The plan logic lives in `lib/engine.js` as pure, tested functions, the same engine validated in the static prototype.

## What it does

- Sign up / log in with real accounts (Supabase Auth)
- Profile: age, sex, height, weight, objective (shred / lose weight / build / ease back), training days, sport days, equipment, injuries
- Generates a personalized Monday–Sunday week: lifting, sport, move and rest days with carb cycling by day tag
- Injury-aware: named joints get their movements swapped automatically
- Weekly check-in (weight, waist, energy, sleep, soreness, new pain) drives next week's plan: progression, carb trims/boosts, volume pulls, earned third lift day, automatic deloads by age
- Progress tracking across all check-ins

## One-time setup (~15 minutes)

1. **Supabase** (free): create a project at supabase.com. In the SQL editor, paste and run `supabase/schema.sql`. In Authentication → Providers, make sure Email is enabled. (For a friends-and-family launch you may also want to disable "Confirm email" under Auth settings so signups work instantly.)
2. **Environment**: copy `.env.example` to `.env.local` and fill in the Project URL and anon key from Supabase → Project Settings → API.
3. **Local run**: `npm install && npm run dev` → http://localhost:3000
4. **Tests**: `npm test` (pure engine tests, no network needed)

## Deploy (free)

1. Push this folder to a GitHub repo.
2. At vercel.com: New Project → import the repo → add the two environment variables from `.env.local` → Deploy.
3. You get `https://your-app.vercel.app`. Every push to the repo redeploys automatically.

## Where things live

- `lib/engine.js`, all plan rules (the product). Change coaching logic here only.
- `lib/engine.test.mjs`, engine tests. Run before shipping rule changes.
- `app/page.jsx`, sign up / log in
- `app/onboard/page.jsx`, profile form
- `app/plan/page.jsx`, weekly plan, check-in, progress
- `supabase/schema.sql`, database tables and row-level security (users can only ever read/write their own rows)

Not medical advice. Users should clear new training programs with their physician.

