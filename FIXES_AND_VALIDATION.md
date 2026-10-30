# Database, login and image correction

The latest AI timeout/audio correction is documented in AUDIO_AND_AI_FIXES.md. The database release below is retained as historical validation; current schema also includes AiJob.

This release fixes the missing `Recipe`, `User` and `Session` tables reported after the previous ZIP. It contains the complete frontend and backend, including the earlier AI, pantry and voice changes.

## What caused the visible failures

The API could start against an empty SQLite file because initialization was a separate manual command. Recipe queries and login then failed. The homepage also parsed HTTP 500 JSON as an empty recipe list, leaving a blank featured section. SQLite migrations and runtime now receive the same normalized absolute path, including when the environment contains the Windows-friendly `file:./dev.db`.

## Corrections

- `npm run dev` now runs database generation, migration deployment and repeatable seeding first. `npm start` deploys migrations and seeds before starting the compiled API.
- Empty databases get all six application tables, 12 starter recipes and the configured administrator. A failed preparation step stops startup. No `db push`, reset or destructive recovery is run automatically.
- The API checks all six models before listening and returns a useful `DATABASE_NOT_READY` response for missing schema during requests.
- Existing passwords, user accounts, custom recipe text/status and uploaded photos are preserved on repeat startup. An existing populated database without migration history stops for explicit, documented baseline handling.
- Starter photos and the home kitchen photograph are bundled locally. An old invalid egg-photo URL is replaced by the supplied egg image. Default legacy starter URLs are updated to local equivalents without replacing custom photos.
- Recipe cards remain visible when scroll-animation callbacks are delayed.
- Homepage requests check HTTP status and response structure. Loading, empty and failure states are distinct; users can retry. The featured carousel also handles an empty collection and changing collection size.
- Windows repair and fresh-folder startup instructions are included. Live credentials, user databases, installed dependencies and old build caches remain excluded from the source release.

## Verification of this release

| Check | Result |
| --- | --- |
| Backend TypeScript build | Passed |
| Backend tests | 53 passed, 0 failed |
| Frontend clean production build | Passed |
| Compiled backend through actual `npm start` | Automatically initialized relative-path SQLite database and served 12 recipes |
| Administrator login | Passed in browser against that database |
| Homepage hero and recipe detail images | Loaded with external HTTPS requests blocked |
| All starter recipe image URLs | All 12 returned image bytes |
| Mobile homepage at 390px | No horizontal overflow |
| Simulated database 503 | Clear error and retry; recovered after retry |
| Browser page exceptions | None in these checks |
| Existing database preservation | Repeat bootstrap retained accounts, hashes, recipe edits/status and custom photo |
| Unbaselined populated database | Startup stopped and existing data remained intact |
| Production demo credentials | Rejected before creating a database |

The new browser smoke run covers nine checks. Deliberately blocked external requests (such as fonts) and the simulated 503 produce expected network console messages; these are separate from page JavaScript exceptions. Tests were run on Linux/Node 24.22.1 with Chromium; Windows path normalization was tested with Windows path rules, not a Windows host. Compiled Next.js production startup was tested; the local backend used development cookie/origin configuration. Docker images, HTTPS deployment, live provider credentials, actual spoken audio and email delivery still require staging/device verification.

The earlier broad backend test coverage remains included: auth/ownership, admin draft/archive/restore, pantry matching, AI errors/validation, translation caching and mocked cloud-audio contracts. No live AI request was made in this correction. See REVIEW_AND_TESTS.md for that earlier scope and DEPLOYMENT.md for hosting.

## Start your copy

Read START_HERE_WINDOWS.md first. Extract into a **new folder**. Stop the old servers. Configure backend/.env, then run `npm ci` and `npm run dev` inside backend. In a second terminal configure frontend/.env.local, then run `npm ci` and `npm run dev` inside frontend. Open http://localhost:3000 after the backend prints its ready message.

If using an existing populated database, read backend/DATABASE_REPAIR.md before initializing it. Do not delete the database to fix a migration error. Startup logs print the exact file being used.
