"""Internal, loopback-only inference service. No cloud synthesis or automatic downloads."""
import io
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
LOCK = threading.BoundedSemaphore(1)
ENGINE = os.getenv('LOCAL_TTS_ENGINE', 'auto')
TTS = None
TRANSLATOR = None
VOICES = {}
LANGUAGES = []
ERROR = 'Not initialized'
TRANSLATION_ERROR = 'Set INDICTRANS_MODEL_PATH to downloaded, reviewed assets'


def initialize():
    global TTS, TRANSLATOR, VOICES, LANGUAGES, ERROR, TRANSLATION_ERROR
    try:
        if ENGINE in ['auto', 'piper']:
            from light_tts import LightTTS
            TTS = LightTTS(ROOT)
            LANGUAGES = sorted({v['language'] for v in TTS.voices.values()})
        elif ENGINE == 'espeak':
            binary = os.getenv('ESPEAK_BINARY') or shutil.which('espeak-ng')
            if not binary:
                raise RuntimeError('Install eSpeak NG and set ESPEAK_BINARY')
            listing = subprocess.run([binary, '--voices'], capture_output=True, text=True, timeout=10, check=True).stdout
            available = {line.split()[1] for line in listing.splitlines()[1:] if len(line.split()) > 1}
            LANGUAGES = [lang for lang in ['en', 'te', 'hi'] if lang in available]
            TTS = binary
        elif ENGINE == 'indicf5':
            config = Path(os.getenv('REFERENCE_VOICES_FILE', str(ROOT / 'voices.json')))
            VOICES = json.loads(config.read_text(encoding='utf-8'))
            for lang, voice in VOICES.items():
                if lang not in ['te', 'hi'] or not voice.get('authorized') or not voice.get('license') or not voice.get('transcript'):
                    raise RuntimeError('Each reference voice requires authorization, license and matching transcript')
                voice['audio'] = str((config.parent / voice['audio']).resolve())
                if not Path(voice['audio']).is_file():
                    raise RuntimeError('Reference audio is missing')
            if not VOICES:
                raise RuntimeError('Configure at least one authorized reference voice')
            model_path = os.environ['INDICF5_MODEL_PATH']
            if not Path(model_path).is_dir():
                raise RuntimeError('INDICF5_MODEL_PATH must be a reviewed local model directory')
            from transformers import AutoModel
            # The upstream model uses custom Python. Setup requires operator review before this load.
            TTS = AutoModel.from_pretrained(model_path, trust_remote_code=True, local_files_only=True)
            LANGUAGES = list(VOICES)
        elif ENGINE == 'none':
            ERROR = ''
        else:
            raise RuntimeError('LOCAL_TTS_ENGINE must be indicf5 or espeak')
        ERROR = ''
    except Exception as exc:
        ERROR = f'{type(exc).__name__}: {exc}'
        TTS = None
        LANGUAGES = []
    if os.getenv('INDICTRANS_MODEL_PATH'):
        try:
            import torch
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
            from IndicTransToolkit.processor import IndicProcessor
            location = os.environ['INDICTRANS_MODEL_PATH']
            tokenizer = AutoTokenizer.from_pretrained(location, trust_remote_code=True, local_files_only=True)
            model = AutoModelForSeq2SeqLM.from_pretrained(location, trust_remote_code=True, local_files_only=True).eval()
            device = os.getenv('TRANSLATION_DEVICE', 'cpu')
            model = model.to(device)
            TRANSLATOR = (torch, tokenizer, model, IndicProcessor(inference=True), device)
            TRANSLATION_ERROR = ''
        except Exception as exc:
            TRANSLATION_ERROR = f'{type(exc).__name__}: {exc}'


def synthesize(text, language, speed=1, voice='default'):
    if TTS is None:
        raise RuntimeError('TTS is unavailable. Configure model assets and authorized reference voices.')
    if language not in LANGUAGES:
        raise ValueError('Language is not configured')
    if ENGINE in ['auto', 'piper']:
        return TTS.synthesize(text, language, speed, voice)
    if ENGINE == 'espeak':
        with tempfile.TemporaryDirectory(prefix='recipe-tts-') as directory:
            target = Path(directory) / 'clip.wav'
            subprocess.run([TTS, '-v', language, '-s', str(round(160 * speed)), '-w', str(target), '--stdin'], input=text.encode('utf-8'), capture_output=True, timeout=60, check=True)
            return target.read_bytes()
    import numpy as np
    import soundfile as sf
    voice = VOICES[language]
    audio = np.asarray(TTS(text, ref_audio_path=voice['audio'], ref_text=voice['transcript']))
    if audio.dtype == np.int16:
        audio = audio.astype(np.float32) / 32768.0
    if speed != 1:
        import librosa
        audio = librosa.effects.time_stretch(audio.astype(np.float32), rate=speed)
    buffer = io.BytesIO()
    sf.write(buffer, audio.astype(np.float32), 24000, format='WAV', subtype='PCM_16')
    return buffer.getvalue()


