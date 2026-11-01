# Recipe downloads, AI reliability and cinematic motion

### Visible motion revision — 31 October 2026

The sous-chef section's short entrance has been replaced by a continuously repeating, 14.4-second food film: **Listen → Cook → Savour**. Large dish photographs rotate, scale, float in and fly out against a dark kitchen backdrop, with giant moving serif words, herbs, spices and pulsing waveforms. Pause and Replay control the real timelines. Motion pauses offscreen and when the tab is hidden; reduced-motion users see a static first scene. The core animation also runs on the development laptop rather than being disabled by the low-power heuristic.

The missing italic heading was fixed by replacing transparent background-clipped text with solid burgundy text and a separate gold underline. Wave heights are rounded to avoid React hydration differences from fractional inline CSS values. `verification/voice-motion-browser.cjs` checks actual frame/transform changes across all three scenes, pause/replay, offscreen pausing, mobile overflow, reduced motion, readable heading and back navigation. Results are in `verification/voice-motion-results.json`; build output is in `verification/voice-motion-build.log`.

This follow-up changes `frontend/components/animated-voice-feature-section.tsx` and `frontend/app/redesign.css`, adds `frontend/components/voice-motion-stage.tsx`, and reuses bundled photography. Earlier animation descriptions below are historical for the first version.

Implemented in the existing frontend/backend, 31 October 2026. This document supersedes the earlier master report for these changes; earlier evidence remains available. SQLite, existing users, administrator passwords and private environment values were preserved. No database migration or reset is required.

## What changed

**Download Recipe:** a new action opens a native accessible dialog with recipe thumbnail, current servings, PDF indicator, and English/Telugu/Hindi selection. Every opening starts in English independently of narration. It supports Escape, Cancel, close, keyboard focus containment and focus restoration. Download requests are cancellable. Errors retain the dialog, and unavailable translations offer an explicit English choice. The modal closes only after a valid PDF download starts.

**Complete PDF:** `POST /api/recipes/:slug/download` validates language, servings, origin and publication status. It reads the whole recipe, scales ingredients without editing SQLite, and includes all instructions, timings, tip, available food image, branding and page numbers. Missing content is not invented. Stored translations are used immediately; English invokes no AI. Existing descriptions that lack a reviewed translation are explicitly labelled “Original description (English)”; cuisine/category/difficulty retain source values. This preserves complete information without silently pretending it has been translated.

The renderer uses installed Edge/Chromium via `playwright-core`, with local SIL OFL Noto Sans, Noto Sans Telugu and Noto Sans Devanagari fonts. Static TTFs were selected after inspecting initial variable-font exports. Text uses browser Indic shaping, not screenshot rasterization. Fonts/glyphs are embedded for offline reading. A4 margins, ingredient row protection, step heading protection and page numbers support multi-page printing. External browser network requests and scripts are disabled. Recipe text is escaped. Only bounded local images and HTTPS `images.unsplash.com` images are accepted; redirects are rejected. One renderer runs at a time, at most two callers wait, and a bounded PDF cache prevents repeated rendering of an unchanged export. If no supported browser exists, the interface offers the existing Print / Save as PDF flow with an explicit current-page-language label.

**AI reliability:** a bounded in-process inference queue replaces the old combined “busy or hourly budget reached” rejection. It defaults to one active local job and six waiting requests. Identical in-flight requests share work; cancelling one consumer does not cancel other consumers. The final consumer leaving aborts its underlying inference. Queue-full, queue-wait expiry, application rate limit, model absence, disconnection, timeout, invalid JSON and caller cancellation have separate error codes. No quota error is invented for a timeout.

Connectivity uses Ollama `/api/tags` without loading Qwen. Generation and translation have separate deadlines; translation sends one compact array request for the whole recipe instead of repeated nested keys and native-script regex grammars. `think:false`, non-streaming structured JSON, low temperature, bounded output/context and configurable keep-alive remain. Server validation reconstructs every field and rejects native-script, row, ingredient-identity and measurement errors. The backend no longer conflates cancellation and timeout. Qwen 4B still has genuine CPU/memory limits; the app does not claim it can never fail.

