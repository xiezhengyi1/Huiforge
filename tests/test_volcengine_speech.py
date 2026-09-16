import base64
import json
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

sys.modules.setdefault("httpx", SimpleNamespace(Response=object, AsyncClient=object))

from backend.huiju.providers import volcengine_speech


class VolcengineSpeechServiceTests(unittest.TestCase):
    def test_new_console_api_key_headers(self):
        with (
            patch.object(volcengine_speech, "DOUBAO_SPEECH_API_KEY", "test-api-key"),
            patch.object(volcengine_speech, "DOUBAO_SPEECH_RESOURCE_ID", "seed-tts-2.0"),
        ):
            headers = volcengine_speech.VolcengineSpeechService._headers("request-id")

        self.assertEqual(headers["X-Api-Key"], "test-api-key")
        self.assertEqual(headers["X-Api-Resource-Id"], "seed-tts-2.0")
        self.assertEqual(headers["X-Api-Request-Id"], "request-id")
        self.assertNotIn("Authorization", headers)

    def test_payload_uses_seed_tts_v3_contract(self):
        payload = volcengine_speech.VolcengineSpeechService._payload(
            "owner-1",
            "request-id",
            {
                "text": "你好，这是语音测试。",
                "voice": "zh_female_vv_uranus_bigtts",
                "language_type": "Chinese",
                "format": "wav",
                "speed_ratio": 1.2,
                "emotion": "happy",
            },
        )

        params = payload["req_params"]
        self.assertEqual(params["text"], "你好，这是语音测试。")
        self.assertEqual(params["speaker"], "zh_female_vv_uranus_bigtts")
        self.assertEqual(params["audio_params"]["format"], "mp3")
        self.assertEqual(params["audio_params"]["speech_rate"], 20)
        self.assertEqual(params["audio_params"]["emotion"], "happy")
        self.assertEqual(json.loads(params["additions"])["explicit_language"], "zh-cn")

    def test_sse_audio_chunks_are_joined(self):
        first = base64.b64encode(b"ID3first").decode()
        second = base64.b64encode(b"second").decode()
        response = SimpleNamespace(
            headers={"Content-Type": "text/event-stream"},
            text=f'data: {{"code":0,"data":"{first}"}}\n\ndata: {{"code":0,"data":"{second}"}}\n\ndata: [DONE]\n',
            content=b"",
        )

        audio = volcengine_speech.VolcengineSpeechService._decode_response(response)

        self.assertEqual(audio, b"ID3firstsecond")


if __name__ == "__main__":
    unittest.main()
