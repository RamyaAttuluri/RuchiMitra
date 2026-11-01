# Local recipe AI and narration — Windows setup

Historical record: current setup and real Piper/eSpeak verification are documented in [MASTER_WINDOWS_SETUP.md](MASTER_WINDOWS_SETUP.md) and [MASTER_IMPLEMENTATION_REPORT.md](MASTER_IMPLEMENTATION_REPORT.md). The earlier unverified IndicF5 environment below is not the active lightweight runtime.

Status on 30 October 2026: sequencing and integration are implemented and tested. Neural model inference and audible Telugu/Hindi device output are **not verified** on this computer. Do not treat this as a production certification. See `LOCAL_AI_VALIDATION.md` for evidence and remaining limitations. These instructions supersede the older cloud narration setup in this repository.

## Hardware and deployment choice

Inspected machine: Intel i3-1115G4, 8,311,832,576 bytes installed RAM (about 7.74 GiB), Intel UHD integrated graphics; no CUDA GPU detected. Python 3.14.3 is installed. Ollama, PyTorch, model assets and authorized reference voices are absent.

Use native Windows for Next.js, Express, Ollama, and optionally eSpeak NG. Use separate Linux/WSL Python 3.10 environments for neural TTS and translation, or run these internal services on a private machine with more memory. IndicTransToolkit explicitly says Windows is untested. Its current dependency recommendations conflict with the older IndicF5 dependency stack, so do not install them into one environment. No inference service is a public website.

Qwen3 4B can be attempted on the CPU; throughput and RAM use have not been benchmarked here. The three neural models plus Windows, Next.js and Express can exceed this machine's available memory. Run one inference task at a time; Ollama unloads after a generation (`keep_alive: 0`). More RAM and an upstream-compatible NVIDIA GPU would improve the neural deployment options; no particular GPU memory capacity or CPU real-time performance has been verified. Intel shared graphics memory is not CUDA VRAM.

## 1. Preserve configuration and the database

Open CMD in the project root. Keep your existing `backend\.env`, `DATABASE_URL`, administrator settings and SQLite database. Merge the new variables from `backend\.env.example` into the existing file; **do not overwrite it**. No migration, seed, reset, or database deletion is required for these changes.

Default backend settings:

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
AI_MAX_CONCURRENT=1
TRANSLATION_PROVIDER=local
TTS_PROVIDER=local
LOCAL_INFERENCE_URL=http://127.0.0.1:8001
TRANSLATION_INFERENCE_URL=http://127.0.0.1:8002
TTS_MODEL_VERSION=indicf5-v1
```

Keep `NEXT_PUBLIC_API_URL=http://localhost:5000/api` in `frontend\.env`. Never put model service URLs or cloud credentials into public frontend variables. If using cloud providers explicitly, credentials belong only in `backend\.env`. Existing saved recipes and saved translations do not need a running model.

## 2. Install Ollama and Qwen3

