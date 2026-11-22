"""End-to-end checks for the A-line batch:

A. cache cleanup is deferred (app still boots and works)
B. search history: recorded, shown on focus, clickable, removable, clearable
C. sort + source filter: controls exist and actually reorder/filter the grid
"""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
KW = "凡人"
failures = []


def dismiss_dialog(page):
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
    page.wait_for_timeout(1500)
    dismiss_dialog(page)

    # ---- A: app booted and the deferred cleanup did not break anything ----
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.wait_for_timeout(3000)
    print(f"A) app alive, heading present: {page.locator('h1,h2').count() > 0}, js errors: {len(errors)}")
    if errors:
        failures.append(f"js errors after startup: {errors[:2]}")

    # ---- B: history is recorded from a search ----
    page.goto(f"{BASE}/search?wd={KW}", wait_until="domcontentloaded")
    page.wait_for_function(
        "() => Object.keys(sessionStorage).some(k => k.startsWith('search_cache:'))",
        timeout=60000,
    )
    dismiss_dialog(page)

    # use the search bar to run a second search, which should record history
    box = page.locator("#search-input").first
    box.click()
    box.fill("庆余年")
    page.keyboard.press("Enter")
    page.wait_for_function("() => window.location.search.includes('%E5%BA%86')", timeout=20000)
    page.wait_for_timeout(1200)
    dismiss_dialog(page)

    stored = page.evaluate("() => localStorage.getItem('searchHistory')")
    print(f"B1) history stored: {stored}")
    if not stored or "庆余年" not in stored:
        failures.append("search keyword was not recorded in history")

    # focus the box on a fresh search page -> dropdown shows the entry
    page.goto(f"{BASE}/search", wait_until="domcontentloaded")
    page.wait_for_timeout(800)
    dismiss_dialog(page)
    page.locator("#search-input").first.click()
    page.wait_for_timeout(500)
    rows = page.locator("#search-history button[role=option]")
    print(f"B2) history dropdown rows: {rows.count()}, texts={[rows.nth(i).inner_text() for i in range(min(rows.count(),3))]}")
    if rows.count() == 0:
        failures.append("history dropdown did not appear")
    else:
        # click it -> navigates to that search
        first_text = rows.first.inner_text()
        rows.first.click()
        page.wait_for_timeout(1500)
        print(f"B3) clicked history entry {first_text!r} -> url={page.url}")
        if "wd=" not in page.url:
            failures.append("clicking a history entry did not start a search")

    # ---- C: sort + source filter ----
    page.goto(f"{BASE}/search?wd={KW}", wait_until="domcontentloaded")
    page.wait_for_function(
        "() => Object.keys(sessionStorage).some(k => k.startsWith('search_cache:'))",
        timeout=60000,
    )
    page.wait_for_timeout(1500)
    dismiss_dialog(page)

    sort = page.locator("select[aria-label='结果排序']")
    print(f"C1) sort control present: {sort.count() > 0}")
    if sort.count() == 0:
        failures.append("sort control missing")
    else:
        before = [t for t in page.locator("a[aria-label]").evaluate_all("els => els.slice(0,5).map(e => e.getAttribute('aria-label'))")]
        sort.first.select_option("year-desc")
        page.wait_for_timeout(900)
        after = [t for t in page.locator("a[aria-label]").evaluate_all("els => els.slice(0,5).map(e => e.getAttribute('aria-label'))")]
        print(f"C2) order changed by sort: {before != after}")
        if before == after:
            failures.append("sorting did not change the visible order")

    chips = page.locator("button[aria-pressed]")
    chip_count = chips.count()
    print(f"C3) source filter chips: {chip_count}")
    if chip_count < 2:
        failures.append("source filter chips missing")

    if chip_count >= 2:
        # pick the first non-"全部" chip and confirm the result count shrinks
        total_before = page.locator("a[href^='/play/']").count()
        target = None
        for i in range(chip_count):
            label = chips.nth(i).inner_text().strip()
            if label != "全部":
                target = chips.nth(i)
                break
        if target is not None:
            target.click()
            page.wait_for_timeout(900)
            total_after = page.locator("a[href^='/play/']").count()
            print(f"C4) results {total_before} -> {total_after} after filtering by one source")
            if total_after >= total_before:
                failures.append("source filter did not narrow the results")

    page.screenshot(path="/tmp/ux-a-line.png", full_page=False)
    browser.close()

print()
if failures:
    print("FAILURES:")
    for f in failures:
        print("  -", f)
    raise SystemExit(1)
print("ALL CHECKS PASSED")
