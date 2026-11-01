# Implementation and verification

Date: 30 October 2026. Changes are in the existing frontend and backend workspace. No database reset, replacement, destructive migration, administrator password change, or production deployment was performed. This is not a claim that every requested scenario is production certified.

## Implemented behavior

- Ollama uses backend-only `/api/chat`, environment-selected `qwen3:4b`, structured JSON, runtime validation, actual installed-model health checks, cancellation, bounded requests, one active local generation, transient-only retry, and bounded validated-result caching. Output truncation and unavailable models produce useful errors. New generated recipes default to two servings; existing recipe serving bases remain intact.
- Recipe metadata now includes ingredient identities, optional/scalable flags, unique step IDs and numbers, total time, heat metadata and related-recipe metadata. Existing structured JSON database fields preserve compatibility. Admin edits invalidate unchanged old translations when their English source changes. Public generation still uses the existing database search and publication workflow.
- Missing translations use the selected backend translation provider. Whole recipes are requested together; no separate language-model request is made for each cooking step. Row counts, native script, measurements, repeated instructions and known ingredient identities are checked before saving. Serving variants preserve approved cooking steps and scale only scalable ingredients. These checks detect specific corruptions; they do not establish complete semantic equivalence.
- Narration has an authoritative queue and session identity, bounded audio caches, actual playback states, progress tied to completed cooking steps, and cancellation on recipe/language/servings/voice changes. Full Recipe includes the introduction, every ingredient and every step. Play Step, Continue, Pause, Resume, Repeat, Restart, Previous, Next, Stop and Test Voice use the same controller. Stale callbacks cannot advance a replacement session.
- Real server WAV playback uses CPU Piper for installed Telugu Padmavathi and eSpeak NG for Hindi/English, with other actual available voices exposed by the API. Browser synthesis errors can fall back to the healthy local service once. The interface reports the engine actually used. Failed, silent, malformed and undecodable audio is rejected; loading does not pretend to be playback.
- Recent searches are bounded, account-scoped browser-tab history with a clear action in the saved cookbook. Existing favorites, shopping lists, strict pantry matching, related recipes, authentication, admin roles/CRUD, GSAP homepage and reduced-motion behavior are retained. Admin forms expose optional/scalable ingredients and heat metadata. Existing responsive UI styling was refined without replacing the application.
- Startup retains existing migrations and seeding. Read-only `admin:check` verifies administrator configuration. Prisma generation verifies the current schema/client/engine before rewriting a Windows DLL. Port conflicts report corrective action without killing the listener; background workers start after successful binding.

## Executed evidence

| Check | Result and evidence |
| --- | --- |
| Backend integration/unit tests | **82 passed, zero failed**. `verification/backend-tests.log`; isolated test databases cover auth, authorization, admin CRUD, pantry/related ranking, local-service fallback/cache failures, narration sequencing, translation validation and occupied-port startup. |
| Python service tests | Six passed; input limits, busy service, missing engines and restricted-model policy. `verification/python-tests.log`. |
| TypeScript and production builds | Backend compilation and frontend typecheck/optimized Next build passed during implementation; `verification/frontend-build.log`. Validation output uses `.next-validation` so the existing development server can keep its build directory. |
| Lint | Passed ESLint parsing and eight correctness/security rules over frontend/backend TS, TSX and MJS. This is a focused ruleset, not an exhaustive React/style audit. Reproduction commands below; `verification/lint.log` is empty on success. |
| Real local speech via Express | Telugu returned Piper Padmavathi WAV; Hindi returned eSpeak NG WAV. Samples: `verification/api-real-te.wav`, `verification/api-real-hi.wav`. Engine/voice results: `verification/real-tts-results.json`. WAVs decoded and contained nonzero samples. |
| Live browser queue, actual audio | Telugu: six steps/six real clips; Hindi: six steps/six real clips; English Full Recipe: introduction + 12 ingredients + six steps = 19 real clips. All completed, maximum simultaneous audio was one. Pause/resume on step 3, read-one, next/previous, stop, language switch and related-recipe navigation passed. `verification/browser-live-results.json`. This run used actual Express/SQLite and synthesis, not audio fixtures. Playback speed was accelerated only in the test. |
| Ollama connectivity | Actual `/api/tags` found the configured installed model. `verification/real-ollama-results.json`. |
| Real structured generation | A six-step English recipe for two servings passed schema validation in approximately 191 seconds. It was not written into the user's database. |
| Real translation | Full-length attempts failed validation or exceeded the four-minute deadline. Smaller fixture diagnostics and final results are in `verification/real-ollama-small-results.json`; no failed translation was accepted. See the limitations below. |
| Existing admin and database | `admin:check` verified database connectivity, one administrator and the configured account's admin role. Passwords were neither printed nor changed. |
| Prisma client | Raw regeneration encountered the Windows EPERM lock from the running backend. The replacement idempotent command passed by verifying the unchanged schema, package/client version and native engine, without rewriting the locked DLL. |
| Dependency checks | Frontend and backend production npm audits reported zero vulnerabilities. Active lightweight Python runtime: `pip check` passed; OSV audit reported nine packages and zero advisories after upgrading its pip from 25.2 to 26.2.2. JSON evidence is in `verification/*audit.json`. These are point-in-time results. |