**Persistent translation reuse:** approved base translations remain in SQLite. Generated serving variants use a content-hashed atomic disk cache in `backend/.cache/translations`, keyed by recipe/source, language, servings, provider/model/version and approved base content. The directory is private, ignored by Git and bounded to 500 entries. English source edits invalidate matching old translations; source hashes prevent old generated variants from being reused for changed content. An optional `OLLAMA_MODEL_VERSION` allows explicit cache invalidation when replacing a model under the same tag. Known reviewed numeric quantity phrases in starter translations can be scaled deterministically, preserving approved steps and avoiding an LLM request. Ambiguous amounts require a validated translation rather than guessing.

**Prepare missing translations:** an administrator can queue missing Telugu/Hindi translations for published recipes from the AI panel. Existing translations are preserved. The existing durable SQLite job worker runs one recipe at a time, records each successful language and resumes interrupted jobs after restart. Queue creation is serialized to avoid duplicate preparation jobs. Failed jobs can retry remaining work. The action is explicit; public browsing never triggers a bulk translation run.

**Graceful voice behavior:** missing translations show useful preparation/error feedback and Continue in English. All English steps, ingredients, quantities, favorites, authentication and download actions remain available. A pending serving-variant translation no longer blocks narration of approved cooking steps; Full Recipe waits for accurate ingredient amounts. Restart rebuilds the queue using the current language and servings. No sentence playback calls Qwen. Pantry generation also uses the generation deadline and cancels on navigation/input changes, with shared backend work protected from another caller's cancellation. Existing real audio queue behavior remains in place.

**Animation:** the uploaded 53-second reference was sampled and inspected. Its food scenes combine dark photography, oversized serif words and layered imagery. The existing sous-chef section now has a burgundy geometric image frame, clipped photo reveal, sequential masked words, italic burgundy/amber sweep, restrained waveform, existing food photography and botanical decoration, followed by the unchanged description, benefits and CTA. A scoped GSAP timeline and ScrollTrigger clean up on navigation. Parallax is omitted on low-power devices; reduced motion presents static readable content. The rest of the website keeps its cream/burgundy identity.

## Windows CMD setup and commands

Use separate terminals. Preserve existing `.env` files. Stop this project's backend before reinstalling dependencies if Prisma's native DLL is locked; do not terminate unrelated processes.

```bat
cd /d C:\Recipe\RecipeFinder_Reviewed_Full_Source\RecipeFinder
npm ci --prefix backend
npm ci --prefix frontend
npm run db:generate --prefix backend
npm run admin:check --prefix backend
npm run build --prefix backend
npm run dev --prefix backend
```

In the frontend terminal:

```bat
cd /d C:\Recipe\RecipeFinder_Reviewed_Full_Source\RecipeFinder
npm run dev --prefix frontend
```

For production builds use `npm run build --prefix frontend`, then `npm start --prefix frontend`, and `npm start --prefix backend` after its build. Existing database setup remains `npm run setup --prefix backend`, using versioned migrations and idempotent seeding; this task needs no new migration. Do not use reset or `db push` to apply these changes.

PDF export uses installed Microsoft Edge on Windows. The renderer does not download a browser automatically. For another installation set `PDF_BROWSER_EXECUTABLE` privately to its absolute executable path. On Linux, install a compatible Chromium and its OS dependencies deliberately, or use the existing browser Print fallback. Include `backend/assets/fonts` and licenses in a deployed backend.