Install the official [Ollama Windows application](https://docs.ollama.com/windows). In a new CMD window:

```bat
ollama pull qwen3:4b
ollama list
curl http://127.0.0.1:11434/api/tags
```

The installed application normally starts Ollama automatically. If it is not running, use `ollama serve` in a separate terminal. Leave its HTTP endpoint private. Only Express calls it. Recipe generation uses a JSON schema derived from the existing recipe validator, then validates the result before saving it. An unavailable model returns an actionable error and does not delete existing data.

## 3. Lightweight CPU speech option

[eSpeak NG](https://github.com/espeak-ng/espeak-ng/releases) supports Hindi and Telugu and is GPL-3.0-or-later. It is a local formant synthesizer, **not neural AI**, and its voice quality will differ from IndicF5. It needs no reference speaker or model download. Install the official Windows release yourself, then confirm installed voices:

```bat
set "ESPEAK_BINARY=C:\Program Files\eSpeak NG\espeak-ng.exe"
"%ESPEAK_BINARY%" --voices
backend\tts\start-espeak.cmd
```

Adjust the executable path to the actual installation. The service advertises only languages listed by that executable. This option runs with the installed Python standard library, including Python 3.14. Set `TTS_MODEL_VERSION=espeak-1.52-voice-v1` in the backend when changing to this engine, then restart Express and refresh the browser. The attempted MSI extraction during development was blocked by automatic approval review; eSpeak synthesis is not claimed as tested here.

## 4. Neural environments and model downloads

The upstream [IndicF5 instructions](https://github.com/AI4Bharat/IndicF5) use Python 3.10 and require both reference audio and its exact transcript. Do not substitute Python 3.14. The [IndicTransToolkit requirements](https://github.com/VarunGumma/IndicTransToolkit#pre-requisites) call for Linux/macOS. A WSL setup is therefore the suggested Windows path, with compatibility still requiring actual model testing.

From CMD, install WSL if needed (Windows may require administrator access and a restart):

```bat
wsl --install -d Ubuntu-22.04
```

Complete Ubuntu setup, then install Python 3.10, its venv package, Git, a compiler, FFmpeg and libsndfile through the distribution package manager. From CMD in this project root, these commands invoke Linux explicitly:

```bat
wsl bash -lc "sudo apt-get update && sudo apt-get install -y python3.10-venv python3-pip git build-essential ffmpeg libsndfile1"
wsl bash backend/tts/setup-neural.sh tts
wsl bash backend/tts/setup-neural.sh translation
```

The scripts pin direct package versions and the upstream IndicF5 checkout. They have **not** been installed or tested here; they are not a fully audited transitive dependency lock. Inspect custom model Python and dependency licenses before loading. IndicF5 uses `trust_remote_code=True`; runtime restricts loading to the explicitly downloaded local directory and does not automatically download a new revision. A model's own loader may still request a vocoder or other assets: provision those in its cache before enabling `HF_HUB_OFFLINE=1`, then test offline startup. A failed startup advertises no working TTS languages.

Request any required Hugging Face access under the model's terms. The model file endpoint returned HTTP 401 without authorization in this session. Use an authorized download session; this code does not bypass access checks. Inspect the immutable revision, then download:

```bat
wsl backend/tts/.venv-tts/bin/python backend/tts/download_models.py indicf5 fb652a96e508091045890dae5bb99fe511facbcf backend/tts/models/indicf5
```

For IndicTrans2, obtain the reviewed 40-character revision from its [model repository](https://huggingface.co/ai4bharat/indictrans2-en-indic-dist-200M), replacing `REVIEWED_COMMIT_ID` below:

```bat
wsl backend/tts/.venv-translation/bin/python backend/tts/download_models.py indictrans2 REVIEWED_COMMIT_ID backend/tts/models/indictrans2
```

The downloader rejects branch names. Downloads are explicit and may require multiple GB of disk. No voices or weights are bundled with this repository.

Copy `backend\tts\voices.example.json` to `backend\tts\voices.json`. Supply authorized Telugu/Hindi reference WAVs, exact matching native-script transcripts, license/consent evidence, and set each `authorized` field to true only when justified. Paths are relative to the JSON file. Example placeholders intentionally fail validation. A model license does not grant permission to clone an arbitrary speaker.

Run TTS in a dedicated CMD window, replacing paths with absolute Linux paths (for this workspace, the project is under `/mnt/c/Recipe/RecipeFinder_Reviewed_Full_Source/RecipeFinder`):

```bat
wsl env LOCAL_TTS_ENGINE=indicf5 INDICF5_MODEL_PATH=/mnt/c/Recipe/RecipeFinder_Reviewed_Full_Source/RecipeFinder/backend/tts/models/indicf5 HF_HUB_OFFLINE=1 backend/tts/.venv-tts/bin/python backend/tts/server.py
```

Run translation in a second window:

```bat
wsl env LOCAL_TTS_ENGINE=none INFERENCE_PORT=8002 INDICTRANS_MODEL_PATH=/mnt/c/Recipe/RecipeFinder_Reviewed_Full_Source/RecipeFinder/backend/tts/models/indictrans2 HF_HUB_OFFLINE=1 backend/tts/.venv-translation/bin/python backend/tts/server.py
```

Each service binds only `127.0.0.1`; test Windows-to-WSL localhost forwarding. For a remote private machine, keep the service private and use an SSH tunnel or equivalent authenticated private connection. IndicF5's actual CPU/device behavior depends on the downloaded custom model; it has not been certified on this laptop. Do not advertise it as available until model initialization succeeds and generated audio passes testing.

## 5. Start the existing applications

Use separate CMD windows:

```bat
cd backend
npm ci
npm run dev
```

```bat
cd frontend
npm ci
npm run dev
```

Existing application startup behavior remains in place. Avoid database bootstrap or seeding commands against an existing installation unless independently required. Restart existing processes after configuration changes; do not start a second server on occupied ports.

## 6. Health, synthesis and complete playback

From CMD in the project root:

```bat
curl http://127.0.0.1:8001/health
curl http://127.0.0.1:8002/health
curl http://localhost:5000/api/tts/status
curl --fail-with-body -X POST http://localhost:5000/api/tts/synthesize -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --data-binary @backend/tts/sample-te.json --output verification/telugu.wav
python backend/tts/verify_wav.py verification/telugu.wav
curl --fail-with-body -X POST http://localhost:5000/api/tts/synthesize -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --data-binary @backend/tts/sample-hi.json --output verification/hindi.wav
python backend/tts/verify_wav.py verification/hindi.wav
```

An error response is JSON, not playable audio; `curl --fail-with-body` exits nonzero and the WAV validator rejects it. A valid WAV and nonzero signal are necessary but do not prove pronunciation or device audibility.

Open `http://localhost:3000/recipe/andhra-chicken-curry`, select Telugu, check the engine label, and use **Test voice**. Confirm that you actually hear Telugu. Use **Play step & continue** from step 1; verify all six highlighted steps, pause/resume on step 3, and final Completed. Repeat Hindi with `/recipe/paneer-butter-masala`. In English, test **Play full recipe**: one introduction, each ingredient, then steps 1–6. Test Stop, Next, Previous, Read step, Restart, and switching languages while audio is loading and playing. Check speakers/tab mute and volume. Human listening is still required for speech quality and physical output.

The introduction and steps come from the same saved recipe/translation shown in the UI. Manual “Mark done” checkboxes stay under user control. Progress counts successfully narrated steps, not merely the selected step. Browser pause cancels speech and Resume repeats the current short segment; server WAV pause resumes at the media position.

**Serving changes:** English ingredient narration scales immediately. Translated quantities are regenerated once by the local translation service and cached for the language/serving combination; approved step text is retained. Playback stops on quantity changes and stays disabled until validated translated ingredient rows arrive. If the local translator is unavailable, restore the original servings or start it. This avoids speaking stale quantities or guessing replacements inside number words. Model inference for this path still needs runtime validation with installed assets.

## 7. Limits and troubleshooting

The backend caches only validated PCM16 WAV audio, keyed by normalized text, language, provider, voice, speed and configured model version. It deduplicates concurrent identical requests and bounds RAM to 32 MiB/80 clips; the browser bounds its cache to 24 MiB/80 clips. Caches are in memory and disappear on restart; this is not persistent disk caching. Increment `TTS_MODEL_VERSION` after changing model/reference assets and refresh the page. Temporary eSpeak audio is removed after each call. Failed audio is never cached as success.

Synthesis has a backend timeout and one active synthesis slot; the internal service also rejects overlapping inference. Cancelling playback aborts the browser request and invalidates every old callback. An already running neural inference cannot be forcibly preempted by the Python HTTP handler: it retains its inference slot until it returns. Use process supervision and memory limits for a deployed service. Do not expose the unauthenticated Python service publicly. Translation uses separate local requests, validates numeric measurements and row counts, then retains the existing database cache. Semantic translation quality still needs review.

Gemini is used only after explicit opt-in. Quota errors are not retried indefinitely. On an explicit cloud TTS quota error, the backend tries a healthy local engine once, then reports the real error if unavailable. Cached audio remains usable without making another synthesis call. Browser voices marked online may still depend on their vendor's network; select a local server or installed offline voice for offline operation.

Run verification from the root:

```bat
npm test --prefix backend
npm run build --prefix backend
npm run typecheck --prefix frontend
python -m unittest discover -s backend/tts -p test_server.py
set NEXT_BUILD_DIR=.next-validation
npm run build --prefix frontend
set NEXT_BUILD_DIR=
```

The alternate build directory avoids locking the development server's `.next\trace` on Windows. The existing multiple-lockfile warning is unrelated to narration.

## License references

[Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B): Apache-2.0. [IndicF5 model card](https://huggingface.co/ai4bharat/IndicF5): MIT metadata; gated assets and every reference speaker still require appropriate access/permission. [IndicTrans2](https://github.com/AI4Bharat/IndicTrans2/blob/main/LICENSE) and [IndicTransToolkit](https://github.com/VarunGumma/IndicTransToolkit/blob/main/LICENSE): MIT. [eSpeak NG](https://github.com/espeak-ng/espeak-ng): GPL-3.0-or-later; external binary only, not redistributed here. PyTorch: BSD-3-Clause; Transformers: Apache-2.0. Preserve and inspect license notices for model dependencies/vocoders and any redistributed binaries. These references are not a complete deployment dependency audit.
