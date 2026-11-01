# Local AI and narration verification

Historical record: see [MASTER_IMPLEMENTATION_REPORT.md](MASTER_IMPLEMENTATION_REPORT.md) for subsequent real local speech and Ollama tests. The earlier results below are retained as a record of that stage.

Date: 30 October 2026. This is an implementation and verification record, not a production-readiness certificate.

## Passed checks

- **Backend: 73 tests passed, 0 failed**, including existing authentication, admin draft/publish/archive, recipe editing, favorites, shopping ownership, pantry, database preservation and translation-cache integration. See `verification/backend-tests.log`.
- **Narration A/B:** actual six-step Andhra Chicken Curry Telugu and Paneer Butter Masala Hindi seed content traverses steps 1–6 exactly once, then Completed. Tests deliberately duplicate completion events and deliver stale failures.
- **Narration C:** English full mode contains one introduction, each ingredient with a unique queue ID, then six steps.
- **Narration D/E/G:** pause/resume at step 3, language and recipe cancellation, stale callbacks, stop, restart, single-step mode, next/previous and final completion. Loading/started/error events do not prematurely increment completion progress.
- **Narration F:** simulated Gemini 429 does not affect cached local WAVs. Explicit cloud quota failures try an advertised local provider once. Failed/JSON audio is rejected and not cached as a successful clip.
- **Serving quantities:** HTTP tests validate scaled ingredient rows, preserve approved translated steps, reuse the serving cache and leave the original database translation unchanged. The frontend cancels playback and waits for the new translation before enabling narration.
- **Ollama contract:** schema, model, disabled thinking, cancellation signal, error handling and private backend URL are verified with transport mocks. Generated recipe content remains validated before it is saved.
- **Python internal service: 4 tests passed.** Health does not invent available languages; missing assets, invalid inputs and concurrent requests return errors. See `verification/python-tests.log`.
- **Frontend TypeScript check and backend TypeScript build passed.** The optimized Next.js production build passed using `.next-validation`. See `verification/frontend-build.log`.
- **Real browser queue checks passed** for Telugu six-step continuation, Hindi six-step continuation, and English full mode (19 requests: introduction + 12 ingredients + 6 steps). Pause/resume at Telugu step 3 passed. The actual React player used nonempty, decodable English WAV fixtures and real HTML audio events. These tests validate sequence and state, not target-language speech. See `verification/browser-queue-results.json`.
- **Actual English audio file:** Windows Microsoft David/Zira voices are installed. Windows SAPI generated `verification/english-device-sample.wav`, 239,892 bytes, approximately 5.439 seconds. Edge decoded one channel with peak approximately 0.948 and RMS approximately 0.0865 and emitted `playing` followed by `ended`. See `verification/browser-audio-results.json`. These were real audio decode/media events, not mocked completion callbacks.

## Limits and incomplete runtime verification

- **Human-audible output is not verified.** The English media test ran in a headless Edge browser; it does not prove sound reached a speaker or that the user heard it.
- **Real Telugu/Hindi synthesis is not verified.** Ollama, IndicF5/IndicTrans2 weights, compatible neural Python environments and authorized reference voices are not installed. No target-language pronunciation or naturalness is claimed.
- **IndicF5 access:** unauthenticated model-file retrieval returned HTTP 401. No access restriction was bypassed. Upstream requires reference audio and an exact transcript; placeholder reference voices are intentionally unusable.
- **eSpeak installation was not performed.** Automatic approval review rejected the MSI extraction with “blocked by policy.” Its advertised language list is checked at runtime if the user installs it. No eSpeak synthesis success is claimed here.
- **Neural hardware performance is unbenchmarked.** The inspected machine has an i3 CPU, about 8 GB RAM, integrated Intel graphics and Python 3.14.3. IndicTransToolkit documents native Windows as untested. Separate WSL Python environments and installation scripts are provided; dependency installation, CPU/GPU inference, offline vocoder availability and neural service supervision still require deployment testing.
- **Saved translations are retained.** Numeric preservation is checked for newly generated local translations, but this is not proof of semantic fidelity or food-safety equivalence. Existing translated number words/timings remain authored content and require review.
- **Cancellation:** browser/network cancellation prevents stale playback immediately. An already running neural inference may continue internally until it returns; the service retains a single inference slot meanwhile. Cache entries are RAM-only and must be regenerated after a process restart. Increment model versions and refresh clients after changing reference voices.
- **Fresh-install deployment remains to be exercised** with actual licensed assets. No database reset or migration was needed or performed on the user's database. Automated database tests create isolated temporary databases.

## Failures found and addressed

The original Windows test command passed a literal `tests/*.test.ts` to Node. The new portable test launcher enumerates test files. Test concurrency is limited to one to reduce memory pressure on this laptop.

A normal frontend build could not open the live development server's `.next/trace` (`EPERM`). Validation now supports a separate output directory; that production build passed. The pre-existing multiple-lockfile warning remains.

Expanded serving-cache tests exhausted the shared generation limiter. Translation requests now have a separate bounded per-minute limiter, so reading a saved translation does not consume the cloud-generation hourly allowance. The final 73-test backend run passed.

The first browser queue attempt used port 3011 and failed to load recipe data because the application permits origin 3000. The fixture harness now supplies recipe responses explicitly. A subsequent attempt timed out fetching API data while this 8 GB machine had about 600 MB free RAM. The final isolated-fixture attempt passed all three browser queue cases; the earlier failures are retained here for transparency. The harness explicitly substitutes an English speech WAV for every synthesis response; even a passing queue check is not target-language synthesis proof.

## Reproduction

See `LOCAL_AI_WINDOWS.md` for CMD-compatible installation/start/health commands and manual Telugu/Hindi listening steps. Automated commands:

```bat
npm test --prefix backend
npm run build --prefix backend
npm run typecheck --prefix frontend
python -m unittest discover -s backend/tts -p test_server.py
set NEXT_BUILD_DIR=.next-validation
npm run build --prefix frontend
set NEXT_BUILD_DIR=
```

The optional browser harness uses a locally installed Playwright package, outside product dependencies:

```bat
npm install --prefix .local/browser-check --no-save playwright@1.64.1
node verification/browser-audio.cjs
```

The English WAV artifact is included so decoder verification can be reproduced without invoking a cloud API. For queue testing, start the validation production build on port 3011 and keep the existing backend running on 5000:

```bat
set NEXT_BUILD_DIR=.next-validation
node frontend/node_modules/next/dist/bin/next start frontend -p 3011
```

In another CMD window:

```bat
node verification/browser-queue.cjs
```
