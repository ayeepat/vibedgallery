# Migration history

Exported 2026-06-10 from the remote project's `supabase_migrations.schema_migrations`
table — these 34 files are the complete **recorded** history and match the remote
versions one-to-one.

## Known gap: the pre-history baseline

The original `apps` and `profiles` tables (plus the `app-images` storage bucket
and the `handle_new_user` auth trigger wiring) were created via the dashboard
**before** migration tracking started, so they are not in any file here. One
ad-hoc grant fix also bypassed tracking
(`../migrations_pending/fix_apply_app_edit_owner.sql`, applied 2026-06-10).

To make the repo fully rebuildable, generate a baseline once (needs your
Supabase login — can't be done from an MCP session):

```sh
npx supabase login
npx supabase link --project-ref hgujctmkbmcfpxjhqkzo
npx supabase db dump -f supabase/baseline.sql
```

## Going forward

Apply schema changes as files here (via `supabase db push` or the MCP
`apply_migration`, which records into the same history table) — not as ad-hoc
dashboard SQL, so repo and database stay in sync.
