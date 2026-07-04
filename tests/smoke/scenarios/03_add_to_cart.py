"""Smoke 03: إضافة منتج للسلة."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _common import BASE_URL, launch, close, shots_dir, SmokeError


async def main():
    out = shots_dir("03_add_to_cart")
    pw, browser, context, page = await launch()
    try:
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle", timeout=20000)

        link = page.locator('a[href^="/product/"]').first
        if await link.count() == 0:
            print("[03] SKIPPED — no product cards found on home")
            return
        await link.click()
        await page.wait_for_load_state("networkidle", timeout=15000)
        await page.screenshot(path=str(out / "1_product.png"))

        add = page.get_by_role("button", name=lambda n: n and ("أضف" in n or "إضافة" in n or "سلة" in n or "Add" in n or "Cart" in n))
        if await add.count() == 0:
            print("[03] SKIPPED — no visible Add-to-Cart button (may require options)")
            return
        await add.first.click()
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(out / "2_after_add.png"))

        # Check cart page reachable
        await page.goto(f"{BASE_URL}/cart", wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle", timeout=15000)
        await page.screenshot(path=str(out / "3_cart.png"))
        print("[03] OK")
    finally:
        await close(pw, browser)


if __name__ == "__main__":
    asyncio.run(main())
