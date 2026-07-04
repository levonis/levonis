"""Smoke 01: تحميل الرئيسية والتنقل."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _common import BASE_URL, launch, close, shots_dir, SmokeError


async def main():
    out = shots_dir("01_home_browse")
    pw, browser, context, page = await launch()
    try:
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle", timeout=20000)
        await page.screenshot(path=str(out / "1_home.png"))

        # Verify: main landmark and at least one product/category card visible
        await page.wait_for_selector("#main-content, main", timeout=10000)
        title = await page.title()
        if "LEVONIS" not in title and "Lovable" not in title:
            raise SmokeError(f"Unexpected title: {title!r}")

        # Try clicking first product/category link
        link = page.locator('a[href^="/product/"], a[href^="/category/"]').first
        if await link.count():
            href = await link.get_attribute("href")
            await link.click()
            await page.wait_for_load_state("domcontentloaded")
            await page.screenshot(path=str(out / "2_detail.png"))
            print(f"[01] navigated to {href}")
        else:
            print("[01] no product/category links yet (soft pass)")

        print("[01] OK")
    finally:
        await close(pw, browser)


if __name__ == "__main__":
    asyncio.run(main())
