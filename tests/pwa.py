"""Real service-worker checks at /kine/, including offline use and safe updates.
Run npm run build first. Native install dialogs are simulated; actual Android /
iOS home-screen installation still needs a physical device.
"""
import functools
import http.server
import os
from pathlib import Path
import shutil
import tempfile
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def ready(page):
    page.wait_for_function("navigator.serviceWorker.controller?.state === 'activated'")
    expect(page.locator('.exercise-card')).to_have_count(16)


def open_install(page):
    page.locator('.mobile-navigation [data-view="settings"]').click()
    page.locator('#settings-view [data-action="install"]').click()
    expect(page.locator('[data-install-panel]')).to_be_visible()
    page.locator('#utility-dialog').evaluate('el=>Promise.all(el.getAnimations().map(a=>a.finished))')


with tempfile.TemporaryDirectory() as temp:
    app = Path(temp) / 'kine'
    shutil.copytree(ROOT / 'dist', app)
    (Path(temp) / 'observer.html').write_text('<!doctype html><title>Test observer outside app scope</title>')
    handler = functools.partial(QuietHandler, directory=temp)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}/kine/'
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(str(Path(temp) / 'profile'), executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'], viewport={'width':390, 'height':844}, is_mobile=True, has_touch=True,
            user_agent='Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36')
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url, wait_until='networkidle')
        ready(page)
        manifest = page.evaluate("fetch('manifest.webmanifest').then(r=>r.json())")
        assert manifest['display'] == 'standalone'
        for key in ['id', 'scope', 'start_url']:
            assert page.evaluate('(path)=>new URL(path,document.baseURI).href', manifest[key]) == url
        for icon in manifest['icons']:
            dimensions = page.evaluate('''async path=>{const img=new Image();img.src=path;await img.decode();return `${img.naturalWidth}x${img.naturalHeight}`;}''', icon['src'])
            assert dimensions == icon['sizes']
        assert page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.scope)") == url
        cdp = ctx.new_cdp_session(page)
        installability = cdp.send('Page.getInstallabilityErrors')
        assert not installability['installabilityErrors'], installability

        # Existing data persists through offline launches, editing and update.
        page.locator('.favorite-button').first.click()
        saved = page.evaluate("localStorage.getItem('kine-library-v1')")
        open_install(page)
        expect(page.locator('[data-install-status]')).to_contain_text('Prêt hors connexion')
        expect(page.locator('.install-steps')).to_contain_text('Chrome')
        for width,height in [(320,568),(390,844),(844,390)]:
            page.set_viewport_size({'width':width, 'height':height})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.set_viewport_size({'width':390, 'height':844})
        page.screenshot(path=str(OUT / 'installation-android.png'), full_page=True)

        # Fallback remains usable if native prompt is cancelled or unavailable.
        page.evaluate('''()=>{window.promptCalls=0;const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{window.promptCalls++};event.userChoice=Promise.resolve({outcome:'dismissed'});dispatchEvent(event);}''')
        expect(page.locator('[data-pwa-install]')).to_be_visible()
        page.locator('[data-pwa-install]').click()
        expect(page.locator('[data-install-result]')).to_contain_text('annulée')
        expect(page.locator('[data-pwa-install]')).not_to_be_visible()
        assert page.evaluate('window.promptCalls') == 1
        page.evaluate('''()=>{const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{};event.userChoice=Promise.resolve({outcome:'accepted'});dispatchEvent(event);}''')
        page.locator('[data-pwa-install]').click()
        expect(page.locator('[data-install-result]')).to_contain_text('Installation demandée')
        page.evaluate("dispatchEvent(new Event('appinstalled'))")
        expect(page.locator('[data-installed-note]')).to_be_visible()
        expect(page.locator('[data-install-help]')).not_to_be_visible()
        page.go_back()
        expect(page.locator('#utility-dialog')).not_to_be_visible()

        ctx.set_offline(True)
        page.goto(url + '?source=homescreen', wait_until='load')
        expect(page.locator('.exercise-card')).to_have_count(16)
        expect(page.locator('#mobile-fav-count')).to_have_text('1')
        assert page.evaluate("localStorage.getItem('kine-library-v1')") == saved
        page.locator('#search').fill('assis')
        assert 0 < page.locator('.exercise-card').count() < 16
        page.locator('.card-main').first.click()
        expect(page.locator('#detail-dialog')).to_be_visible()
        page.locator('[data-action="detail-menu"]').click()
        page.locator('[data-action="mobile-edit"]').click()
        page.locator('#exercise-form [name="name"]').fill('Exercice modifié sans réseau')
        page.locator('#exercise-form button[type="submit"]').click()
        expect(page.locator('#detail-title')).to_have_text('Exercice modifié sans réseau')
        saved = page.evaluate("localStorage.getItem('kine-library-v1')")
        page.goto(url + 'index.html', wait_until='load')
        assert page.evaluate("localStorage.getItem('kine-library-v1')") == saved
        ctx.set_offline(False)

        # Updating must wait while the old app has a client; preserve all other caches.
        old_version = page.evaluate("caches.keys().then(keys=>keys.find(k=>k.startsWith('kine-shell:/kine/:')))")
        page.evaluate("caches.open('another-app-cache')")
        sw = app / 'sw.js'
        sw.write_text(sw.read_text().replace('2026-10-23-install-1', 'test-update-2'))
        html = app / 'index.html'
        html.write_text(html.read_text().replace('<title>Kiné', '<title>Updated Kiné'))
        page.locator('#mobile-add').click()
        page.locator('#exercise-form [name="name"]').fill('Brouillon en cours')
        page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())")
        page.wait_for_function("navigator.serviceWorker.getRegistration().then(r=>Boolean(r.waiting))")
        expect(page.locator('#exercise-form [name="name"]')).to_have_value('Brouillon en cours')
        assert not page.title().startswith('Updated')
        assert old_version in page.evaluate('caches.keys()')
        page.close()
        page = ctx.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url.replace('/kine/', '/observer.html'))
        page.wait_for_function('(old)=>caches.keys().then(keys=>!keys.includes(old))', arg=old_version)
        page.goto(url, wait_until='networkidle')
        expect(page).to_have_title('Updated Kiné — Bibliothèque d’exercices')
        assert page.evaluate("localStorage.getItem('kine-library-v1')") == saved
        keys = page.evaluate('caches.keys()')
        assert old_version not in keys and 'another-app-cache' in keys
        assert any(key.endswith('test-update-2') for key in keys)
        assert not errors, errors
        ctx.close()

        # iPhone instructions and standalone state (platform signals simulated).
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
        ios = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True,
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')
        iphone = ios.new_page()
        iphone.goto(url, wait_until='networkidle')
        ready(iphone)
        open_install(iphone)
        expect(iphone.locator('.install-steps')).to_contain_text('Safari')
        expect(iphone.locator('.install-steps')).to_contain_text('Sur l’écran d’accueil')
        iphone.screenshot(path=str(OUT / 'installation-iphone.png'), full_page=True)
        iphone.add_init_script("Object.defineProperty(navigator,'standalone',{get:()=>true})")
        iphone.reload(wait_until='networkidle')
        open_install(iphone)
        expect(iphone.locator('[data-installed-note]')).to_be_visible()
        expect(iphone.locator('[data-install-help]')).not_to_be_visible()
        ios.close()

        # A partial first download must expose a retry, not claim offline readiness.
        missing = app / 'assets/icon-512.png'
        icon_bytes = missing.read_bytes()
        missing.unlink()
        failure = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
        retry = failure.new_page()
        retry.goto(url, wait_until='networkidle')
        open_install(retry)
        expect(retry.locator('[data-install-status]')).to_contain_text('n’a pas abouti')
        expect(retry.locator('[data-pwa-retry]')).to_be_visible()
        missing.write_bytes(icon_bytes)
        retry.locator('[data-pwa-retry]').click()
        expect(retry.locator('[data-install-status]')).to_contain_text('Prêt hors connexion', timeout=15000)
        expect(retry.locator('[data-pwa-retry]')).not_to_be_visible()
        failure.close()
        browser.close()
    server.shutdown()
print('PASS PWA : installation Chromium, manifeste et icônes sous /kine/, aide iPhone/Android, annulation, état installé, démarrage et édition hors ligne, données conservées, mise à jour différée, caches isolés et reprise après téléchargement incomplet.')
