@echo off
setlocal
cd /d "%~dp0"
py -3.13 -m venv .venv-piper
if errorlevel 1 exit /b 1
.venv-piper\Scripts\python.exe -m pip install --upgrade pip==26.2.2
if errorlevel 1 exit /b 1
.venv-piper\Scripts\python.exe -m pip install -r requirements-light.txt
if errorlevel 1 exit /b 1
echo Lightweight CPU runtime installed. Use download-piper.py for reviewed voice assets.
