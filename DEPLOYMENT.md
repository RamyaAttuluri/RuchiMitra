# Setup and deployment

## Local development (Windows, macOS, Linux)

Use Node 22 LTS. Install dependencies on the target OS; never reuse the uploaded Windows node_modules on Linux.

In `backend`, copy `.env.example` to `.env`, replace the admin email/password, and set your own Gemini key. Defaults run the frontend on port **3000** and backend on **5000**. Run:

```sh
npm ci
npm run dev
```

In another terminal, inside `frontend`, copy `.env.example` to `.env.local`, then run:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Admin uses the credentials you set before seeding. A new seed does not reset an existing administrator password.

Startup now applies migrations and repeatable seeding automatically before npm run dev / npm start. The configured SQLite path is printed. Read backend/DATABASE_REPAIR.md if startup stops. Starter photos are bundled in frontend/public/images.

## Credentials and AI diagnosis

The supplied environment example contained a credential. Rotate it in its provider account. This package contains no live key. Set a new server-side `GEMINI_API_KEY` and restart the backend. A key merely being present does not prove model access.

Use Admin → Settings → Test AI connection. Errors now identify missing configuration, rejected credentials/project permissions, quota/billing, unsupported model, timeout, invalid JSON and incomplete content. The old generic message concealed these causes, so the exact failure of the supplied key has not been established. Do not assume changing code can restore a blocked key or exhausted quota.

Use an available text model for `GEMINI_MODEL`. The default is now `gemini-3.8-flash`. Google restricts 2.5 model access to projects with prior usage, which can affect a new project using the old default. You may override the model if your project uses another supported model. For narration prefer `GOOGLE_TTS_API_KEY` with Cloud Text-to-Speech enabled and appropriate API restrictions. Otherwise Gemini TTS uses `GEMINI_TTS_MODEL`, set to `gemini-3.8-flash-tts` in this release. Google lists retirement of the older 2.5 preview TTS for November 17, 2026. Verify model access in your project before launch.

Text generation, translation and speech each need a successful provider request. A Gemini text key does not automatically enable Google Cloud Text-to-Speech. The unofficial keyless fallback is opt-in and disabled by default. Telugu/Hindi browser voices depend on device/browser installation and online voice availability.

References checked October 28, 2026:
- https://ai.google.dev/gemini-api/docs/troubleshooting
- https://ai.google.dev/gemini-api/docs/deprecations
- https://ai.google.dev/gemini-api/docs/speech-generation

## Existing database: preserve it

Back up SQLite and uploads before applying updates. This release includes the initial schema baseline plus a forward migration adding AiJob for resumable admin generation. Existing migrated databases receive the new table automatically during startup. Do not run the initial migration blindly against tables already created with `db push`.

For an existing database matching `prisma/schema.prisma`, after a verified backup, compare its schema with the checked-in schema. Mark the initial migration applied once:

```sh
npx prisma migrate resolve --applied 20261028000000_initial
npm run db:deploy
```

If the schema differs, investigate and reconcile first. Do not use `--force-reset` or `--accept-data-loss` to get past a mismatch. A new empty database uses `npm run setup` directly. Do not overwrite your existing `.env` with the example.

## HTTPS single-server deployment

Included: `compose.yaml`, `Caddyfile`, and Dockerfiles. Docker was not available for an actual image build in this review; validate the configuration on a staging server before launch.

1. Point a domain to your server. Open ports 80/443 and install Docker Compose.
2. Copy the root `.env.example` to root `.env`. Set matching `RECIPE_HOST` and `PUBLIC_ORIGIN` values.
3. Create `backend/.env` from the example. Choose a unique administrator email and a strong password of at least 12 characters. Add rotated provider credentials. Compose overrides database path, frontend origin and NODE_ENV appropriately.
4. Build and initialise a NEW database:

```sh
docker compose build
docker compose run --rm backend npm run setup
docker compose up -d
```

5. Verify health through your domain, then sign in and test admin generation, Telugu/Hindi translation and actual audio on your target phones/browsers. Configure Resend with a verified sender if password recovery is needed.

SQLite and uploads live on named volumes. Do not run `docker compose down -v`: it deletes volumes. Use one backend instance with SQLite. A multi-instance deployment needs a shared SQL database and shared rate-limit/budget storage; this release intentionally does not claim that configuration.

The proxy is the only publicly exposed service. TRUST_PROXY_HOPS=1 is correct only for this one-proxy topology. Backend API requests cannot bypass the proxy in this Compose network. Changing proxies requires reviewing this value.

For backups, stop writes or use SQLite's online backup facility and back up uploads with the database. Copy backups off the host, encrypt them, and perform a restore drill. Plan monitoring, disk limits, provider usage alerts, and database backup retention.

## Runtime behaviour and limits

- Admin generation returns a job ID immediately. English recipe, Telugu and Hindi are separate stages. A draft is saved before translation; a failed stage is retryable without creating another draft. Publication stays manual.
- Public dish and pantry AI creation creates a **published, clearly labelled AI recipe** as in the existing public generation flow. This content has not received human review. Admin generation creates a draft. If your launch policy requires every AI recipe to be moderated before anyone sees it, implement private user-owned previews/moderation before launch.
- Simple pantry recipes are persisted on demand and remain editable/archivable in admin. Archived versions are not silently recreated or republished.
- Each pantry recipe requires all listed ingredient names. Quantities, allergies, equipment and ingredient freshness are not inferred. Salt and water alone do not justify inventing a meal.
- Rate limits are per-process/per-client, with a process-wide AI budget of 120 logical calls/hour and a four-call concurrency cap. A bounded transient retry can make one extra provider attempt. Adjust budgets for actual traffic and provider cost; narration uses one request per sentence and can consume the budget quickly.
- Password reset requires configured Resend credentials and sender verification. No email is sent in this review.
- Sessions/reset tokens expire and are cleaned hourly. Cache sizes are bounded; neither cache nor rate-limit counters survive a restart.

See AUDIO_AND_AI_FIXES.md for background generation, retry behaviour, audio setup and speaker diagnostics. The worker targets the documented single-backend SQLite deployment; a multi-instance deployment requires a coordinated external worker/queue.
