# Recipe Finder — current Windows setup

This is the current setup for the master prompt. It supersedes the earlier IndicF5-first instructions. The frontend, Express backend, SQLite database, Ollama and internal speech service remain separate. Existing users, passwords and recipes are retained. See `MASTER_IMPLEMENTATION_REPORT.md` for executed tests and limitations.

## Configuration

Open CMD in the existing project:

```bat
cd /d C:\Recipe\RecipeFinder_Reviewed_Full_Source\RecipeFinder
```

Keep existing environment files and values. Add missing settings to `backend\.env`; do not overwrite its database URL, administrator settings, or secrets:

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
OLLAMA_TIMEOUT_MS=240000
OLLAMA_KEEP_ALIVE=0
OLLAMA_NUM_CTX=4096
OLLAMA_MAX_OUTPUT_TOKENS=3072
OLLAMA_NUM_THREADS=2
AI_MAX_CONCURRENT=1
TRANSLATION_PROVIDER=ollama
TTS_PROVIDER=auto
TTS_CACHE_ENABLED=true
LOCAL_INFERENCE_URL=http://127.0.0.1:8001
```

Use `NEXT_PUBLIC_API_URL=http://localhost:5000/api` in the frontend's existing `.env` or `.env.local`. The frontend receives no Ollama URL, database URL, or private credential. Gemini is optional and is never used by the default local path. Examples are in each application's `.env.example`.

The installed Qwen model was verified through `/api/tags`; do not download or switch models unnecessarily:

```bat
ollama list
curl http://127.0.0.1:11434/api/tags
```

If the configured model is missing, explicitly install it with `ollama pull qwen3:4b`. If Ollama is not running, start the installed application or run `ollama serve` in its own terminal. Do not expose port 11434 to the internet.

## Lightweight local speech

The inspected laptop has an Intel i3-1115G4, approximately 8 GB RAM, Intel UHD graphics, and Python 3.13 and 3.14 installations. The tested speech environment uses **Python 3.13, CPU-only Piper and eSpeak NG**. It does not require CUDA, PyTorch, WSL, an API key, or a paid speech service.

Default Telugu: `te_IN-padmavathi-medium` with Piper. Default Hindi fallback: eSpeak NG `hi`. English prefers an installed matching browser voice; eSpeak English is also available through the server voice selector. eSpeak is a formant synthesizer with a more robotic sound than Piper; no claim of equal quality is made. Human listening is required to assess pronunciation and sound output.

The runtime and Telugu voice were installed and tested in this workspace. To reproduce on a fresh machine:

```bat
py -0p
backend\tts\setup-light.cmd
py -3.13 backend\tts\download-piper.py te_IN-padmavathi-medium
```

The downloader uses an immutable voice repository revision. It retains `MODEL_CARD`, source/attribution information, and SHA-256 hashes. Assets live in ignored `backend\tts\models`; the local voice configuration is `backend\tts\piper-voices.json`. Models and environment files are not committed.

In a separate CMD window, start speech:

```bat
cd /d C:\Recipe\RecipeFinder_Reviewed_Full_Source\RecipeFinder
backend\tts\start-light.cmd
```

The service binds only `127.0.0.1:8001`. Browser-origin POST requests are rejected; webpages must call Express. It processes one inference at a time, holds at most two Piper models, and uses no temporary disk audio for this default path. It loads only explicitly downloaded assets.

### Voice licenses

