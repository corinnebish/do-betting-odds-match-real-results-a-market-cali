"""Optional browser checks for the Kentucky Derby-only experience."""
import csv
import io
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce',accept_downloads=True)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8765',wait_until='networkidle')
    assert page.locator('#racetrack canvas').count()==1
    assert page.locator('#motion-toggle').get_attribute('aria-pressed')=='true'
    assert page.evaluate('RacingDashboard.getState().rows')==20
    assert page.evaluate('RacingDashboard.getState().track')=='Churchill Downs'
    page.screenshot(path=str(ROOT/'screenshots/hero-desktop.png'))
    page.select_option('#field-filter','favorites')
    assert page.evaluate('RacingDashboard.getState().rows')==5
    assert page.locator('.rank-row').count()==5
    with page.expect_download() as info:page.locator('#download').click()
    downloaded=list(csv.DictReader(io.StringIO(Path(info.value.path()).read_text())))
    assert len(downloaded)==5 and all(int(h['market_rank'])<=5 for h in downloaded)
    assert sum(float(h['fair_implied']) for h in downloaded)<1
    page.select_option('#evidence-horse','17')
    assert page.locator('#evidence-name').inner_text()=='Fierceness'
    assert '$0.00' in page.locator('#bet-result').inner_text()
    page.select_option('#evidence-horse','3')
    page.locator('#stake').fill('10')
    assert '$196.10' in page.locator('#bet-result').inner_text()
    assert '$186.10' in page.locator('#bet-result').inner_text()
    page.select_option('#field-filter','longshots')
    assert all(float(h['odds_to_one'])>=15 for h in page.evaluate('RACING_DATA.us.filter(h=>RacingDashboard.getState().programs.includes(h.program))'))
    page.locator('#reset').click()
    assert page.evaluate('RacingDashboard.getState().rows')==20
    page.select_option('#field-order','finish')
    assert page.evaluate('RacingDashboard.getState().programs[0]')==3
    page.locator('#rank-chart').evaluate('(e)=>e.scrollIntoView({behavior:"instant",block:"start"})')
    page.screenshot(path=str(ROOT/'screenshots/evidence-desktop.png'))
    page.locator('#race-progress').fill('5')
    assert page.locator('#leader-label').inner_text()=='Winner: Mystik Dan'
    page.select_option('#horse-select','17')
    assert page.locator('#evidence-name').inner_text()=='Fierceness'
    assert '15th' in page.locator('#horse-stats').inner_text()
    page.select_option('#horse-select','3');page.locator('#race-progress').fill('0')
    page.locator('#derby').evaluate('(e)=>e.scrollIntoView({behavior:"instant",block:"start"})')
    page.wait_for_timeout(300);page.locator('#replay').click();page.wait_for_timeout(500)
    assert page.evaluate('RacingDashboard.getState().progress')>0
    page.locator('#replay').click()
    page.screenshot(path=str(ROOT/'screenshots/derby-desktop.png'))
    for width in [320,390,768,1440]:
        page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(250)
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'Overflow at {width}'
        assert page.locator('.pillnav a').last.evaluate('(e)=>e.getBoundingClientRect().right<=innerWidth')
    page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo({top:0,behavior:"instant"})')
    page.screenshot(path=str(ROOT/'screenshots/hero-mobile.png'))
    assert not errors,errors
    browser.close()
print('Browser checks passed: USA-only field, filters and downloads, full-race probability scope, linked horse selection, payout arithmetic, replay, and four viewport widths. No JavaScript errors.')
