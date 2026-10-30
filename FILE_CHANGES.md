# Complete source change list

Latest timeout/audio correction: **7 created, 16 updated, 0 deleted** files.
Compared with the original uploaded source: **44 created, 30 updated, 0 deleted** files.
Paths are relative to RecipeFinder/ in the full ZIP.

## Latest correction: created

- `AUDIO_AND_AI_FIXES.md`
- `backend/prisma/baseline-schema.prisma`
- `backend/prisma/migrations/20261028010000_ai_jobs/migration.sql`
- `backend/src/audio.ts`
- `backend/src/jobs.ts`
- `backend/tests/audio.test.ts`
- `backend/tests/jobs.test.ts`

## Latest correction: updated

- `DEPLOYMENT.md`
- `FIXES_AND_VALIDATION.md`
- `README.md`
- `REVIEW_AND_TESTS.md`
- `backend/DATABASE_REPAIR.md`
- `backend/README.md`
- `backend/prisma/schema.prisma`
- `backend/src/ai.ts`
- `backend/src/server.ts`
- `backend/tests/ai.test.ts`
- `backend/tests/api.test.ts`
- `frontend/components/admin/admin-ai-generator.tsx`
- `frontend/components/admin/admin-dashboard.tsx`
- `frontend/components/voice-player.tsx`
- `frontend/hooks/use-recipe-voice.ts`
- `verification/results.json`

## Latest correction: deleted

None.

## Full release: created

- `.env.example`
- `.gitignore`
- `AUDIO_AND_AI_FIXES.md`
- `Caddyfile`
- `DEPLOYMENT.md`
- `FILE_CHANGES.md`
- `FIXES_AND_VALIDATION.md`
- `README.md`
- `REVIEW_AND_TESTS.md`
- `START_HERE_WINDOWS.md`
- `backend/.dockerignore`
- `backend/DATABASE_REPAIR.md`
- `backend/Dockerfile`
- `backend/prisma/baseline-schema.prisma`
- `backend/prisma/migrations/20261028000000_initial/migration.sql`
- `backend/prisma/migrations/20261028010000_ai_jobs/migration.sql`
- `backend/prisma/migrations/migration_lock.toml`
- `backend/scripts/bootstrap.mjs`
- `backend/scripts/ensure-db.mjs`
- `backend/scripts/env.mjs`
- `backend/src/ai.ts`
- `backend/src/audio.ts`
- `backend/src/jobs.ts`
- `backend/src/pantry-recipes.ts`
- `backend/tests/ai.test.ts`
- `backend/tests/api.test.ts`
- `backend/tests/audio.test.ts`
- `backend/tests/jobs.test.ts`
- `backend/tests/pantry.test.ts`
- `backend/tests/startup.test.ts`
- `compose.yaml`
- `frontend/.dockerignore`
- `frontend/Dockerfile`
- `frontend/public/images/IMAGE_SOURCES.md`
- `frontend/public/images/kitchen.jpg`
- `frontend/public/images/recipes/chicken.jpg`
- `frontend/public/images/recipes/curry.jpg`
- `frontend/public/images/recipes/dal.jpg`
- `frontend/public/images/recipes/egg.png`
- `frontend/public/images/recipes/masala.jpg`
- `frontend/public/images/recipes/paneer.jpg`
- `frontend/public/images/recipes/rice.jpg`
- `frontend/public/images/recipes/veg.jpg`
- `verification/results.json`

## Full release: updated

- `backend/.env.example`
- `backend/README.md`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/prisma/admin-reset.ts`
- `backend/prisma/schema.prisma`
- `backend/prisma/seed-data.ts`
- `backend/prisma/seed.ts`
- `backend/src/matching.ts`
- `backend/src/server.ts`
- `backend/tsconfig.json`
- `frontend/README.md`
- `frontend/app/login/page.tsx`
- `frontend/app/page.tsx`
- `frontend/app/pantry/page.tsx`
- `frontend/app/saved/page.tsx`
- `frontend/components/admin/admin-ai-generator.tsx`
- `frontend/components/admin/admin-dashboard.tsx`
- `frontend/components/admin/admin-recipes-table.tsx`
- `frontend/components/food-image.tsx`
- `frontend/components/hero-carousel.tsx`
- `frontend/components/recipe-detail.tsx`
- `frontend/components/site-header.tsx`
- `frontend/components/voice-player.tsx`
- `frontend/hooks/use-recipe-voice.ts`
- `frontend/lib/api.ts`
- `frontend/lib/motion.ts`
- `frontend/next.config.ts`
- `frontend/package-lock.json`
- `frontend/package.json`

## Full release: deleted

None.

## Data and packaging

The initial database schema baseline is preserved. A new forward migration adds AiJob; startup deploys it without resetting existing tables. prisma/baseline-schema.prisma is a historical reference used only to compare legacy six-table databases before baselining.

Live environment files, user databases/journals, node_modules, .next, dist and build caches are excluded. Original uploaded PNGs and bundled starter photographs are included. No live API key or user session/account database is distributed.

Read AUDIO_AND_AI_FIXES.md for new generation and audio behaviour and START_HERE_WINDOWS.md for startup.
