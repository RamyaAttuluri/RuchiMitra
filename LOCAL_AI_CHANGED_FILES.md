# Local AI and narration file changes

Exact task file list; local tools, downloaded packages, model assets, secrets and build output are excluded. The SQLite schema and user database are unchanged.

## Modified

- `.gitignore`
- `backend/package.json`
- `backend/src/ai.ts`
- `backend/src/server.ts`
- `backend/tests/api.test.ts`
- `frontend/components/admin/admin-ai-generator.tsx`
- `frontend/components/admin/admin-dashboard.tsx`
- `frontend/components/recipe-detail.tsx`
- `frontend/components/voice-player.tsx`
- `frontend/hooks/use-recipe-voice.ts`
- `frontend/lib/api.ts`
- `frontend/lib/types.ts`
- `frontend/next.config.ts`

## Created

- `LOCAL_AI_CHANGED_FILES.md`
- `LOCAL_AI_VALIDATION.md`
- `LOCAL_AI_WINDOWS.md`
- `backend/.env.example`
- `backend/scripts/test.mjs`
- `backend/src/local-services.ts`
- `backend/tests/local-services.test.ts`
- `backend/tests/narration.test.ts`
- `backend/tts/download_models.py`
- `backend/tts/requirements-translation.txt`
- `backend/tts/requirements.txt`
- `backend/tts/sample-hi.json`
- `backend/tts/sample-te.json`
- `backend/tts/server.py`
- `backend/tts/setup-neural.sh`
- `backend/tts/start-espeak.cmd`
- `backend/tts/test_server.py`
- `backend/tts/verify_wav.py`
- `backend/tts/voices.example.json`
- `frontend/.env.example`
- `frontend/lib/narration.ts`
- `verification/backend-tests.log`
- `verification/browser-audio-results.json`
- `verification/browser-audio.cjs`
- `verification/browser-queue-results.json`
- `verification/browser-queue.cjs`
- `verification/english-device-sample.wav`
- `verification/frontend-build.log`
- `verification/inference-health.json`
- `verification/python-tests.log`
