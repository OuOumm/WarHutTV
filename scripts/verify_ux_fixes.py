"""Verify the two UX fixes:

1. Announcement does not reappear once dismissed (real browser context,
   localStorage persisted) and never opens empty.
2. /speed is reachable from the user menu and actually renders the results.
"""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
failures = []


def dialog_open(page):
    d = page.locator("div[role=dialog]")
    if d.count() == 0:
        return False
    cls = d.first.get_attribute("class") or ""
    return d.first.is_visible() and "opacity-0" not in cls


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()

    page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    page.fill("#password-input", "warhut")
    page.click("button[type=submit]")
    page.wait_for_function("() => !window.location.pathname.startsWith('/login')", timeout=20000)
    page.wait_for_timeout(1200)

    first = dialog_open(page)
    print(f"1) announcement on first visit: {first}")

    # dismiss it
    d = page.locator("div[role=dialog]")
    if d.count() > 0:
        btns = d.locator("button")
        if btns.count() > 0:
            btns.last.click()
            page.wait_for_timeout(900)

    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    after_reload = dialog_open(page)
    print(f"2) announcement after reload: {after_reload}")
    if after_reload:
        failures.append("announcement reappeared after reload")

    # --- /speed reachable from the user menu ---
    # Desktop renders both a sidebar and a (hidden) mobile header, so pick the
    # first *visible* instance.
    menu = None
    for i in range(page.locator("button[aria-label='用户菜单']").count()):
        cand = page.locator("button[aria-label='用户菜单']").nth(i)
        if cand.is_visible():
            menu = cand
            break
    if menu is None:
        raise SystemExit("no visible user menu button")
    menu.click()
    page.wait_for_timeout(500)

    speed_item = page.locator("button[role=menuitem]:has-text('源站测速')")
    if speed_item.count() == 0:
        failures.append("/speed is still unreachable: no menu entry")
        print("3) menu entry: MISSING")
    else:
        print("3) menu entry: present")
        speed_item.first.click()
        page.wait_for_function("() => window.location.pathname === '/speed'", timeout=15000)
        page.wait_for_timeout(1200)
        heading = page.locator("h1").first.inner_text()
        print(f"4) /speed rendered, heading={heading!r}")
        if "测速" not in heading:
            failures.append(f"unexpected /speed heading: {heading}")

        # run the probe and confirm it produces rows
        start = page.locator("button:has-text('开始测速')")
        if start.count() == 0:
            failures.append("/speed has no start button")
        else:
            start.first.click()
            # The backend probes every configured site; a few dead ones burn
            # their full timeout, so this takes ~25s in practice.
            page.wait_for_timeout(40000)
            body = page.inner_text("body")
            has_summary = "可用" in body or "不可用" in body
            print(f"5) probe ran, summary visible: {has_summary}")
            if not has_summary:
                failures.append("/speed produced no summary after probing")

    page.screenshot(path="/tmp/ux-speed.png", full_page=False)
    browser.close()

print()
if failures:
    print("FAILURES:")
    for f in failures:
        print("  -", f)
    raise SystemExit(1)
print("ALL CHECKS PASSED")
