# Fix missing Recipe, User and Session tables

The errors “The table main.Recipe/Session/User does not exist” mean the configured database has not been initialized, or DATABASE_URL points to another file. A browser cookie, frontend reinstall or API key will not create database tables.

## Updated startup

This release runs safe database preparation before `npm run dev` and `npm start`: it resolves the SQLite path, creates a new file if needed, applies migrations, adds missing starter recipes and provisions the configured admin if it does not already exist. If preparation fails, it stops before starting the API. It never resets an existing database.

`DATABASE_URL="file:./dev.db"` always refers to `backend/prisma/dev.db`. The same absolute path is used by migrations, seeding and the API, including on Windows. Startup prints the resolved path; compare it with the file you intend to use.

## Windows: your empty database

1. Stop the backend with Ctrl+C. Back up your current backend `.env`, SQLite database and uploads.
2. Extract the updated ZIP to a fresh folder. Keep live keys private. Copy your `.env` into the new `backend` folder, or copy `.env.example` to `.env` and configure it. Keep `FRONTEND_ORIGIN=http://localhost:3000`. Set your administrator email and a password of at least 12 characters.
3. In the new `backend` folder run:

```powershell
npm ci
npm run dev
```

Wait for “Database ready” and “RuchiMitra backend ready”. Fresh databases get 12 starter recipes. Open http://localhost:5000/api/health, then http://localhost:5000/api/recipes. The latter must return a recipes array.

4. In the new `frontend` folder, copy `.env.example` to `.env.local` if needed, then run:

```powershell
npm ci
npm run dev
```

Open http://localhost:3000. Login uses ADMIN_EMAIL and ADMIN_PASSWORD from the backend environment **at first account creation**. Changing these variables does not change an existing account password. Use the explicit `npm run admin:reset` utility if you intentionally need to reset an existing admin password.

You can also run `npm run setup` explicitly before starting. For production builds use `npm run build`, then `npm start` in each folder. The backend's start hook still prepares the database first. Keep the pinned Prisma CLI/tsx dependencies installed (the supplied Dockerfile does this).

## Existing populated database / P3005

Do not delete your database, use `--force-reset`, or mark a migration applied just to bypass an error. This package does not contain your account/session database. Copy a backup of the intended existing database separately if you want to retain it.

A database originally created using `prisma db push` may have tables but no migration history. Versioned migration deployment stops with P3005. On a backup copy, verify its original six-table schema against the initial migration (the current schema additionally contains AiJob):

```powershell
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/baseline-schema.prisma --exit-code
```

Run this from backend with the intended DATABASE_URL in `.env`. Exit 0 indicates no schema difference; exit 2 indicates differences requiring investigation. If—and only if—the existing schema matches, baseline the existing initial schema once:

```powershell
npx prisma migrate resolve --applied 20261028000000_initial
npm run setup
```

If tables were manually removed from a database that already records the initial migration, restore the missing data/tables from a verified backup or prepare an appropriate forward migration. Do not auto-reset it. The new AiJob migration is applied after the initial baseline. The API now refuses to start with missing tables and returns DATABASE_NOT_READY if they disappear during runtime.

## Images

All starter photos are bundled in `frontend/public/images`. Fresh seeds use these local URLs. Repeated seeding switches only unchanged legacy starter photo URLs to their bundled equivalents; custom admin photo URLs and uploads are preserved. Images no longer depend on Unsplash being reachable at page-load time. Preserve existing backend/uploads if retaining recipes with uploaded photos.
