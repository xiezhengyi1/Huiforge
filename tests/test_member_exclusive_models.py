import pytest

from backend.huiju.catalog.pricing import MEMBER_EXCLUSIVE_MODELS, image_quote, video_quote
from backend.huiju.runtime import RelayState


FREE_WALLET = {"membership_tier": "free", "membership_expires_at": None}


class ChargeRecorder:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def charge_wallet(self, owner: str, total: int, buckets: list[str], label: str, **kwargs: object) -> None:
        self.calls.append({"owner": owner, "total": total, "buckets": buckets, "label": label, **kwargs})


def free_relay() -> tuple[RelayState, ChargeRecorder]:
    relay = RelayState.__new__(RelayState)
    recorder = ChargeRecorder()
    relay.database = recorder
    relay.wallet_for = lambda _owner: FREE_WALLET
    return relay, recorder


def test_only_the_selected_current_flagships_require_membership() -> None:
    assert MEMBER_EXCLUSIVE_MODELS == {
        "bailian_qwen_3_pro",
        "bailian_wan_2_7_pro",
        "google_nano_banana_pro",
        "google_nano_banana_2",
        "seedream_5_0_pro",
        "wan3.0-video-prime",
    }


def test_free_user_can_use_standard_paid_image_and_video_models_with_daily_credits() -> None:
    relay, recorder = free_relay()

    image_cost = relay.charge_credits("free-user", "bailian_wan_2_7", 1, "1k")
    video_quote_result = relay.charge_video_credits("free-user", "wan3.0-video", "720P", 2, has_video_input=False)

    assert image_cost == image_quote("bailian_wan_2_7", "1k", member=False)["total_credits"]
    assert video_quote_result["total_credits"] == video_quote("wan3.0-video", "720P", 2, False, member=False)["total_credits"]
    assert [call["buckets"] for call in recorder.calls] == [["daily", "monthly", "topup"], ["daily", "monthly", "topup"]]


def test_free_user_is_still_blocked_from_the_selected_flagships() -> None:
    relay, recorder = free_relay()

    with pytest.raises(ValueError, match="paid_plan_required"):
        relay.charge_credits("free-user", "bailian_wan_2_7_pro", 1, "1k")
    with pytest.raises(ValueError, match="paid_plan_required"):
        relay.charge_video_credits("free-user", "wan3.0-video-prime", "720P", 2, has_video_input=False)

    assert recorder.calls == []
