#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
case "${1:-}" in
  tts)
    python3.10 -m venv .venv-tts
    .venv-tts/bin/python -m pip install -r requirements.txt
    .venv-tts/bin/python -m pip install 'git+https://github.com/AI4Bharat/IndicF5.git@13f7c4d627cc10111aea8fe9c0039462cacacdc7'
    ;;
  translation)
    python3.10 -m venv .venv-translation
    .venv-translation/bin/python -m pip install -r requirements-translation.txt
    ;;
  *) echo 'Usage: bash setup-neural.sh tts|translation'; exit 2 ;;
esac
echo 'Dependencies installed. Download authorized model assets and review custom code before starting.'
