"""Shared helpers for Playwright smoke tests."""
import os
from pathlib import Path
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

BASE_URL = os.environ.get("SMOKE_BASE_URL", "http://localhost:8080")
HEADLESS = os.environ.get("SMOKE_HEADLESS", "1") != "0"
VIEWPORT = {"width": 1280, "height": 1800}
SHOTS_ROOT = Path("/tmp/browser/smoke")


def shots_dir(name: str) -> Path:
    d = SHOTS_ROOT / name
    d.mkdir(parents=True, exist_ok=True)
    return d


async def launch():
    pw = await async_playwright().start()
    browser: Browser = await pw.chromium.launch(headless=HEADLESS)
    context: BrowserContext = await browser.new_context(viewport=VIEWPORT, locale="ar")
    page: Page = await context.new_page()
    page.set_default_timeout(15000)
    return pw, browser, context, page


async def close(pw, browser):
    await browser.close()
    await pw.stop()


class SmokeError(Exception):
    pass
