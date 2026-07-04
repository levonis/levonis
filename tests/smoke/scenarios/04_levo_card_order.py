"""Smoke 04: فتح صفحة المكافآت و CTA بطاقة LEVO."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _common import BASE_URL, launch, close, shots_dir


async def main():
    out = shots_dir("04_levo_card_order")
    pw, browser, context, page = await launch()
    try:
        await page.goto(f"{BASE_URL}/rewards", wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle", timeout=20000)
        await page.screenshot(path=str(out / "1_rewards.png"))

        cta = page.get_by_role("button", name=lambda n: n and ("LEVO" in n.upper() or "بطاق" in n))
        count = await cta.count()
        print(f"[04] LEVO CTA count: {count}")
        if count:
            await cta.first.click()
            await page.wait_for_timeout(1500)
            await page.screenshot(path=str(out / "2_cta_click.png"))
        print("[04] OK")
    finally:
        await close(pw, browser)


if __name__ == "__main__":
    asyncio.run(main())