- [Piper engine](https://github.com/OHF-Voice/piper1-gpl): GPL-3.0-or-later. Retain notices and comply with corresponding-source obligations when distributing GPL binaries.
- [Telugu padmavathi model card](https://huggingface.co/rhasspy/piper-voices/raw/main/te/te_IN/padmavathi/medium/MODEL_CARD): identifies an AI4Bharat IndicVoices-R dataset under CC-BY-4.0, trained by PravalX. Preserve attribution and review all applicable terms before commercial redistribution. Dataset metadata is not an independent legal certification of every possible use.
- [Hindi pratham](https://huggingface.co/rhasspy/piper-voices/raw/main/hi/hi_IN/pratham/medium/MODEL_CARD) and [priyamvada](https://huggingface.co/rhasspy/piper-voices/raw/main/hi/hi_IN/priyamvada/medium/MODEL_CARD): CC-BY-NC-SA-4.0. They are **not downloaded or enabled by default**. Restricted model IDs are blocked in production, even if their local metadata omits the development flag.
- [Telugu maya](https://huggingface.co/rhasspy/piper-voices/raw/main/te/te_IN/maya/medium/MODEL_CARD): points to IIT Madras IndicTTS custom terms; commercial clearance was not established. It is treated as restricted.
- [eSpeak NG](https://github.com/espeak-ng/espeak-ng): GPL-3.0-or-later software; it avoids the above Hindi neural-model dataset restrictions. The loader wrapper is MIT, but that does not replace the embedded engine's GPL obligations.

For authorized non-commercial development only, an explicitly requested restricted model can be downloaded with `--development-only`. Loading also requires `ALLOW_NONCOMMERCIAL_VOICES=true` in the speech process and is still blocked when that process has `NODE_ENV=production`. This flag does not grant commercial rights or replace the model's terms. The tested default needs no restricted model.

## Backend and database

Stop only this workspace's backend before a fresh `npm ci` or an actual schema/client upgrade; Windows can lock Prisma's loaded engine DLL. Do not kill unrelated applications on port 5000.

```bat
npm ci --prefix backend
npm run setup --prefix backend
npm run admin:check --prefix backend
npm run build --prefix backend
npm start --prefix backend
```

For active development, use `npm run dev --prefix backend` instead of `npm start`, not both at once. Build output is `backend\dist\src\server.js`. Port conflicts now report the occupied port and a corrective action without terminating another process. Background AI jobs start only after the API successfully binds its port.

`setup` uses existing versioned migrations and an idempotent seed. `db:seed` remains available. Existing administrator passwords are not changed. No schema migration was required for this task: ingredient identities, optional/scalable flags, step IDs, numbers and heat metadata use the existing structured JSON columns. Existing records receive compatible metadata when read; new/edited records persist it. The database is never reset or replaced.

`db:generate` verifies schema tokens, generated client version, and the native engine before regenerating. An unchanged client avoids rewriting a DLL that a running backend holds open. If the schema or client version really changes, stop this backend and regenerate. To request a forced regeneration explicitly, use `npm run db:generate --prefix backend -- --force` after stopping it.

For a new administrator only, set both `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` privately in `backend\.env`, then run `npm run db:seed --prefix backend`. `admin:check` is read-only and never prints or changes passwords.

## Frontend

In another CMD window:

```bat
cd /d C:\Recipe\RecipeFinder_Reviewed_Full_Source\RecipeFinder
npm ci --prefix frontend
npm run dev --prefix frontend
```

Open `http://localhost:3000`. Search SQLite recipes first. AI generation is offered only when the search has no matches and the configured service is available. Navigating away cancels a foreground generation request. English ingredient quantities update with servings; non-scalable ingredients stay fixed. Translated serving variants require a validated translation and preserve approved step text.

The saved cookbook includes favorites, shopping lists, and account-scoped recent searches. Recent searches are stored only in the current browser tab, under the authenticated account's ID; they are not cross-device history. They can be cleared from the dashboard.

## Health and speech tests

```bat
curl http://localhost:5000/api/health
curl http://localhost:5000/api/ai/status
curl http://127.0.0.1:8001/health
curl http://localhost:5000/api/tts/status
curl http://localhost:5000/api/tts/voices
curl --fail-with-body -X POST http://localhost:5000/api/tts/synthesize -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --data-binary @backend/tts/sample-te.json --output verification/telugu.wav
py -3.13 backend/tts/verify_wav.py verification/telugu.wav
curl --fail-with-body -X POST http://localhost:5000/api/tts/synthesize -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --data-binary @backend/tts/sample-hi.json --output verification/hindi.wav
py -3.13 backend/tts/verify_wav.py verification/hindi.wav
```

The request supports `recipeId`, `recipeVersion`, `stepId`, `language`, `text`, `voice` and `speed`. Choose a voice ID returned by `/tts/voices`, or use `default`. Supported languages are `en`, `te`, and `hi`; voice-language mismatches fail. Speech responses are validated PCM16 WAVs with `X-Narration-Engine` and `X-Narration-Voice` headers. JSON failures are never returned as audio success.

The backend deduplicates synthesis and bounds its audio cache to 32 MiB/80 clips; the browser cache is bounded to 24 MiB/80 clips. Cache keys include recipe/version/item identity, text, language, voice, provider and model version. The active lightweight service derives a model fingerprint from the loaded Piper weights and engine versions. Failed audio is not cached. Set `TTS_CACHE_ENABLED=false` to disable caching. Caches are memory-only and disappear on restart. Refresh clients after changing installed voices.

Open `/recipe/andhra-chicken-curry`, select Telugu, and test the voice. Play all six steps, pause/resume on step 3, stop, restart, and change languages while playing. Repeat Hindi with `/recipe/paneer-butter-masala`. Test English Full Recipe for introduction, every ingredient, and all steps. Check device/tab volume and listen yourself; automated headless playback does not prove physical speaker output or pronunciation quality.

## Performance limits and deployment

A real six-step English recipe generation took about 191 seconds in this session. The first full Hindi translation was rejected by content validation; subsequent full Hindi/Telugu translation attempts timed out at the configured deadline. These outcomes are recorded, not presented as successful translations. Verified stored translations remain usable and source data is retained. Measurement placeholders and row validation prevent saving corrupted output; they cannot make a CPU language model fast or guarantee semantic correctness.

The context was subsequently reduced to 4096 tokens and the prompt batch to 64 for lower memory use. These settings do not establish a new full-recipe translation performance benchmark. Increase the bounded timeout only deliberately, select an explicitly configured smaller model if appropriate, or enter reviewed translations in the admin editor. Optional IndicTrans2/IndicF5 integrations from the earlier task remain available but were not installed or certified in this hardware setup; their legacy neural environments are outside the audited lightweight runtime.

For shared hosting, keep Ollama and speech private, use HTTPS and an exact `FRONTEND_ORIGIN`, deploy with `NODE_ENV=production`, replace demo credentials, and serve API/frontend on compatible HTTPS origins for Secure cookies. SQLite is appropriate for this local app; shared writes, backups and AI scheduling require deliberate server sizing. The one-request budget is per backend process, not a distributed queue. No production certification is claimed while full-length translation and human listening checks remain open.
