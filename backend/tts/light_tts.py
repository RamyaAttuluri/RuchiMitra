"""CPU-only Piper voices and eSpeak fallback. No network calls during synthesis."""
import ctypes
import hashlib
import io
import json
import os
from pathlib import Path
import wave

RESTRICTED_VOICES = {'hi_IN-pratham-medium', 'hi_IN-priyamvada-medium', 'te_IN-maya-medium'}


def voice_allowed(definition, allow_noncommercial, environment):
    restricted = definition.get('developmentOnly') or definition.get('id') in RESTRICTED_VOICES or 'BY-NC' in definition.get('license', '').upper()
    return not restricted or allow_noncommercial == 'true' and environment != 'production'


class LightTTS:
    def __init__(self, root):
        self.voices = {}
        self.piper = {}
        self.lib = None
        self.rate = 0
        self.chunks = []
        self.engine = 'piper + espeak-ng'
        self.errors = []
        try:
            import espeakng_loader
            self.lib = ctypes.CDLL(espeakng_loader.get_library_path())
            self.lib.espeak_Initialize.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_char_p, ctypes.c_int]
            self.lib.espeak_Initialize.restype = ctypes.c_int
            self.lib.espeak_SetVoiceByName.argtypes = [ctypes.c_char_p]
            self.lib.espeak_SetParameter.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int]
            self.lib.espeak_Synth.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_uint, ctypes.c_int, ctypes.c_uint, ctypes.c_uint, ctypes.POINTER(ctypes.c_uint), ctypes.c_void_p]
            self.rate = self.lib.espeak_Initialize(2, 0, str(espeakng_loader.get_data_path()).encode(), 0)
            if self.rate <= 0:
                raise RuntimeError('eSpeak initialization failed')
            callback_type = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
            def receive(samples, count, _events):
                if samples and count:
                    self.chunks.append(ctypes.string_at(samples, count * 2))
                return 0
            self.callback = callback_type(receive)
            self.lib.espeak_SetSynthCallback.argtypes = [callback_type]
            self.lib.espeak_SetSynthCallback(self.callback)
            for lang in ['en', 'te', 'hi']:
                if self.lib.espeak_SetVoiceByName(lang.encode()) == 0:
                    self.voices[f'espeak-{lang}'] = {'id': f'espeak-{lang}', 'language': lang, 'engine': 'espeak-ng', 'license': 'GPL-3.0-or-later (engine)', 'developmentOnly': False, 'available': True, 'modelVersion': 'espeakng-loader-0.2.4'}
        except Exception as exc:
            self.errors.append(f'eSpeak: {type(exc).__name__}')
            self.lib = None
        config = Path(os.getenv('PIPER_VOICES_FILE', str(root / 'piper-voices.json')))
        if config.is_file():
            for definition in json.loads(config.read_text(encoding='utf-8')):
                try:
                    if not voice_allowed(definition, os.getenv('ALLOW_NONCOMMERCIAL_VOICES'), os.getenv('NODE_ENV')):
                        continue
                    if len(self.piper) >= 2:
                        self.errors.append('At most two Piper models are loaded on this CPU profile')
                        continue
                    from piper import PiperVoice
                    if definition.get('language') not in ['en', 'te', 'hi'] or not definition.get('license'):
                        raise ValueError('Invalid voice metadata')
                    path = (config.parent / definition['model']).resolve()
                    # Loading proves the ONNX/config are usable rather than just present.
                    voice = PiperVoice.load(str(path), use_cuda=False)
                    self.piper[definition['id']] = voice
                    self.voices[definition['id']] = {key: definition[key] for key in ['id', 'language', 'license', 'developmentOnly']}
                    self.voices[definition['id']].update({'engine': 'piper', 'available': True})
                    with path.open('rb') as model:
                        self.voices[definition['id']]['modelVersion'] = hashlib.file_digest(model, 'sha256').hexdigest()
                except Exception as exc:
                    self.errors.append(f"{definition.get('id', 'piper')}: {type(exc).__name__}")
        if not self.voices:
            raise RuntimeError('No usable local voices. Install the lightweight TTS requirements.')
        self.version = hashlib.sha256(json.dumps(self.voices, sort_keys=True).encode()).hexdigest()

    def choose(self, language, voice):
        if voice == 'default':
            options = [v for v in self.voices.values() if v['language'] == language]
            options.sort(key=lambda v: v['engine'] != 'piper')
            if not options:
                raise ValueError('No compatible local voice')
            return options[0]
        chosen = self.voices.get(voice)
        if not chosen or chosen['language'] != language:
            raise ValueError('Voice does not match the selected language')
        return chosen

    def synthesize(self, text, language, speed, voice='default'):
        selected = self.choose(language, voice)
        buffer = io.BytesIO()
        if selected['engine'] == 'piper':
            from piper import SynthesisConfig
            with wave.open(buffer, 'wb') as output:
                self.piper[selected['id']].synthesize_wav(text, output, syn_config=SynthesisConfig(length_scale=1 / speed))
        else:
            if self.lib.espeak_SetVoiceByName(language.encode()) != 0:
                raise ValueError('eSpeak voice unavailable')
            self.lib.espeak_SetParameter(1, round(160 * speed), 0)
            self.chunks = []
            encoded = ctypes.create_string_buffer(text.encode('utf-8'))
            unique = ctypes.c_uint()
            result = self.lib.espeak_Synth(encoded, len(encoded), 0, 1, 0, 1 | 0x1000, ctypes.byref(unique), None)
            if result != 0:
                raise RuntimeError('eSpeak synthesis failed')
            with wave.open(buffer, 'wb') as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(self.rate)
                output.writeframes(b''.join(self.chunks))
        return buffer.getvalue(), selected['engine'], selected['id']
