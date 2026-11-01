@echo off
setlocal
cd /d "%~dp0"
set LOCAL_TTS_ENGINE=espeak
python server.py
