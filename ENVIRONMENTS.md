# Snapdesk — Dev & Prod environments

Two fully separate Supabase projects so testing never touches real customer
data:

| | DEV | PROD |
|---|---|---|
| Supabase project | `snapdesk-dev` (create this) | `snapdesk` (exists: ldnfhwhtrobsetbnjtai) |
| Used by | localhost + Vercel **Preview** deploys | Vercel **Production** deploys |
| Git | `dev` branch (and local work) | `main` branch |

## 1. One-time setup: create the DEV Supabase project

1. supabase.com → New project → name it `snapdesk-dev` (free tier allows 2).
2. Open its SQL Editor and run these files **in this exact order**:
   1. `UserMenuList/supabase/schema.sql`
   2. `UserMenuList/supabase/seed.sql` (optional — demo data)
   3. `BusinessDashboard/supabase/phase2_auth.sql`
   4. `UserMenuList/supabase/reviews_policy.sql`
   5. `BusinessDashboard/supabase/reviews_cleanup.sql`
   6. `BusinessDashboard/supabase/storage.sql`
   7. `BusinessDashboard/supabase/phase3.sql` (then do its two MANUAL STEPS:
      insert yourself into `admin_users`, verify realtime on `orders`)
3. Authentication → URL Configuration → Site URL: `http://localhost:3001`.
4. Authentication → Sign In / Up → disable "Confirm email" (dev convenience).
5. Copy the Project URL + publishable (anon) key + service_role key.

## 2. Local development = DEV

Each app's `.env.local` (never committed) points at **snapdesk-dev**:

- `UserMenuList/.env.local` — dev URL + anon key
- `BusinessDashboard/.env.local` — dev URL + anon key, `NEXT_PUBLIC_MENU_BASE_URL=http://localhost:3000`
- `Admin/.env.local` — dev URL + anon key + dev `SUPABASE_SERVICE_ROLE_KEY` + `ADMIN_EMAILS`

## 3. Vercel = env vars per environment

For EACH Vercel project (UserMenuList, BusinessDashboard, Admin):
Settings → Environment Variables → add every variable **twice**:

- scope **Production** → prod Supabase values
- scope **Preview + Development** → dev Supabase values

Same variable names, different values per scope. Vercel picks the right set
automatically.

## 4. Git workflow

```
git checkout -b dev        # once
# ... work, commit on dev ...
git push origin dev        # → Vercel PREVIEW deploy → talks to snapdesk-dev
# happy? merge:
git checkout main && git merge dev && git push origin main
                           # → Vercel PRODUCTION deploy → talks to prod
```

Preview URLs look like `snapdesk-git-dev-<team>.vercel.app` — that's your
staging site. Production URLs are unchanged.

## 5. Schema changes rule

Any new `.sql` file gets run on **DEV first**, tested, and only then on PROD.
Keep every migration as a file in the repo (`*/supabase/*.sql`) — never make
untracked schema edits in the Supabase UI.

## Prod checklist (things dev has that prod also needs)

- All SQL files from step 1.2 applied (prod already has 1–6; `phase3.sql` is new)
- Supabase Site URL = the production dashboard URL
- Admin Vercel project env: `SUPABASE_SERVICE_ROLE_KEY` (prod), `ADMIN_EMAILS`
- BusinessDashboard Vercel env: `NEXT_PUBLIC_MENU_BASE_URL=https://snapdesk-tan.vercel.app`
