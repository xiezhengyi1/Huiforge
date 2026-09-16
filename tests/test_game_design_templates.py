from backend.huiju.catalog.models import CAPABILITY_GROUPS, generation_prompt_for


GAME_TEMPLATE_IDS = {"character-sheet", "game-scene", "item-design"}


def game_templates() -> dict[str, dict[str, str]]:
    group = next(group for group in CAPABILITY_GROUPS if group["id"] == "game-anime")
    return {item["id"]: item for item in group["items"] if item["id"] in GAME_TEMPLATE_IDS}


def test_game_design_templates_use_any_available_image_generation_route() -> None:
    templates = game_templates()
    assert set(templates) == GAME_TEMPLATE_IDS
    for template in templates.values():
        assert template["action"] == "model"
        assert template["availability"] == "image_generation"
        assert template["model"]
        assert template["input_hint"]
        assert template["input_help"]
        assert template["prompt"]


def test_game_design_templates_keep_user_brief_and_server_structure_together() -> None:
    cases = {
        "character-sheet": ("红发荒野信使，带机械义肢", "恰好三个全身标准视图"),
        "game-scene": ("暴雨中的海底观测站大厅", "前中后景层级"),
        "item-design": ("可折叠蒸汽朋克侦察无人机", "右侧三个不重复的结构或材质细节视图"),
    }
    for capability_id, (brief, structure) in cases.items():
        prompt = generation_prompt_for({
            "model": "bailian_qwen_3",
            "capability_id": capability_id,
            "prompt": brief,
            "style": "illustration",
        })
        assert brief in prompt
        assert structure in prompt
