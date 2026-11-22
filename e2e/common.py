"""Wspólne narzędzia E2E: lokalny serwer, przeglądarka w widoku iPhone'a, profil demo (fikcyjne dane)."""
import contextlib, functools, http.server, os, shutil, socketserver, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.environ.get('E2E_SHOTS', '/tmp/mybodyos-e2e')

def chrome_path():
    for p in [os.environ.get('CHROME'), '/usr/bin/google-chrome', '/usr/bin/chromium', shutil.which('chromium')]:
        if p and os.path.exists(p): return p
    return None  # Playwright użyje własnego Chromium (npx playwright install chromium / python -m playwright install chromium)

@contextlib.contextmanager
def serve(dist='dist-single', port=0):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(ROOT, dist))
    handler.log_message = lambda *a: None
    with socketserver.TCPServer(('127.0.0.1', port), handler) as httpd:
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        yield f'http://127.0.0.1:{httpd.server_address[1]}/index.html'
        httpd.shutdown()

@contextlib.contextmanager
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=chrome_path(), args=['--no-sandbox'])
        yield b
        b.close()

def new_page(b, **kw):
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, timezone_id='Europe/Warsaw', locale='pl-PL', **kw)
    pg = ctx.new_page()
    pg.errors = []
    pg.on('pageerror', lambda e: pg.errors.append(str(e)))
    return ctx, pg

def demo(pg, url):
    pg.goto(url); pg.get_by_role('button', name='Profil demo').wait_for()
    pg.get_by_role('button', name='Profil demo').click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Nie').click(); pg.get_by_role('button', name='Zgadza się').click(); pg.get_by_role('button', name='Pomiń na teraz').click()
    pg.wait_for_timeout(500)

def tab(pg, name):
    pg.locator('nav').get_by_role('button', name=name, exact=True).click(); pg.wait_for_timeout(300)

def dialog(pg):
    return pg.locator('[role=dialog]').last

def close_dialog(pg):
    dialog(pg).locator('[aria-label=Zamknij]').first.click(); pg.wait_for_timeout(200)

def shot(pg, name):
    os.makedirs(SHOTS, exist_ok=True); pg.screenshot(path=os.path.join(SHOTS, name))
