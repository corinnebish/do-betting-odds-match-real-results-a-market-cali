"""Optional browser integration checks. Run while docs/ is served on port 8765."""
import csv
import io
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
snapshot=json.loads((ROOT/'docs/data.js').read_text().removeprefix('window.RACING_DATA = ').strip().removesuffix(';'))
source=[dict(zip(snapshot['columns'],r)) for r in snapshot['rows']]
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce',accept_downloads=True)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8765',wait_until='networkidle')
    assert page.locator('#racetrack canvas').count()==1
    assert page.locator('#motion-toggle').get_attribute('aria-pressed')=='true'
    assert page.evaluate('RacingDashboard.getState().rows')==len(source)
    page.screenshot(path=str(ROOT/'screenshots/hero-desktop.png'))
    page.select_option('#track','HV');page.select_option('#year','2017')
    expected=[r for r in source if r['venue']=='HV' and r['date'].startswith('2017')]
    state=page.evaluate('RacingDashboard.getState()')
    assert state['rows']==len(expected)==3042
    assert state['races']==len(set(r['race_key'] for r in expected))
    with page.expect_download() as info:
        page.locator('#download').click()
    downloaded=list(csv.DictReader(io.StringIO(Path(info.value.path()).read_text())))
    assert len(downloaded)==len(expected)
    assert {r['venue'] for r in downloaded}=={'HV'}
    assert all(r['date'].startswith('2017') for r in downloaded)
    page.locator('[data-band="40+"]').click()
    assert '40+' in page.locator('#band-title').inner_text()
    page.locator('[data-mode="gap"]').click()
    assert page.locator('[data-mode="gap"]').get_attribute('aria-pressed')=='true'
    page.locator('#reset').click()
    assert page.evaluate('RacingDashboard.getState().rows')==len(source)
    page.locator('#explore').evaluate('(e)=>e.scrollIntoView({behavior:"instant",block:"start"})')
    page.screenshot(path=str(ROOT/'screenshots/evidence-desktop.png'))
    page.locator('.heat-cell').first.click()
    assert page.locator('#track').input_value()=='HV'
    page.locator('#reset').click()
    page.locator('#race-progress').fill('5')
    assert page.locator('#leader-label').inner_text()=='Winner: Mystik Dan'
    page.select_option('#horse-select','17')
    assert page.locator('#horse-title').inner_text()=='Fierceness'
    assert '15th' in page.locator('#horse-stats').inner_text()
    page.select_option('#horse-select','3')
    page.locator('#race-progress').fill('0')
    page.locator('#derby').evaluate('(e)=>e.scrollIntoView({behavior:"instant",block:"start"})')
    page.wait_for_timeout(300)
    page.locator('#replay').click();page.wait_for_timeout(500)
    assert page.evaluate('RacingDashboard.getState().progress')>0
    page.locator('#replay').click()
    page.locator('#derby').evaluate('(e)=>e.scrollIntoView({behavior:"instant",block:"start"})')
    page.screenshot(path=str(ROOT/'screenshots/derby-desktop.png'))
    for width in [320,390,768,1440]:
        page.set_viewport_size({'width':width,'height':844})
        page.wait_for_timeout(250)
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'Horizontal overflow at {width}'
        assert page.locator('.pillnav a').last.evaluate('(e)=>e.getBoundingClientRect().right<=innerWidth'),f'Clipped nav at {width}'
    page.set_viewport_size({'width':390,'height':844})
    page.evaluate('scrollTo({top:0,behavior:"instant"})')
    page.screenshot(path=str(ROOT/'screenshots/hero-mobile.png'))
    page.locator('#calibration').evaluate('(e)=>e.scrollIntoView({behavior:"instant",block:"start"})')
    page.screenshot(path=str(ROOT/'screenshots/evidence-mobile.png'))
    page.set_viewport_size({'width':1440,'height':1000})
    page.goto('http://127.0.0.1:8501',wait_until='networkidle')
    frame=page.frame_locator('iframe');frame.locator('h1').wait_for()
    frame.locator('#track').select_option('ST')
    assert frame.locator('#scope-note').inner_text().startswith('Showing Sha Tin')
    frame.locator('#reset').click()
    page.screenshot(path=str(ROOT/'screenshots/streamlit-desktop.png'))
    assert not errors,errors
    browser.close()
print('Browser checks passed: data filters, CSV scope, linked selection, heatmap drill-down, Derby play/scrub/selection, reduced motion, 4 viewport widths, and the Streamlit host. No JavaScript errors.')
