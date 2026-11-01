import array
import json
import math
import sys
import wave

with wave.open(sys.argv[1], 'rb') as audio:
    if audio.getsampwidth() != 2 or audio.getcomptype() != 'NONE':
        raise SystemExit('Expected uncompressed PCM16 WAV')
    duration = audio.getnframes() / audio.getframerate()
    samples = array.array('h', audio.readframes(audio.getnframes()))
    if sys.byteorder != 'little':
        samples.byteswap()
if not samples:
    raise SystemExit('Empty audio')
peak = max(abs(x) for x in samples) / 32768
rms = math.sqrt(sum(x * x for x in samples) / len(samples)) / 32768
if peak < .001 or rms < .0001:
    raise SystemExit('Silent audio')
print(json.dumps({'duration': duration, 'peak': peak, 'rms': rms, 'audible_on_device': 'requires human listening'}))
