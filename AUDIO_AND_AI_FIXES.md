# Admin generation timeout and silent playback correction

This release contains the complete frontend/backend source plus all previous database, image and pantry fixes. The new issues shown in the screenshots are addressed by changes to request architecture and audio output handling.

## Administrator generation

The previous route asked the provider for the English recipe and both translations in one response, under a 55-second deadline. The screenshots show that request ending in HTTP 504. Increasing a browser spinner cannot solve that architecture.

The route now responds **202 Accepted** with a persisted job ID. The worker generates an English recipe, saves it as a draft, then translates Telugu and Hindi in separate requests. The UI polls short progress requests instead of keeping the original HTTP connection open. Each admin stage has a bounded 120-second provider deadline; transient server errors have at most one retry. Gemini 3 text requests use low thinking effort for this writing task and omit deprecated sampling parameters. Public synchronous text requests retain a bounded shorter deadline.

Jobs are stored in the new AiJob table. Startup applies its forward migration automatically and resumes jobs interrupted by a restart. Session storage lets the requesting administrator reconnect after a page reload. A failed translation keeps the English draft and any completed translation; **Retry remaining work** resumes the job without creating another draft. **Review saved draft** opens that partial draft for manual review. Only the requesting administrator can read/retry a job, and admin authorisation is still required. One worker processes this single-backend SQLite deployment; do not run multiple backend instances without a coordinated queue/lease design.

Provider outages, exhausted quotas, rejected keys or a request exceeding its per-stage deadline can still make a stage fail. The work is retained with a retry path; no claim is made that an external AI service can never time out. Recipe publication remains manual.

## Audio output

A browser speech-synthesis start event does not prove that audio reached a speaker. The screenshot shows a browser voice reporting speech; the screenshot cannot establish the hardware mute/output state.

- A configured cloud provider is now selected by default, bypassing the unreliable browser voice path in that case. The user can still choose an installed voice.
- **No sound? Use cloud audio** switches the current step to server audio immediately.
- Volume is explicit and defaults to 100%. Audio elements are unmuted, routed through a gain node and the browser audio context is unlocked/resumed from a user action.
- **Test speakers** emits a short local tone without an AI request. It also gives clear tab/device-output guidance.
- Browser utterances are held by a strong reference, have start/completion watchdogs, and can switch to another voice or cloud on a reported/stalled failure.
- Google Cloud TTS uses PCM WAV output. WAV structure and signal amplitude are validated server-side; Gemini PCM is also checked before wrapping it as WAV. Empty, malformed or silent PCM is rejected rather than returned as successful audio.
- Cloud clips are decoded and checked for nonzero signal in the browser before playback. Failed/aborted requests do not poison a promise cache, and failed clips are evicted so retry can fetch fresh audio.
- Pause/resume, stop, language changes and unmount still cancel the previous playback run and release resources. Audio caches remain bounded.

If the speaker-test tone is also inaudible, unmute the browser tab/site and check Windows volume, Volume Mixer and the selected output device (speakers/headphones/Bluetooth). Application code cannot override operating-system mute, disconnected speakers or a muted tab. Do not interpret the speaking animation alone as an audibility test.

## Setup and update

1. Stop the old servers and extract this ZIP to a fresh folder. Keep your existing private environment values and back up the database/uploads.
2. In backend run `npm ci`, then `npm run dev`. For compiled startup run `npm run build`, then `npm start`. Both normal start flows apply migrations first, including AiJob.
3. In frontend run `npm ci`, then `npm run dev` (or build and start). Avoid copying old node_modules, .next or dist folders.
4. Retain a valid backend GEMINI_API_KEY for recipes/translations. For audio use GOOGLE_TTS_API_KEY with Google Cloud Text-to-Speech enabled, or GEMINI_API_KEY with an accessible GEMINI_TTS_MODEL. The example uses gemini-3.8-flash-tts. Restart after changing provider settings.
5. Generate a recipe in admin, observe the progress stage, and review/publish the completed draft. If a stage fails, use Retry remaining work.
6. On a recipe, start with Test speakers, then Test voice or Play. Cloud audio is selected automatically when configured. Use the recovery button if an installed voice is silent.

Existing migrated databases receive the new table without resetting recipes/accounts. For legacy databases without migration history, follow backend/DATABASE_REPAIR.md. The initial six-table baseline is unchanged; the second migration adds AiJob. A fresh database now has seven application tables.

## Verification

- Backend TypeScript build passed.
- Backend automated suite: **59 passed, 0 failed**.
- Frontend clean production build passed.
- Browser regression run: **10 checks passed**, no page JavaScript exceptions.
- The real HTTP/SQLite tests prove the admin POST returns 202 while the provider stage is held pending, enforce user/admin access, validate completed translations, preserve a draft on failure and retry it without duplication.
- Worker tests cover single claim, error state and resuming interrupted work. A provider deadline test verifies the controlled AI_TIMEOUT path.
- Audio tests accept non-silent PCM/WAV and reject silence, empty and malformed audio.
- In headless Chromium, a mocked non-silent WAV was decoded and its nonzero samples measured in the actual browser media-output graph. Pause/resume, volume, test-tone guidance and rejection of silent WAV passed. A simulated browser voice that reports start without audio was switched immediately to non-silent cloud playback.
- Browser job tests cover progress, reload/reconnect without re-submission and opening the editor on completion.

The browser provider was mocked; these tests do not certify live Google/Gemini credentials, spoken translation accuracy or sound from the user's physical speakers. Live provider calls, real Windows/Android/iOS listening and HTTPS/Docker deployment still need staging/device verification. Test runtime was Linux, Node 24.22.1 and Chromium. The supplied deployment uses Node 22 LTS.

Official references checked October 28, 2026:
- https://ai.google.dev/gemini-api/docs/generate-content/thinking
- https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.8
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/start_event

See FILE_CHANGES.md for the exact current and cumulative source changes. No live keys or user database are included.
