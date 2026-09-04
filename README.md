# PlayStation Radar – Private Vercel App

Private Next.js version of the fixed PlayStation Radar template.

## Security
The password is never hard-coded. Configure these environment variables in Vercel:

- `RADAR_PASSWORD` – the password you want to use
- `RADAR_SESSION_SECRET` – a long random secret (32+ characters)

The app stores an HTTP-only session cookie. The radar data is imported server-side; there is no public `radar.json` route.

## Local test
```bash
cp .env.example .env.local
# edit .env.local
npm install
npm run dev
```

Open http://localhost:3000.

## Daily data
Update `data/radar.json`. The future news automation can overwrite this file or replace it with a database/API source.

## Vercel
1. Import/deploy this project.
2. Add both environment variables for Production and Preview.
3. Redeploy.

Robots indexing is disabled as an additional measure, but access control is enforced by the server-side login.
