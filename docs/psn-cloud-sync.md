# PS5 Radar – optional cloud sync setup

The personal dashboard remains fully functional without cloud credentials.

1. In the intended Supabase project, open **SQL Editor** and run the migration in `supabase/psn-private-profile.sql`. The `public.psn_private_profile` table has RLS enabled and no anonymous/authenticated access grants.
2. Add **Production** environment variables to the existing Vercel project:
   - `SUPABASE_URL`: Supabase Project URL (`https://<project-ref>.supabase.co`).
   - `SUPABASE_SECRET_KEY`: Supabase server-side secret key; **never** `NEXT_PUBLIC_` and never commit.
3. Redeploy Production. Under Meine Spielwelt → Cloud-Synchronisierung, check the connection, upload from the device with your latest data, and explicitly restore to other devices.

Security/design:
- All requests use the existing private Radar session cookie and server-side Supabase credentials.
- The cloud API is disabled when env vars are absent. Opaque Supabase `sb_secret_*` keys are sent in the `apikey` header only; legacy service-role JWTs retain Bearer authorization.
- The table is a private single-profile record, appropriate for the existing shared-password single-user application; do not extend this model to multiple independent users.
- The API uses optimistic revision checks and returns HTTP 409 for concurrent changes. No automatic overwrites.
- Sync is manual by default. An optional browser-local toggle uploads only after explicitly saving a game plan. There is no automatic download or cross-device merging.
- Game cover URL preferences are included in future cloud backups and JSON exports; old backups without that field remain loadable.
- Back up your existing data using the JSON exporter before restoring cloud data.

## Verification boundaries

- CI mocks Sony authorization and GraphQL to verify pagination, persisted-query hash, Apollo preflight header, and active entitlement metadata. A mock does **not** confirm the current Sony endpoint still accepts live tokens.
- CI validates Supabase payload types, secret headers, unauthenticated API rejection, and mobile browser layouts. It does not send a write to your real Supabase profile.
- A complete device-to-device verification requires an authenticated save on device A, checking the revision, followed by a confirmed restore on device B. Do not automatically overwrite device B.
- Digital purchases are from an undocumented Sony API. Current purchase query uses a hash confirmed in community code; Sony can change it at any time.
