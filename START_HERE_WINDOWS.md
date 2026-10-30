# Start the corrected project on Windows

Use Node 22 LTS. Stop the old backend/frontend terminals with Ctrl+C before starting this copy.

1. Extract the ZIP. Open its `RecipeFinder/backend` folder in a terminal.
Do not copy old node_modules, .next or dist folders into this new copy.

2. Copy `.env.example` to `.env` (or retain your private existing `.env`). Set DATABASE_URL to `file:./dev.db`, FRONTEND_ORIGIN to `http://localhost:3000`, and your admin credentials. Add your provider key only in this backend file.
3. Run `npm ci`, then `npm run dev`. The backend now creates the schema and starter recipes automatically before listening on port 5000. Do not continue if it prints STARTUP STOPPED; read `backend/DATABASE_REPAIR.md`.
4. In a second terminal open `RecipeFinder/frontend`, copy `.env.example` to `.env.local`, run `npm ci`, then `npm run dev`.
5. Open http://localhost:3000. Sign in using the administrator credentials configured before the first seed.

The health endpoint is http://localhost:5000/api/health. The recipe endpoint is http://localhost:5000/api/recipes and should return 12 starter recipes on a fresh database. Starter images are included in the ZIP and served from the frontend.

For an existing populated database, back it up first and follow `backend/DATABASE_REPAIR.md`; never delete it to fix a migration error. This ZIP contains source and images, not your existing user accounts or live API keys.

Production HTTPS/volumes instructions remain in DEPLOYMENT.md. Build and staging checks are documented in FIXES_AND_VALIDATION.md. Do not deploy development administrator credentials publicly.
