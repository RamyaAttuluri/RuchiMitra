# RuchiMitra API

Use Node 22 LTS. Run commands from this folder.

1. Copy `.env.example` to `.env`. Set `FRONTEND_ORIGIN=http://localhost:3000`, choose administrator credentials, and set your own Gemini API key if using AI.
2. Run `npm ci`, then `npm run dev`. Its predev hook safely deploys migrations and seeds before the API starts. `npm run setup` also runs this explicitly.
3. Wait for the database-ready message and backend port 5000 message.
4. Verify `http://localhost:5000/api/health`.

For an EXISTING database, read `../DEPLOYMENT.md` before applying migrations. Never delete your database to fix a migration error.

Checks: `npm run build`, `npm test`, `npm run audit:prod`.

`npm run db:push` is for local prototyping. Use checked-in migrations (`npm run db:deploy`) for deployment. `npm run db:seed` adds missing starter recipes without overwriting existing recipes or resetting accounts. `npm run admin:reset` is an explicit password reset utility; read its prompts before using it.

API mutations require an Origin header equal to FRONTEND_ORIGIN. Browser requests send it automatically; API clients must set it. Authentication uses HttpOnly cookie sessions. The production frontend and API must share the same HTTPS site; the included reverse proxy provides this.

Gemini and TTS configuration is presence-based, not proof of provider access. Admin → Settings → Test AI connection makes a small billable model request and reports redacted errors. Telugu/Hindi translation and audio generation are independent provider requests with independent availability and quotas.

See `../REVIEW_AND_TESTS.md` for tested scenarios and remaining deployment checks.

Missing-table errors: read DATABASE_REPAIR.md. All SQLite paths are normalized to the same absolute file for the API, migrations and seed. The npm start hook also initializes the database; direct execution of server.js only verifies the schema and stops if it is missing.

Admin generation now responds 202 with a persisted job ID. GET /api/admin/ai-jobs/:id reports progress; POST /api/admin/ai-jobs/:id/retry resumes failed work. Only the requesting administrator can access the job. Run one backend/worker for SQLite.
