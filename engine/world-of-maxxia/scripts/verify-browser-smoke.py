"""Optional actual Chromium smoke QA; requires Python Playwright and system Chromium.
Runs the included static server locally. Never writes campaign save data or submits quest actions.
"""
import os, socket, subprocess, time, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with socket.socket() as s:
 s.bind(('127.0.0.1',0));PORT=s.getsockname()[1]
proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env={**os.environ,'HOST':'127.0.0.1','PORT':str(PORT)},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
BASE=f'http://127.0.0.1:{PORT}'
try:
 import urllib.request
 for i in range(90):
  try:
   with urllib.request.urlopen(BASE+'/healthz',timeout=.5) as r:
    if r.status==200:break
  except Exception:
   if proc.poll() is not None:raise RuntimeError('Node server quit')
   time.sleep(.08)
 else:raise RuntimeError('Node server never became ready')
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1280,'height':800},device_scale_factor=1)
  errors=[]
  page.on('pageerror',lambda e: errors.append(str(e)))
  page.goto(BASE+'/enemy-gallery.html',wait_until='networkidle',timeout=25000)
  page.locator('.card').first.wait_for(timeout=15000)
  page.wait_for_function("Array.from(document.querySelectorAll('.card canvas')).length===9 && Array.from(document.querySelectorAll('.card .readout')).every(el=>el.textContent.includes('Frame'))",timeout=15000)
  assert page.locator('.card').count()==9
  for name in ['Bell Wraith','Valve Sentinel','Bell-Heart Custodian']:assert page.locator('.card h2',has_text=name).count()==1
  page.locator('#group').select_option('three')
  assert page.locator('.card:visible').count()==3
  page.locator('#all-attack').click()
  page.wait_for_timeout(300)
  assert page.locator('.card:visible [data-clip="attack"][aria-pressed="true"]').count()==3
  page.locator('#all-death').click();page.wait_for_timeout(250)
  assert page.locator('.card:visible [data-clip="death"][aria-pressed="true"]').count()==3
  boss=page.locator('.card[data-batch="three"]',has=page.locator('h2',has_text='Bell-Heart Custodian'))
  boss.locator('button[data-clip="telegraph"]').click()
  page.wait_for_timeout(100)
  assert boss.locator('button[data-clip="telegraph"][aria-pressed="true"]').count()==1
  boss.locator('button[data-clip="discharge"]').click()
  assert boss.locator('button[data-clip="discharge"][aria-pressed="true"]').count()==1
  boss.locator('button[data-clip="recovery"]').click()
  assert boss.locator('button[data-clip="recovery"][aria-pressed="true"]').count()==1
  page.locator('#reduce').check()
  page.screenshot(path=str(ROOT/'docs/PHASE29_BROWSER_GALLERY_SCREENSHOT.png'),full_page=True)
  assert not errors, 'Gallery page errors: '+repr(errors)
  # The game itself should boot Phaser and show the title without an error state.
  errors.clear()
  page.goto(BASE+'/',wait_until='networkidle',timeout=30000)
  page.locator('#welcome:visible').wait_for(timeout=25000)
  assert page.locator('#failure:visible').count()==0
  assert page.locator('a[href="./enemy-gallery.html"]').count()==1
  page.screenshot(path=str(ROOT/'docs/PHASE29_BROWSER_TITLE_SCREENSHOT.png'),full_page=True)
  assert not errors, 'Game boot page errors: '+repr(errors)
  browser.close()
 print('PASS: real headless Chromium game title boot, 9 animation players, Phase 29 batch filter, attack/death controls and reduced-motion gallery; no page errors.')
finally:
 proc.terminate()
 try:proc.wait(timeout=3)
 except subprocess.TimeoutExpired:proc.kill()
