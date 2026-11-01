"""Explicit, revision-pinned downloads. Restricted voices require an explicit development flag."""
import argparse
import json
from pathlib import Path
import urllib.request
import hashlib

VOICES = {
    'te_IN-padmavathi-medium': ('te', 'padmavathi', 'CC-BY-4.0 dataset; retain MODEL_CARD and attribution', False),
    'te_IN-maya-medium': ('te', 'maya', 'IIT Madras IndicTTS custom terms; permission must be reviewed', True),
    'hi_IN-pratham-medium': ('hi', 'pratham', 'CC-BY-NC-SA-4.0', True),
    'hi_IN-priyamvada-medium': ('hi', 'priyamvada', 'CC-BY-NC-SA-4.0', True),
}
REVISION = '5041a7a49ae5b3a0f30e6837769eb03fdbb231bd'
parser = argparse.ArgumentParser()
parser.add_argument('voice', choices=VOICES)
parser.add_argument('--development-only', action='store_true')
args = parser.parse_args()
language, speaker, license_name, restricted = VOICES[args.voice]
if restricted and not args.development_only:
    parser.error('This voice is restricted or requires separate permission. Use only for authorized development with --development-only. Hindi eSpeak is the unrestricted-model alternative.')
root = Path(__file__).resolve().parent
directory = root / 'models' / 'piper' / args.voice
directory.mkdir(parents=True, exist_ok=True)
base = f'https://huggingface.co/rhasspy/piper-voices/resolve/{REVISION}/{language}/{language}_IN/{speaker}/medium/'
files = {}
for filename in ['MODEL_CARD', args.voice + '.onnx.json', args.voice + '.onnx']:
    target = directory / filename
    temporary = target.with_suffix(target.suffix + '.part')
    try:
        urllib.request.urlretrieve(base + filename, temporary)
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    files[filename] = hashlib.sha256(target.read_bytes()).hexdigest()
(directory / 'ATTRIBUTION.json').write_text(json.dumps({'voice': args.voice, 'repository': 'rhasspy/piper-voices', 'revision': REVISION, 'source': base, 'license': license_name, 'sha256': files, 'trainer': 'See MODEL_CARD; Telugu padmavathi trained by PravalX using AI4Bharat IndicVoices-R'}, indent=2), encoding='utf-8')
config = root / 'piper-voices.json'
definitions = json.loads(config.read_text(encoding='utf-8')) if config.exists() else []
definitions = [definition for definition in definitions if definition['id'] != args.voice]
definitions.append({'id': args.voice, 'language': language, 'model': str((directory / (args.voice + '.onnx')).relative_to(root)).replace('\\', '/'), 'license': license_name, 'developmentOnly': restricted})
config.write_text(json.dumps(definitions, indent=2), encoding='utf-8')
print('Downloaded', args.voice, 'License:', license_name, 'Restart the internal TTS service.')
