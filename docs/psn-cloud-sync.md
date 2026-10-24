# PS5 Radar – optional cloud sync setup

The personal dashboard remains fully functional without cloud credentials.

1. In the intended Supabase project, open **SQL Editor** and run the migration in `supabase/psn-private-profile.sql`. The `public.psn_private_profile` table has RLS enabled and no anonymous/authenticated access grants.
2. Add **Production** environment variables to the existing Vercel project:
   - `SUPABASE_URL`: Supabase Project URL (`https://<project-ref>.supabase.co`).
   - `SUPABASE_SECRET_KEY`: Supabase server-side secret key; **never** `NEXT_PUBLIC_` and never commit.
3. Redeploy Production. Under Meine Spielwelt → Cloud-Synchronisierung, check the connection, upload from the device with your latest data, and explicitly restore to other devices.

Security/design:
- All requests use the existing private Radar session cookie and server-side Supabase credentials.
- The cloud API is disabled when env vars are absent.
- The table is a private single-profile record, appropriate for the existing shared-password single-user application; do not extend this model to multiple independent users.
- The API uses optimistic revision checks and returns HTTP 409 for concurrent changes. No automatic overwrites.
- This is opt-in manual sync, **not** real-time automatic synchronization or a session history.
- Back up your existing data using the JSON exporter before restoring cloud data.
