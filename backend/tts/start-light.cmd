@echo off
setlocal
cd /d "%~dp0"
set LOCAL_TTS_ENGINE=auto
.venv-piper\Scripts\python.exe server.py
