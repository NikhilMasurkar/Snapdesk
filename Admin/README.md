# Snapdesk Admin (not built yet)

Internal, Snapdesk-staff-only panel for managing multiple businesses and
owners across the platform — the thing you use once there's more than one
or two pilot businesses to onboard/manage by hand.

Deferred until there's a real need for it. Until then, admin tasks (creating
businesses, linking owners, cross-business moderation) are done directly via
SQL in the Supabase dashboard, same as Phase 1 seeding.

Will be its own Next.js app + repo, sharing the same Supabase backend as
`../UserMenuList` and `../BusinessDashboard`, when built.