Optional settings to add to the existing backend `.env` (defaults already work; do not replace credentials/database settings):

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
OLLAMA_CONNECT_TIMEOUT_MS=5000
OLLAMA_GENERATION_TIMEOUT_MS=240000
OLLAMA_TRANSLATION_TIMEOUT_MS=300000
AI_MAX_CONCURRENT=1
AI_QUEUE_LIMIT=6
AI_QUEUE_TIMEOUT_MS=90000
OLLAMA_NUM_CTX=4096
OLLAMA_MAX_OUTPUT_TOKENS=3072
OLLAMA_NUM_THREADS=2
OLLAMA_KEEP_ALIVE=0
OLLAMA_MODEL_VERSION=1
PDF_TIMEOUT_MS=45000
```

Normal browser API calls have a 20-second deadline; foreground generation allows 370 seconds, translation 410 seconds, and a translation-plus-PDF download 480 seconds. These bounds accommodate the server's queue/inference/render deadlines rather than applying one long timeout to every endpoint. PDF rendering itself defaults to 45 seconds, plus at most 15 seconds waiting for the separate renderer. The inference queue can expire before a slow running model finishes; that outcome is reported as queue-wait expiry and can be retried deliberately.

```bat
curl http://127.0.0.1:11434/api/tags
curl http://localhost:5000/api/ai/status
curl --fail-with-body -X POST http://localhost:5000/api/recipes/andhra-chicken-curry/download -H "Origin: http://localhost:3000" -H "Content-Type: application/json" -d "{\"lang\":\"en\",\"servings\":8}" --output Andhra-Chicken-Curry-English.pdf
```

Local speech installation/start commands remain in [MASTER_WINDOWS_SETUP.md](MASTER_WINDOWS_SETUP.md). English/stored-language PDFs do not require the speech service or Ollama to be running. Newly generated translations require the configured translation provider. Generated PDF files open offline.

## Verification and limitations

| Check | Executed result |
| --- | --- |
| Backend | **94 passed**, zero failed. Includes existing auth/admin/pantry/related/narration checks, bounded AI queue/cancellation/error classification, persistent disk cache/source invalidation, safe filenames/HTML, deterministic serving scaling, real multi-page PDF output, missing-browser fallback, offline English/stored Telugu downloads, publication restrictions and precompute administrator permissions. `verification/improvements-backend-tests.log`. |
| Frontend | TypeScript and optimized production build passed. `verification/improvements-frontend-build.log`. |
| Lint | Focused ESLint correctness/security rules passed. `verification/improvements-lint.log`. The isolated ESLint 9 toolchain has the previously documented upstream end-of-support warning; it is not an application dependency. |
| Browser downloads | Real English, Telugu and Hindi downloads with the expected filenames passed. Modal English default is independent of voice language; Escape, Cancel, focus restoration and keyboard wrapping passed. `verification/improvements-browser-results.json`. |
| PDF contents/rendering | Real API exports have three pages. Eight-serving English/Telugu exports preserve all ingredients and all six steps. A separate long fixture produces nine pages and all 40 ingredients/30 instructions. PDFs were reopened offline, rasterized, inspected and checked for missing glyphs; zero missing glyphs were detected. Static fonts embed named Noto Sans Telugu/Devanagari subsets. `verification/pdf-inspection.json`, `verification/inspect-pdfs.py`, `verification/recipe-*.pdf`. |
| Failure UX | Injected translation timeout keeps all English recipe steps and Download usable. A failed Telugu PDF operation retains the dialog and offers English explicitly. No English PDF was silently renamed Telugu. |
| Animation | Desktop 1440px, tablet 820px, mobile 390px and reduced-motion checks passed; no horizontal overflow, visible words/CTA, one accessible heading, working CTA and back navigation. Screenshots: `verification/voice-cinema-*.png`. |
| Actual narration regression | All six Telugu steps completed with real Piper Padmavathi audio, maximum one simultaneous clip. Pause/resume, read-one, next/previous, stop, language switch and recipe navigation passed. `verification/browser-live-improvements-results.json`. Earlier English/Hindi live results remain in `verification/browser-live-results.json`. |
| Production dependency audits | Frontend and backend both reported zero known vulnerabilities. `verification/improvements-frontend-audit.json`, `verification/improvements-backend-audit.json`. |
| Live uncached translation probes | The configured installed Qwen3 4B model was connected, but neither new small-fixture translation succeeded. Hindi reached the 300-second deadline. The Telugu probe also failed; its 4,269-second wall time includes a long execution pause affecting shell tools as well, so it is not a useful inference-speed benchmark. `verification/improvements-real-ollama.json`. |

Browser failure scenarios use explicitly injected errors; successful PDF downloads use the real API/SQLite/Chromium path. Tests do not replace user recipes with fixtures. Long-document fixtures exist only as verification artifacts and isolated test data. One startup test timed out while browser/build work overlapped; rerunning it alone and the full sequential suite passed. Modal keyboard and animation timing checks caught issues during implementation and passed after correction. Physical speaker output still requires human listening.

The bundled starter database currently has complete stored Telugu/Hindi ingredient/step translations for three recipes; the other nine need admin preparation or reviewed translations. The new preparation action was not invoked against the user's database during testing, so no unrequested bulk inference or replacement data was written. Stored metadata can remain in English as labelled above. Amount phrases outside the exact reviewed dictionary may still need AI for serving changes. These limitations are shown rather than hidden.

PDF generation requires a supported installed browser. The active local setup has Edge; non-Windows browser installation was not exercised. Browser and model timings depend on memory pressure. Concurrency, queues and caches are scoped to one backend process; run one backend for this SQLite/local-laptop deployment. The renderer and AI can run independently, but an overloaded machine can still need the Print fallback.

Fresh Qwen translations remain an unresolved hardware/performance limitation in this session. The work fixes scheduling, cancellation, misleading errors, persistent reuse and isolation of failures; it does not establish successful uncached Hindi/Telugu generation on this laptop. Existing validated translations, deterministic serving variants, English exports and real speech remain usable. A configured timer also cannot make a suspended or paused process respond while execution is stopped. No additional unbounded retry or automatic model switch was introduced.

Security review: backend authorization, session handling, CSRF/origin enforcement, restricted CORS and input limits remain. Downloads expose only published recipes, never user data. PDF text is escaped; arbitrary URLs, redirects, scripts and browser network access are blocked. Font licenses are bundled. The private translation cache is not served as static content. Frontend secrets and existing environment credentials were not changed. No production deployment or blanket security certification was performed.

The complete uncommitted change manifest, including earlier narration work, is [RECIPE_IMPROVEMENTS_FILES.md](RECIPE_IMPROVEMENTS_FILES.md). No tracked source files were deleted.

Sources for the implementation strategy: [Playwright PDF API](https://playwright.dev/docs/api/class-page#page-pdf), [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md), [Noto font assets and licenses](https://github.com/googlefonts/noto-fonts). These describe supported APIs; executed local results are the evidence for this machine.
# Guided cooking revision — 31 October 2026

Cooking now defaults to one spoken step at a time. The narrator reads the recipe's estimated minutes and asks the cook to select Mark done. Ending an audio clip does not complete a cooking step or start the next one. The player button and step-list checkbox share completion state; marking the current step done announces its actual elapsed time since starting it, then narrates the next unfinished step. Elapsed time is separate from the recipe's estimate and does not assert food is cooked. Restart cooking clears progress. Explicit navigation remains available.

Auto-play all steps is an opt-in checkbox. It reads the remaining step instructions continuously and leaves completion under the cook's control. The separate Read full recipe continuously button reads the introduction, scaled ingredients and all instructions. Language changes cancel pending audio and retain cooking progress. Native-language step narration remains usable while updated ingredient quantities are translating.

The original bundled fish-curry recipe has complete offline Telugu and Hindi translations. They are validated with the same native-script, row, measurement and temperature checks as generated translations and saved through the existing transactional translation cache. They apply only when the source content and servings match the bundled recipe, and never replace an existing saved translation. Edited recipes and other uncached recipes still use the configured translation provider. Connection errors now explain that the recipe server cannot be reached rather than exposing the browser's raw Failed to fetch message; English remains available.

Validation artifacts: `verification/guided-cooking-backend-tests.log`, `verification/guided-cooking-results.json`, `verification/guided-cooking-telugu.png`, and `verification/guided-cooking-browser.cjs`. Browser checks use real Express routes, local TTS WAVs and browser media events; headless playback does not verify physical speaker audibility. All 96 backend tests pass. Backend compilation, frontend production build (exit code 0) and targeted lint checks pass. The browser run completed 7 real audio clips and verified guided waiting, shared Mark done progression, opt-in auto-play, native Telugu playback and the Hindi translation endpoint. A separate injected connection failure verified clear errors, English recovery and a 390-pixel mobile layout without horizontal overflow.

