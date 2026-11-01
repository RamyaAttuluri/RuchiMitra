# Recipe downloads, AI reliability and cinematic motion

Read [RECIPE_IMPROVEMENTS.md](RECIPE_IMPROVEMENTS.md) for multilingual PDF downloads, the bounded AI queue and persistent translation reuse, the video-inspired voice feature section, current tests and Windows commands. [RECIPE_IMPROVEMENTS_FILES.md](RECIPE_IMPROVEMENTS_FILES.md) lists the complete workspace changes. Earlier speech setup and evidence follow below.

# Local AI and speech implementation

Read [MASTER_WINDOWS_SETUP.md](MASTER_WINDOWS_SETUP.md) for Windows commands and model licenses, [MASTER_IMPLEMENTATION_REPORT.md](MASTER_IMPLEMENTATION_REPORT.md) for current test evidence and limitations, and [MASTER_CHANGED_FILES.md](MASTER_CHANGED_FILES.md) for the complete change list. Local speech has been exercised with real browser audio; full-length Ollama translation is still subject to the limitations in the report.

# Earlier correction: AI jobs and audio

Read **AUDIO_AND_AI_FIXES.md** for the admin timeout and silent-playback correction. Current validation: 59 backend tests and 10 browser checks.

# RuchiMitra — database startup and local-image fix

Both complete projects are included in `backend/` and `frontend/`.

Windows users: start with **START_HERE_WINDOWS.md**. Missing-table errors are addressed in **backend/DATABASE_REPAIR.md**. See **FIXES_AND_VALIDATION.md** for this correction. Start with **DEPLOYMENT.md** for local setup, environment variables, existing-database handling and optional HTTPS deployment. See **FILE_CHANGES.md** for every created, updated and deleted source file and **REVIEW_AND_TESTS.md** for fixes, evidence and remaining checks.

This is a tested code revision, not certification that every scenario is defect-free. Live provider credentials, real-device audio and staging deployment must pass before launch. Rotate the credential included in the original environment example. No live credentials, user database, installed dependencies or old build output are included.
