import unittest

from backend.huiju.domains.generation.reference_prompts import assemble_reference_prompt


class ReferencePromptTests(unittest.TestCase):
    def test_seedance_uses_at_image_syntax(self):
        self.assertEqual(
            assemble_reference_prompt("让@图片2转身，看向@图1", "seedance_2_5", 2),
            "让@Image 2转身，看向@Image 1",
        )

    def test_wan_uses_chinese_image_number(self):
        self.assertEqual(
            assemble_reference_prompt("参考 @Image 1 的人物", "wan2.7-r2v-2026-06-12", 1),
            "参考 图片1 的人物",
        )

    def test_image_models_use_qwen_style_numbering(self):
        self.assertEqual(
            assemble_reference_prompt("保留@图片1，采用@图片2的光线", "qwen_image_edit", 2),
            "保留图1，采用图2的光线",
        )

    def test_plain_prompt_is_unchanged(self):
        self.assertEqual(assemble_reference_prompt("电影感逆光", "seedream_5_0", 0), "电影感逆光")

    def test_missing_reference_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "reference_prompt_image_out_of_range"):
            assemble_reference_prompt("参考@图片3", "seedance_2_0", 2)


if __name__ == "__main__":
    unittest.main()
