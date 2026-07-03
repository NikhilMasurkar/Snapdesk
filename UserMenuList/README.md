# Snapdesk — UserMenuList

Public, customer-facing QR menu + WhatsApp ordering app. Part of the
Snapdesk multi-app project (see `../BusinessDashboard`, `../Admin`,
`../Promotional_Website` — each its own repo, all sharing one Supabase
backend).

Full product/build spec: [PHASE1_SPEC.md](./PHASE1_SPEC.md).
Conventions and structure: [AGENTS.md](./AGENTS.md).

## Quick start

```bash
npm install
npm run dev
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
`.env.local` — see `.env.example`. Demo routes once seeded:

- `/m/spice-garden?table=5`
- `/m/glow-beauty`
