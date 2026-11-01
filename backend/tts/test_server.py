import json
from pathlib import Path
import threading
import unittest
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer
import server
from light_tts import voice_allowed


class InferenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.worker = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.worker.start()
        cls.base = f'http://127.0.0.1:{cls.http.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()

    def post(self, data):
        request = urllib.request.Request(self.base + '/synthesize', data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()

    def test_health_does_not_invent_languages(self):
        with urllib.request.urlopen(self.base + '/health') as response:
            health = json.load(response)
        self.assertFalse(health['tts']['available'])
        self.assertEqual(health['tts']['languages'], [])

    def test_missing_model_returns_json_failure_not_fake_audio(self):
        status, body = self.post({'text': 'A real recipe', 'language': 'te'})
        self.assertEqual(status, 503)
        self.assertIn('detail', json.loads(body))

    def test_input_limits_and_languages(self):
        for data in [{'text': '', 'language': 'en'}, {'text': 'a' * 1501, 'language': 'hi'}, {'text': 'a', 'language': 'fr'}, {'text': 'a', 'language': 'en', 'voice': '../file'}]:
            self.assertEqual(self.post(data)[0], 422)

    def test_bounded_inference(self):
        server.LOCK.acquire()
        try:
            self.assertEqual(self.post({'text': 'Recipe', 'language': 'hi'})[0], 503)
        finally:
            server.LOCK.release()

    def test_restricted_voices_require_opt_in_and_are_blocked_in_production(self):
        voice = {'id': 'hi_IN-pratham-medium', 'developmentOnly': False, 'license': 'CC-BY-NC-SA-4.0'}
        self.assertFalse(voice_allowed(voice, None, 'development'))
        self.assertTrue(voice_allowed(voice, 'true', 'development'))
        self.assertFalse(voice_allowed(voice, 'true', 'production'))
        self.assertTrue(voice_allowed({'id': 'te_IN-padmavathi-medium', 'license': 'CC-BY-4.0'}, None, 'production'))

    def test_internal_service_rejects_browser_origins(self):
        request = urllib.request.Request(self.base + '/synthesize', data=b'{}', headers={'Origin': 'https://untrusted.example'})
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(request)
        self.assertEqual(caught.exception.code, 403)


if __name__ == '__main__':
    unittest.main()
