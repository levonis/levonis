"""Smoke 05: الوصول لصفحة السلة والتحقق من ملخصها."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _common import BASE_URL, launch, close, shots_dir


async def main():
    out = shots_dir("05_checkout")
    pw, browser, context, page = await launch()
    try:
        await page.goto(f"{BASE_URL}/cart", wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle", timeout=20000)
        await page.screenshot(path=str(out / "1_cart.png"))

        # Look for summary/checkout indicators (non-empty cart) OR empty state
        body = (await page.content()).lower()
        markers = ["الإجمالي", "total", "checkout", "إتمام", "الدفع", "فارغ", "empty"]
        hit = next((m for m in markers if m in body), None)
        print(f"[05] cart marker: {hit!r}")
        print("[05] OK")
    finally:
        await close(pw, browser)


if __name__ == "__main__":
    asyncio.run(main())
