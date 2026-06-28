# Supabase → SQL Server + Auth.js + Azure Blob — Migration Runbook

This branch (`migrate/sql-server`) replaces the entire Supabase backend:

| Concern   | Before (Supabase)        | After                                  |
| --------- | ------------------------ | -------------------------------------- |
| Database  | Postgres + RLS           | SQL Server via **Prisma**              |
| Auth      | Supabase Auth            | **Auth.js v5** (Credentials provider)  |
| Storage   | Supabase Storage buckets | **Azure Blob** + short-lived SAS URLs  |
| Isolation | RLS policies             | App-level org-ownership checks         |

## 1. Provision infrastructure

- **SQL Server**: a database the app can reach (Azure SQL or self-hosted).
- **Azure Storage account** with two **private** containers: `templates`, `photos`.

## 2. Environment variables

Set these (see `.env.example`):

```
DATABASE_URL=sqlserver://HOST:1433;database=printify;user=USER;password=PASS;encrypt=true;trustServerCertificate=true
AUTH_SECRET=<output of: npx auth secret>
AZURE_STORAGE_CONNECTION_STRING=<from the storage account>
AZURE_STORAGE_TEMPLATES_CONTAINER=templates
AZURE_STORAGE_PHOTOS_CONTAINER=photos
PIAPI_KEY=...
AZURE_VISION_KEY=...
AZURE_VISION_ENDPOINT=...
```

> The external persons/auth API base URL is hardcoded in `src/lib/external-api.ts`
> and `src/auth.ts` (`https://evesms.com/...`) — unchanged by this migration.

## 3. Create the schema

```bash
npm install
npx prisma db push        # creates tables on SQL Server (or: prisma migrate dev --name init)
```

## 4. (Optional) Migrate existing data

Only if you have data in the old Supabase project worth keeping:

```bash
# Unpause the Supabase project first, then:
npm i -D @supabase/supabase-js
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-from-supabase.mjs
npm uninstall @supabase/supabase-js
```

This copies organizations, templates, persons, id_cards, print_logs and both
storage buckets. **Users are not migrated** (hashed passwords are unrecoverable):
external-API users are recreated on first login; local accounts must re-register.

## 5. Deploy (Azure App Service / VM)

- `npm run build` runs `prisma generate` then `next build`.
- Ensure the runtime has the env vars from step 2 and network access to SQL Server.
- The `vercel.json` keep-alive cron is obsolete (Azure SQL does not pause); the
  `/api/keep-alive` route remains as a harmless liveness probe.

## Auth behavior notes

- **Login** (`/login`) authenticates via the Credentials provider: it tries a
  local `users.password_hash` first, then falls back to the external evesms API.
- The external bearer token + schoolId are stored in the encrypted JWT (read
  server-side via `getToken` in `src/lib/auth.ts`), never exposed to client JS.
- The middleware (`src/middleware.ts`) now does a **local JWT check** — no network
  round-trip to an auth server. This is what eliminates the previous
  `MIDDLEWARE_INVOCATION_TIMEOUT` (504) when the backend was unreachable.
