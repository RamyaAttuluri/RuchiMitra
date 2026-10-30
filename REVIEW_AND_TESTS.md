# Latest release

See AUDIO_AND_AI_FIXES.md. Current backend suite: 59 passing tests; latest audio/job browser run: 10 passing checks. Earlier results below are historical review evidence.

# Review, fixes and test evidence

**Updated release:** the reported missing-table/login/homepage issues are corrected in FIXES_AND_VALIDATION.md. Current backend result: 53 passing tests. Current additional browser regression run: 9 passing checks. The detailed 49-test/11-browser-check results below describe the preceding review; its tests remain in the suite.

Reviewed on October 28, 2026 against the two supplied source archives and three screenshots. This release contains both complete source projects. It does not certify every possible scenario or replace a staging launch check.

## Requested issues

| Issue | Finding | Result |
| --- | --- | --- |
| Admin AI says “Recipe AI temporarily unavailable” | Every non-200 provider response was replaced with the same message. The supplied example also contained a credential and used a legacy model default. | Added redacted error codes for configuration, credentials, project/billing, quota, unavailable model, timeout, malformed/truncated/incomplete responses. Added Admin Settings connection test and current model defaults. Both admin translations must be valid and aligned before any draft is saved. |
| Telugu/Hindi translation and voice fail | Translation shares the AI provider dependency. Speech is a separate browser/cloud capability. Late translation requests could change the current language state. Failed browser voices were persisted indefinitely. | Added abort/stale-response guards, translation retry, per-page failed-voice tracking, actionable cloud errors, supported TTS default, bounded cache and provider budget. Built-in translations continue to work without a text-generation request. |
| Few pantry ingredients show no ready recipe | Matching used only database recipes. Quantity-bearing chips such as “Basmati rice 1 cup” were not normalised correctly. | Added eight simple pantry templates, created only when every required ingredient is present. Your exact screenshot finds Simple Jeera Rice and Plain Rice without Gemini. Empty matches automatically try AI if configured; users can also request another AI pantry recipe. AI suggestions are checked against the available ingredient names before saving. |
| No match wording | “Nothing yet” left users without an actionable route. | Replaced it with an explanation, optional near matches and a pantry-specific AI action. Does not claim a complete dish can always be made from any arbitrary input. |

The exact provider failure of the supplied key was not tested. It may involve credentials, permissions, billing, quota or model access; the old error suppressed that distinction. Rotate the supplied credential before deployment. Google currently restricts Gemini 2.5 access for new projects; the default is now `gemini-3.8-flash`. See DEPLOYMENT.md for official references and setup.

## Additional corrections

- Patched known dependency advisories: Next.js 15.5.28, Express 4.22.3, rate limiting 8.7.1, Zod 4.6.7, PostCSS 8.5.23 and Prisma CLI transitive dependencies. Lockfiles updated; full dependency audits were clean at review time.
- Added bounded AI concurrency and hourly usage budget, finite provider/browser timeouts and one bounded retry for transient server failures. Credentials remain server-side and are never included in provider error bodies returned to users.
- Shopping-list checks/deletes now update the display only after a successful response, prevent duplicate in-flight mutations, and show failures. Sign-out also reports server failure instead of appearing successful.
- Fixed admin-table stale requests and empty pagination after filtering/deleting. Admin role changes and session invalidation are transactional and preserve an administrator.
- Protected concurrent translation cache updates and rejected translations for changed recipe content. Added translation retry in the voice UI.
- Added supported external-image validation, broken-image fallback, clearer serving-size/narration behaviour, safer post-login redirect handling and a narrower browser connection policy.
- Added no-store API responses, JSON 404s, SIGTERM shutdown, expired-session/reset-token cleanup and configurable trusted proxy hops.
- Fixed the local origin example to port 3000. Removed the real credential from the example. Unofficial keyless speech is disabled by default.
- Added initial database migration, fresh SQLite file setup, repeatable setup scripts, optional Docker/HTTPS configuration and instructions for preserving an existing database.

## Verification performed

| Check | Result | Scope |
| --- | --- | --- |
| Backend TypeScript build | Passed | Updated production source |
| Backend automated tests | **49 passed, 0 failed** | Pure matching/provider tests plus actual HTTP/SQLite integration; provider calls mocked |
| Frontend production build | Passed | Next.js compilation, type validation and static route generation |
| Desktop/mobile browser smoke checks | **11 passed**, no page JavaScript errors | Headless Chromium, 1440px desktop and 390px mobile |
| Full backend dependency audit | 0 known advisories | Production and development dependencies, locked installation |
| Full frontend dependency audit | 0 known advisories | Production and development dependencies, locked installation |
| Fresh migration + repeated setup + seed | Passed | Temporary SQLite database, 12 starters, test administrator; not the supplied user database |
| Docker/Compose image deployment | Not run | Docker was not available; configuration is included for staging validation |

Automated scenarios include missing/rejected AI credentials, quota mapping, model errors, malformed and truncated JSON, one transient retry, pantry quantities and aliases, exact-match completeness, salt/water-only inputs, origin enforcement, short-password rejection, HttpOnly session issuance, admin authorisation, draft preview visibility, archive/restore/favorites preservation, image URL validation, translation alignment and caching, incomplete admin translation rejection, shopping ownership, pantry AI missing-ingredient rejection, pantry AI caching, mocked English/Telugu/Hindi cloud-audio responses and cache reuse, archived-template persistence, password reset configuration/invalid-token errors and logout invalidation.

The browser checks cover your pantry input, full recipe navigation, missing-key translation error and retry, returning to English, automatic AI fallback with a mocked provider, a delayed translation response after switching languages, administrator sign-in/settings, disabled generation without configuration, persisted pantry navigation, mobile layout and mobile navigation. The last two viewport/layout assertions are recorded as separate results alongside the other checks in `verification/results.json`.

Build/test runtime was Node 24.22.1 on Linux. Deployment examples use Node 22 LTS. No real provider generation, cloud audio, email or deployment request was made during verification. Audio endpoint tests validate the application contract using mocked bytes; they do not prove pronunciation or audible playback.

## Remaining launch checks

1. Rotate and configure your provider credentials. Test AI connection, admin generation with Telugu/Hindi, on-demand translation and real narration using your project quota/billing. Model availability can change.
2. Listen to English, Telugu and Hindi on your actual Android/iPhone/desktop browsers. Test play, pause, resume, stop, next/previous, retry and switching language while loading. Check pronunciation and translation accuracy with native speakers.
3. Back up the current database/uploads, validate baseline migration steps on a copy, then test HTTPS cookies and recovery email on staging. Preserve the original `.env` privately and update the changed origin/model values deliberately.
4. Validate actual Docker builds/TLS on the target host and plan monitoring, backups, restore drills and realistic traffic/cost tests. SQLite and in-memory quotas in this release target one backend instance.
5. Decide whether publicly created AI recipes require human moderation. The existing public-generation behaviour is preserved and clearly labelled; administrator-generated recipes remain drafts. AI ingredient matching cannot prove food safety, allergy suitability or instruction accuracy.

Pantry checks names rather than ingredient quantities, freshness or equipment. A few valid ingredients may support a simple meal; arbitrary pantry entries may not. The application now gives useful recipes where it can, without labelling recipes with missing required ingredients as ready.

## Run the checks

Inside `backend`:

```sh
npm ci
npm run db:generate
npm run build
npm test
npm run audit:prod
```

Inside `frontend`:

```sh
npm ci
npm run typecheck
npm run build
npm run audit:prod
```

See `verification/results.json` for the compact machine-readable results. See `FILE_CHANGES.md` for every changed file.
