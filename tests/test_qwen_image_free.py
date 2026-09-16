import unittest
from collections import defaultdict, deque
from pathlib import Path

from backend.huiju.core.config import QWEN_IMAGE_REQUESTS_PER_MINUTE
from backend.huiju.catalog.pricing import image_quote, pricing_catalog
from backend.huiju.runtime import RelayState


class _WalletMustNotBeRead:
    def wallet_for(self, *_args, **_kwargs):
        raise AssertionError("free Qwen generation must not read the wallet")


class QwenImageFreeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app_js = (Path(__file__).resolve().parents[1] / "frontend" / "js" / "app.js").read_text(encoding="utf-8")

    def test_every_resolution_and_batch_is_zero_credits(self):
        for member in (False, True):
            for resolution in ("480p", "720p", "1k", "2k", "4k"):
                quote = image_quote("qwen_image", resolution, count=4, member=member)
                self.assertEqual(quote["unit_credits"], 0)
                self.assertEqual(quote["total_credits"], 0)

    def test_free_catalog_declares_only_the_time_limit(self):
        free = pricing_catalog()["free"]
        self.assertTrue(free["unlimited_usage"])
        self.assertIsNone(free["max_images_per_day"])
        self.assertEqual(free["resolution"], "all")
        self.assertEqual(free["rate_limit_per_minute"], 10)

    def test_charge_bypasses_wallet_and_daily_allowance(self):
        relay = RelayState.__new__(RelayState)
        relay.database = _WalletMustNotBeRead()
        self.assertEqual(relay.charge_credits("owner", "qwen_image", 9, "4k"), 0)

    def test_qwen_rate_limit_allows_ten_requests_per_minute(self):
        relay = RelayState.__new__(RelayState)
        relay.rate_windows = defaultdict(deque)
        key = "qwen-image-user:owner"
        results = [
            relay.check_rate_limit(key, limit=QWEN_IMAGE_REQUESTS_PER_MINUTE)
            for _ in range(QWEN_IMAGE_REQUESTS_PER_MINUTE + 1)
        ]
        self.assertEqual(results[:-1], [True] * 10)
        self.assertFalse(results[-1])

    def test_frontend_never_uses_stale_paid_qwen_price(self):
        self.assertIn('if (model === "qwen_image") return 0;', self.app_js)
        self.assertIn('qwen_image:0, zimage_turbo:3', self.app_js)
        self.assertIn('Qwen-Image-2512 免费使用，每分钟最多 10 次', self.app_js)


if __name__ == "__main__":
    unittest.main()
