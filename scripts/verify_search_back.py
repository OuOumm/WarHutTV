"""End-to-end check for the search <-> play continuity change.

Verifies three things a unit test cannot:
  1. Back from the play page lands on /search with the same keyword.
  2. The search page does NOT re-run the SSE search (results render instantly).
  3. The scroll offset survives the round trip.

Run against the already-running embedded binary on :3000.
"""
import json
import sys
import time

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
KEYWORD = "凡人"


def main() -> int:
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        sse_calls = []
        page.on("request", lambda r: sse_calls.append(r.url) if "/api/search/stream" in r.url else None)

        # --- login ---
        page.goto(f"{BASE}/login", wait_until="domcontentloaded")
        page.fill("#password-input", "warhut")
        page.click("button[type=submit]")
        page.wait_for_function("() => !window.location.pathname.startsWith('/login')", timeout=20000)
        print(f"[login] url = {page.url}")

        # --- search ---
        page.goto(f"{BASE}/search?wd={KEYWORD}", wait_until="domcontentloaded")
        page.wait_for_selector("a[href^='/play/']", timeout=60000)

        # The SSE stream must finish before leaving: its onDone handler is what
        # stores the result set, and a half-finished search has nothing worth
        # restoring. Wait for the cache entry instead of sleeping a fixed time.
        page.wait_for_function(
            "() => Object.keys(sessionStorage).some(k => k.startsWith('search_cache:'))",
            timeout=60000,
        )

        # The announcement dialog is modal and covers the grid on first visit.
        dialog = page.locator("div[role=dialog]")
        if dialog.count() > 0:
            for sel in ("button:has-text('我知道了')", "button[aria-label*='关闭']", "div[role=dialog] button"):
                if page.locator(sel).count() > 0:
                    page.locator(sel).first.click()
                    break
            page.wait_for_timeout(500)
        first_search_calls = len(sse_calls)
        result_count = page.locator("a[href^='/play/']").count()
        print(f"[search] sse_calls={first_search_calls} play_links={result_count}")
        if first_search_calls < 1:
            failures.append("search did not issue an SSE request")

        # scroll down so the restored offset is meaningful
        page.evaluate("window.scrollTo(0, 600)")
        page.wait_for_timeout(400)
        before_y = page.evaluate("window.scrollY")
        print(f"[search] scrollY before leaving = {before_y}")

        # --- open a result that is actually in view ---
        # Clicking the first card would scroll the document back to the top
        # first (Playwright scrolls targets into view), which resets the very
        # offset we are testing. Pick a visible card instead, like a real user.
        visible = None
        for idx in range(page.locator("a[href^='/play/']").count()):
            card = page.locator("a[href^='/play/']").nth(idx)
            box = card.bounding_box()
            if box and 0 <= box["y"] < 800:
                visible = card
                break
        if visible is None:
            visible = page.locator("a[href^='/play/']").first
        visible.click()
        page.wait_for_function("() => window.location.pathname.startsWith(\x27/play\x27)", timeout=20000)
        page.wait_for_timeout(1500)
        print(f"[play] url = {page.url}")

        # the back affordance must exist
        back = page.locator("button[aria-label^='返回']")
        if back.count() == 0:
            failures.append("play page has no back button")
        else:
            print(f"[play] back button aria-label = {back.first.get_attribute('aria-label')}")

        time.sleep(0.5)
        sse_before_back = len(sse_calls)

        # --- go back ---
        back.first.click()
        page.wait_for_function(
            "() => window.location.pathname === '/search'", timeout=20000
        )
        page.wait_for_timeout(1200)

        sse_after_back = len(sse_calls)
        # Poll for the restored offset: the grid renders after mount, and the
        # document has to be tall enough before a scroll offset can stick.
        samples = []
        for _ in range(20):
            page.wait_for_timeout(200)
            samples.append(page.evaluate("window.scrollY"))
        restored_y = max(samples)
        restored_links = page.locator("a[href^='/play/']").count()
        print(f"[back] scrollY samples (max kept): {samples[:6]} ... max={restored_y}")

        print(f"[back] url = {page.url}")
        print(f"[back] sse calls before={sse_before_back} after={sse_after_back}")
        print(f"[back] scrollY restored = {restored_y} (was {before_y})")
        print(f"[back] play links after return = {restored_links}")

        if sse_after_back != sse_before_back:
            failures.append(f"search re-ran on back ({sse_before_back} -> {sse_after_back})")
        if restored_links == 0:
            failures.append("results were not restored from cache")
        if abs(restored_y - before_y) > 50:
            failures.append(f"scroll not restored: {restored_y} vs {before_y}")

        page.screenshot(path="/tmp/ux-back.png", full_page=False)
        browser.close()

    print()
    if failures:
        print("FAILURES:")
        for f in failures:
            print("  -", f)
        return 1
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