Final live checks after the speech restart confirmed HTTP 403 for a browser-origin request directly to port 8001 and successful synthesis through Express. `verification/api-final-te.wav` is a real decoded 3.04-second clip (RMS 0.178), not a placeholder.

Reproduce the focused lint check from the repository root (tools remain isolated from application dependencies):

```bat
npm install --prefix .local/lint --no-audit --no-fund --save-exact eslint@9.39.5 @typescript-eslint/parser@8.72.1 eslint-plugin-react-hooks@7.1.1
node .local/lint/node_modules/eslint/bin/eslint.js --config verification/eslint.config.mjs frontend backend --no-warn-ignored
npm test --prefix backend
npm run build --prefix backend
npm run typecheck --prefix frontend
set NEXT_BUILD_DIR=.next-validation
npm run build --prefix frontend
```

ESLint 9.39.5 emitted an upstream end-of-support warning during installation; it was used as an isolated verification tool and was not added to application dependencies. Upgrade this tooling before adopting it as a permanent CI baseline.

## Compatibility and remaining limits

The machine has an Intel i3-1115G4, integrated Intel UHD graphics and about 7.74 GiB RAM. It has no NVIDIA accelerator. The installed Qwen 4B model is usable for real recipe generation, but memory pressure and CPU inference make long translations unreliable. Initial full Hindi output failed content checks; later full Hindi/Telugu attempts timed out. Smaller tests also exposed English output despite a native-language request. Source text and existing reviewed translations were retained. Do not interpret working narration of stored translations as successful generation of every missing translation.

The schema now uses anchored literal-Unicode patterns suitable for grammar converters, with independent server validation. The final two-step fixture probes with those patterns both reached the deadline (Hindi 240.5 seconds, Telugu 241.1 seconds), so no successful new translation benchmark is claimed. Grammar conversion supports only a subset of JSON Schema; model output must still be checked. See the [upstream grammar documentation](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md). No automatic model switch, heavy neural installation, or fabricated translation was used to hide these failures.

Python 3.14 was unsuitable for the chosen wheel profile; installed Python 3.13 was used for the isolated lightweight environment. Piper and eSpeak NG are installed and exercised. Optional legacy IndicF5/IndicTrans2 profiles were not installed or certified and are outside the audited runtime.

Headless browser decoding and `playing`/`ended` events do not prove sound from physical speakers or pronunciation quality. Listen to the supplied Telugu/Hindi WAVs and test the controls on the actual device. eSpeak Hindi is a lightweight intelligible fallback with more mechanical delivery than a neural voice. Microphone input is not required for narration.

Recent searches are tab-local, not server-synced history. AI budgets and caches are per process, not distributed. No staging deployment, cross-device history, exhaustive accessibility audit or full visual regression suite was performed. Existing native-script quantities remain tied to the validated serving variant; a failed translation must not silently change measurements.

## Security and model licensing

Existing Argon2 passwords, expiring HttpOnly sessions, CSRF checks, restricted CORS, server-side administrator checks, rate limits, request limits, validated Prisma access and image-upload restrictions are retained and covered by backend tests. Frontend CSP permits required local blob audio. Private keys remain backend-only and actual `.env` values are unchanged. The internal speech service binds to loopback and rejects browser-origin synthesis requests; only Express should expose synthesis to the application.

Before shared deployment, configure HTTPS, exact allowed origins, production cookie settings, private Ollama/speech networking, strong administrator credentials and SQLite backups. Multiple application instances require shared quotas and deliberate database sizing. Do not expose Ollama or port 8001 directly. A zero-result dependency audit is not a general security certification.

Piper's engine and eSpeak NG have GPL obligations. Telugu Padmavathi's model card identifies CC-BY-4.0 data and attribution requirements. Telugu Maya has separate dataset terms that were not verified as permissive. Hindi Pratham/Priyamvada use CC-BY-NC-SA-4.0 and are not installed as production defaults. Known restricted models require explicit development configuration and are blocked by the loader in production. This policy does not grant model rights. Source links and practical setup details are in [MASTER_WINDOWS_SETUP.md](MASTER_WINDOWS_SETUP.md); downloaded model attribution/hashes are retained locally.

See [MASTER_CHANGED_FILES.md](MASTER_CHANGED_FILES.md) for exact modified/new/deleted files. See [MASTER_WINDOWS_SETUP.md](MASTER_WINDOWS_SETUP.md) for Windows CMD installation, database, Ollama verification, speech installation and frontend/backend startup commands.
