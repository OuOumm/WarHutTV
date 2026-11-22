"""Home recommendation -> search: does the keyword reach 最近搜索?

The old recorder lived in the search box's submit handler, so a card click
(which is just a <Link to="/search?wd=...">) never recorded anything.
"""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
failures = []


def dismiss(page):
    d = page.locator("div[role=dialog]")
    if d.count() > 0:
        btns = d.locator("button")
        if btns.count() > 0:
            btns.last.click()
            page.wait_for_timeout(600)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 950})
    page = ctx.new_page()

    page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    page.fill("#password-input", "warhut")
    page.click("button[type=submit]")
    page.wait_for_function("() => !window.location.pathname.startsWith('/login')", timeout=20000)
    page.wait_for_timeout(2000)
    dismiss(page)

    print("history before:", page.evaluate("() => localStorage.getItem('searchHistory')"))

    # A home-page recommendation card links straight to /search?wd=...
    # The Douban sections arrive a few seconds after mount, so wait for a card
    # instead of grabbing a fixed sleep.
    try:
        page.wait_for_selector("a[href^='/search?wd=']", timeout=30000)
    except Exception:
        raise SystemExit("no recommendation cards appeared on home; cannot test")
    cards = page.locator("a[href^='/search?wd=']")
    print("recommendation cards:", cards.count())
    if cards.count() == 0:
        raise SystemExit("no recommendation cards on home; cannot test")

    title = cards.first.get_attribute("aria-label")
    cards.first.click()
    page.wait_for_function("() => window.location.pathname === '/search'", timeout=20000)
    page.wait_for_timeout(1500)

    stored = page.evaluate("() => localStorage.getItem('searchHistory')")
    print(f"clicked card {title!r}")
    print("history after:", stored)

    if not stored:
        failures.append("no history recorded after clicking a recommendation")
    else:
        import json
        entries = json.loads(stored)
        if not any(t in (title or "") or (title or "") in t for t in entries):
            failures.append(f"clicked title {title!r} missing from history {entries}")
        else:
            print(f"recorded as most recent: {entries[0]!r}")

    # And the dropdown must show it
    page.locator("#search-input").first.click()
    page.wait_for_timeout(500)
    rows = page.locator("#search-history button[role=option]")
    print("dropdown rows:", rows.count())
    if rows.count() == 0:
        failures.append("history dropdown empty after a recommendation click")

    browser.close()

print()
if failures:
    print("FAILURES:")
    for f in failures:
        print("  -", f)
    raise SystemExit(1)
print("ALL CHECKS PASSED")
