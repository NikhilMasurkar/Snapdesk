# Snapdesk — Business Dashboard

Owner-facing dashboard: menu editing, availability toggle, business
settings, testimonial moderation. Part of the Snapdesk monorepo (see
`../UserMenuList`, `../Admin`, `../Promotional_Website`) — all sharing one
Supabase backend.

Conventions and structure: [AGENTS.md](./AGENTS.md).

## Quick start

```bash
npm install
npm run dev
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
`.env.local` (same project as UserMenuList) — see `.env.example`.

Setup steps (schema migration, linking an owner to a business) are in
[AGENTS.md](./AGENTS.md).
