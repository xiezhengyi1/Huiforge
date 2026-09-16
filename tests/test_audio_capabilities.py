import unittest

from backend.huiju.catalog.models import CAPABILITY_GROUPS
from backend.huiju.api.schemas import ImageAnalysisInput


class AudioCapabilityTests(unittest.TestCase):
    def test_audio_sidebar_capabilities_open_main_composer(self):
        items = {
            item["id"]: item
            for group in CAPABILITY_GROUPS
            if group.get("id") == "sound"
            for item in group["items"]
        }
        self.assertEqual(items["unified-dubbing"]["action"], "audio_mode")
        self.assertEqual(items["unified-dubbing"]["mode"], "unified_audio")
        self.assertEqual(items["image-dubbing"]["mode"], "audio_image")
        self.assertEqual(items["custom-voice"]["action"], "audio_mode")
        self.assertEqual(items["custom-voice"]["mode"], "audio_custom_voice")
        self.assertEqual(items["custom-voice"]["model"], "qwen3-tts-instruct-flash")
        self.assertIn("文字定制", items["custom-voice"]["badges"])
        self.assertIn("参考音频选填", items["custom-voice"]["badges"])

    def test_image_analysis_accepts_narration_instruction(self):
        value = ImageAnalysisInput(upload_id="0" * 32, focus="narration", instruction="温柔旁白")
        self.assertEqual(value.focus, "narration")
        self.assertEqual(value.instruction, "温柔旁白")


if __name__ == "__main__":
    unittest.main()
