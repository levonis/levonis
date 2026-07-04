"""Smoke 02: تسجيل الدخول (يتطلب SMOKE_USER_EMAIL/PASSWORD)."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _common import BASE_URL, launch, close, shots_dir, SmokeError


async def main():
    email = os.environ.get("SMOKE_USER_EMAIL")
    password = os.environ.get("SMOKE_USER_PASSWORD")
    if not (email and password):
        print("[02] SKIPPED — SMOKE_USER_EMAIL/PASSWORD not set")
        return
    out = shots_dir("02_login")
    pw, browser, context, page = await launch()
    try:
        await page.goto(f"{BASE_URL}/auth", wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle", timeout=15000)
        await page.screenshot(path=str(out / "1_auth.png"))

        # Fill email + password (heuristic selectors)
        await page.locator('input[type="email"], input[name="email"]').first.fill(email)
        await page.locator('input[type="password"]').first.fill(password)
        await page.screenshot(path=str(out / "2_filled.png"))

        # Submit
        btn = page.get_by_role("button", name=lambda n: n and ("دخول" in n or "تسجيل" in n or "Sign" in n or "Log" in n))
        if await btn.count() == 0:
            btn = page.locator('button[type="submit"]').first
        await btn.first.click()
        await page.wait_for_load_state("networkidle", timeout=15000)
        await page.screenshot(path=str(out / "3_after_login.png"))

        # Verify session by checking localStorage for supabase session
        has_session = await page.evaluate(
            "() => Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'))"
        )
        if not has_session:
            raise SmokeError("No supabase session in localStorage after login")
        print("[02] OK")
    finally:
        await close(pw, browser)


if __name__ == "__main__":
    asyncio.run(main())
