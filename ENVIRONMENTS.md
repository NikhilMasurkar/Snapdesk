# Snapdesk — Dev & Prod environments

Two fully separate Supabase projects so testing never touches real customer
data. The ORIGINAL project (with all the pilot/test data) is now DEV; the
freshly created empty project is PROD:

| | DEV | PROD |
|---|---|---|
| Supabase project | `SnapDesk_dev` (original: ldnfhwhtrobsetbnjtai) | `SnapDesk_prod` (new, starts empty) |
| Used by | localhost + Vercel **Preview** deploys | Vercel **Production** deploys |
| Git | `dev` branch (and local work) | `main` branch |
| Data | test businesses, throwaway accounts | real businesses only |

## 1. DEV project (SnapDesk_dev) — already mostly set up

It has everything through Phase 2 + reviews + storage. Still needed:

1. SQL Editor → run `BusinessDashboard/supabase/phase3.sql`
2. Its manual step: `insert into admin_users (user_id) select id from auth.users where email = 'YOUR_ADMIN_EMAIL';`
3. Database → Replication → confirm `orders` is in the `supabase_realtime` publication

Local `.env.local` files already point here — nothing to change locally.

## 2. PROD project (SnapDesk_prod) — run everything, in this exact order

1. `UserMenuList/supabase/schema.sql`
2. `BusinessDashboard/supabase/phase2_auth.sql`
3. `UserMenuList/supabase/reviews_policy.sql`
4. `BusinessDashboard/supabase/reviews_cleanup.sql` (enable pg_cron extension first if it errors)
5. `BusinessDashboard/supabase/storage.sql`
6. `BusinessDashboard/supabase/phase3.sql` + its two manual steps
7. Do NOT run `seed.sql` — prod starts with zero businesses; real ones arrive
   via the application flow and your admin approval.

Auth settings on prod:
- Authentication → URL Configuration → Site URL = production dashboard URL
  (`https://snapdeskbusinessdashboard-chi.vercel.app`)
- Keep "Confirm email" ON in prod (it's disabled on dev for convenience).
- Create your admin login: Authentication → Users → Add user, then the
  `admin_users` insert.

## 3. Local development = DEV

Each app's `.env.local` (never committed) points at **SnapDesk_dev**:

- `UserMenuList/.env.local` — dev URL + anon key
- `BusinessDashboard/.env.local` — dev URL + anon key, `NEXT_PUBLIC_MENU_BASE_URL=http://localhost:3000`
- `Admin/.env.local` — dev URL + anon key + dev `SUPABASE_SERVICE_ROLE_KEY`

## 4. Vercel = env vars per environment

For EACH Vercel project (UserMenuList, BusinessDashboard, Admin):
Settings → Environment Variables → add every variable **twice**:

- scope **Production** → SnapDesk_prod URL/keys
- scope **Preview + Development** → SnapDesk_dev URL/keys

Same variable names, different values per scope. Vercel picks the right set
automatically.

> ⚠️ Until you set the Production-scoped vars to SnapDesk_prod, the live
> sites keep talking to the old project (= dev). Flip these before onboarding
> any real business.

## 5. Git workflow

```
git checkout -b dev        # once
# ... work, commit on dev ...
git push origin dev        # → Vercel PREVIEW deploy → talks to SnapDesk_dev
# happy? merge:
git checkout main && git merge dev && git push origin main
                           # → Vercel PRODUCTION deploy → talks to SnapDesk_prod
```

Preview URLs look like `snapdesk-git-dev-<team>.vercel.app` — that's your
staging site. Production URLs are unchanged.

## 6. Schema changes rule

Any new `.sql` file gets run on **DEV first**, tested, and only then on PROD.
Keep every migration as a file in the repo (`*/supabase/*.sql`) — never make
untracked schema edits in the Supabase UI.