def translate(texts, language):
    if TRANSLATOR is None:
        raise ValueError(TRANSLATION_ERROR)
    torch, tokenizer, model, processor, device = TRANSLATOR
    target = {'te': 'tel_Telu', 'hi': 'hin_Deva'}[language]
    translated = []
    # Small batches keep CPU RAM bounded. Never truncate cooking text silently.
    for text in texts:
        if not text.strip():
            translated.append('')
            continue
        batch = processor.preprocess_batch([text], src_lang='eng_Latn', tgt_lang=target)
        tokens = tokenizer(batch, padding=True, truncation=False, return_tensors='pt').to(device)
        if tokens['input_ids'].shape[1] > 256:
            raise ValueError('Translation row exceeds model limit; split and review it in the admin editor')
        with torch.inference_mode():
            output = model.generate(**tokens, max_new_tokens=256, num_beams=5)
        if output.shape[1] >= 256:
            raise ValueError('Translation was truncated; review it in the admin editor')
        decoded = tokenizer.batch_decode(output, skip_special_tokens=True)
        translated.extend(processor.postprocess_batch(decoded, lang=target))
    return translated


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def respond(self, status, data, content_type='application/json', engine=None, voice=None):
        if not isinstance(data, bytes):
            data = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        if content_type == 'audio/wav':
            self.send_header('X-Narration-Engine', engine or ENGINE)
            if voice:
                self.send_header('X-Narration-Voice', voice)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if self.path != '/health':
            return self.respond(404, {'detail': 'Not found'})
        voices = list(TTS.voices.values()) if TTS is not None and ENGINE in ['auto', 'piper'] else []
        self.respond(200, {'tts': {'available': TTS is not None, 'engine': ENGINE, 'version': os.getenv('TTS_MODEL_VERSION') or getattr(TTS, 'version', 'v1'), 'languages': LANGUAGES, 'voices': voices, 'engineErrors': getattr(TTS, 'errors', []), 'error': ERROR}, 'translation': {'available': TRANSLATOR is not None, 'engine': 'indictrans2', 'error': TRANSLATION_ERROR}})

    def do_POST(self):
        # This service is called by Express, never by a webpage. Reject browser-origin requests.
        if self.headers.get('Origin'):
            return self.respond(403, {'detail': 'Use the Express API, not the internal inference service'})
        if self.path not in ['/synthesize', '/translate']:
            return self.respond(404, {'detail': 'Not found'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 65536:
                return self.respond(413, {'detail': 'Request too large or empty'})
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('Expected a JSON object')
            language = data.get('language')
            if language not in ['en', 'te', 'hi']:
                raise ValueError('Unsupported language')
            if self.path == '/synthesize':
                text = data.get('text')
                if not isinstance(text, str) or not 1 <= len(text.strip()) <= 1500:
                    raise ValueError('Text must contain 1 to 1500 characters')
                if not isinstance(data.get('voice', 'default'), str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,150}', data.get('voice', 'default')) or not .5 <= float(data.get('speed', 1)) <= 2:
                    raise ValueError('Invalid voice or speed')
            else:
                texts = data.get('texts')
                if language == 'en' or not isinstance(texts, list) or not 1 <= len(texts) <= 174 or any(not isinstance(t, str) or len(t) > 1500 for t in texts):
                    raise ValueError('Invalid translation rows')
            if not LOCK.acquire(blocking=False):
                return self.respond(503, {'detail': 'Inference is busy. Try again after the current request completes.'})
            try:
                if self.path == '/synthesize':
                    audio = synthesize(text, language, float(data.get('speed', 1)), data.get('voice', 'default'))
                    if isinstance(audio, tuple):
                        self.respond(200, audio[0], 'audio/wav', audio[1], audio[2])
                    else:
                        self.respond(200, audio, 'audio/wav')
                else:
                    self.respond(200, {'translations': translate(texts, language)})
            finally:
                LOCK.release()
        except (ValueError, KeyError) as exc:
            self.respond(422, {'detail': str(exc)})
        except Exception:
            self.respond(503, {'detail': 'Local inference failed. Check model dependencies, memory and reference audio.'})


if __name__ == '__main__':
    initialize()
    print(f'Local inference: engine={ENGINE}, languages={LANGUAGES}, tts_error={ERROR}, translation_error={TRANSLATION_ERROR}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', int(os.getenv('INFERENCE_PORT', '8001'))), Handler).serve_forever()
