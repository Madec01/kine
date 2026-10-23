"""Vérification de l’ergonomie dans Chromium avec émulation tactile.
Serveur attendu : python -m http.server 8765.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT=Path(__file__).resolve().parent.parent/'test-results'
OUT.mkdir(exist_ok=True)

def touch_targets(page):
    problems=page.evaluate('''() => [...document.querySelectorAll('button,a,select,summary')].filter(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el),modal=document.querySelector('dialog[open]');
      return r.width&&r.height&&s.visibility!=='hidden'&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth&&(!modal||el.closest('dialog[open]'));
    }).map(el=>{const r=el.getBoundingClientRect();return {name:el.getAttribute('aria-label')||el.textContent.trim().slice(0,50),width:r.width,height:r.height};}).filter(r=>r.width<43.9||r.height<43.9)''')
    assert not problems,problems

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
    page=ctx.new_page(); errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(os.environ.get('KINE_TEST_URL','http://127.0.0.1:8765'),wait_until='networkidle')
    expect(page.locator('.mobile-navigation')).to_be_visible()
    expect(page.locator('.sidebar nav')).not_to_be_visible()
    expect(page.locator('.exercise-card')).to_have_count(16)
    assert page.locator('.card-title').first.evaluate('el=>parseFloat(getComputedStyle(el).fontSize)')>=16
    touch_targets(page)
    for width,height in [(320,568),(360,780),(390,844),(430,932),(768,1024),(844,390)]:
        page.set_viewport_size({'width':width,'height':height})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Horizontal overflow {width}'
        touch_targets(page)
        page.locator('.card-main').last.scroll_into_view_if_needed()
        nav=page.locator('.mobile-navigation').bounding_box()
        page.locator('.card-main').last.click()
        expect(page.locator('#detail-dialog')).to_be_visible()
        page.locator('#detail-dialog').evaluate('el=>Promise.all(el.getAnimations().map(a=>a.finished))')
        assert page.locator('#detail-dialog').bounding_box()['width']<=width
        assert page.locator('.detail-actions').bounding_box()['y']>=0
        assert page.locator('.detail-actions').bounding_box()['y']+page.locator('.detail-actions').bounding_box()['height']<=height+1
        touch_targets(page)
        page.locator('#detail-dialog [data-action="close"]').click()
        expect(page.locator('#detail-dialog')).not_to_be_visible()
    page.set_viewport_size({'width':390,'height':844})
    page.locator('.mobile-navigation [data-view="library"]').click()
    page.locator('#toggle-filters').click()
    expect(page.locator('#filters-dialog')).to_be_visible()
    assert page.evaluate('document.activeElement.closest("#filters-dialog")!==null')
    page.locator('[data-mobile-filter="goal"][value="Renforcement"]').check()
    page.locator('[data-mobile-category="equipment"] summary').click()
    page.locator('[data-mobile-filter="equipment"][value="Élastique"]').check()
    expect(page.locator('#mobile-filter-apply')).to_have_text('Afficher 1 exercice')
    expect(page.locator('.exercise-card')).to_have_count(16) # Brouillon non appliqué.
    touch_targets(page)
    page.locator('#mobile-filter-apply').click()
    expect(page.locator('.exercise-card')).to_have_count(1)
    expect(page.locator('.card-title')).to_have_text('Tirage à l’élastique assis')
    page.locator('#toggle-filters').click()
    page.locator('[data-action="clear-mobile-filters"]').click()
    expect(page.locator('#mobile-filter-apply')).to_have_text('Afficher 16 exercices')
    page.go_back()
    expect(page.locator('#filters-dialog')).not_to_be_visible()
    expect(page.locator('.exercise-card')).to_have_count(1) # Retour annule le brouillon.
    page.locator('#toggle-filters').click()
    page.locator('[data-action="clear-mobile-filters"]').click()
    page.locator('#mobile-filter-apply').click()
    expect(page.locator('.exercise-card')).to_have_count(16)
    page.locator('#search').fill('assis')
    touch_targets(page)
    assert page.locator('#search').evaluate('el=>parseFloat(getComputedStyle(el).fontSize)')>=16
    page.locator('#search').press('Enter')
    assert page.evaluate('document.activeElement.id')!='search'
    count=page.locator('.exercise-card').count()
    page.locator('.favorite-button').first.click()
    expect(page.locator('#mobile-fav-count')).to_have_text('1')
    page.locator('.mobile-navigation [data-view="favorites"]').click()
    expect(page.locator('.exercise-card')).to_have_count(1)
    page.locator('.mobile-navigation [data-view="library"]').click()
    expect(page.locator('#search')).to_have_value('assis')
    expect(page.locator('.exercise-card')).to_have_count(count)
    page.locator('#clear-search').click()
    page.locator('#search').press('Enter')
    expect(page.locator('.exercise-card')).to_have_count(16)
    page.evaluate('scrollTo(0,600)')
    assert abs(page.locator('#library-controls').bounding_box()['y'])<1
    page.locator('.card-main').nth(3).scroll_into_view_if_needed()
    previous_scroll=page.evaluate('scrollY')
    page.locator('.card-main').nth(3).click()
    page.locator('[data-action="detail-jump"][data-target="detail-precautions"]').click()
    page.wait_for_timeout(500)
    target=page.locator('#detail-precautions').bounding_box()
    content=page.locator('.detail-body').bounding_box()
    assert target['y']>=content['y']-1 and target['y']<content['y']+55
    page.locator('[data-action="detail-jump"][data-target="detail-start"]').click()
    page.wait_for_timeout(500)
    expect(page.locator('#detail-start')).to_be_in_viewport()
    page.locator('[data-action="detail-menu"]').click()
    touch_targets(page)
    page.locator('[data-action="mobile-edit"]').click()
    expect(page.locator('#editor-dialog')).to_be_visible()
    form=page.locator('#exercise-form')
    assert form.locator('[name="name"]').evaluate('el=>parseFloat(getComputedStyle(el).fontSize)')>=16
    form.locator('[name="name"]').fill('Élévation confortable des bras')
    form.locator('button[type="submit"]').click()
    expect(page.locator('#detail-title')).to_have_text('Élévation confortable des bras')
    page.locator('[data-action="detail-menu"]').click()
    page.locator('[data-action="mobile-edit"]').click()
    page.go_back()
    expect(page.locator('#editor-dialog')).not_to_be_visible()
    expect(page.locator('#detail-dialog')).to_be_visible()
    page.go_back()
    expect(page.locator('#detail-dialog')).not_to_be_visible()
    assert abs(page.evaluate('scrollY')-previous_scroll)<5
    expect(page.locator('.mobile-navigation')).to_be_visible()
    page.locator('.mobile-navigation [data-view="settings"]').click()
    expect(page.locator('#settings-view')).to_be_visible()
    expect(page.locator('#mobile-add')).not_to_be_visible()
    touch_targets(page)
    page.locator('#settings-view [data-action="backup"]').click()
    expect(page.locator('#utility-title')).to_have_text('Sauvegarde & données')
    touch_targets(page)
    page.locator('#utility-dialog [data-action="close"]').click()
    page.locator('.mobile-navigation [data-view="collections"]').click()
    page.locator('#mobile-add').click()
    page.locator('#collection-name').fill('Routine mobile')
    page.locator('#collection-form button[type="submit"]').click()
    expect(page.locator('.collection-card')).to_have_count(1)
    page.reload()
    expect(page.locator('#mobile-fav-count')).to_have_text('1')
    assert page.evaluate("JSON.parse(localStorage.getItem('kine-library-v1')).collections[0].name")=='Routine mobile'
    # Grossissement du texte : les éléments restent dans la largeur de la page.
    page.add_style_tag(content='html{font-size:200%} .card-title,.card-subtitle{font-size:200%!important}')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    print('PASS mobile : cibles tactiles 44 px, 6 formats portrait/paysage, filtres brouillon/validation/annulation, clavier, recherche fixe, mémoire des onglets, favoris, raccourcis, édition, retour navigateur imbriqué, collections et persistance.')
    browser.close()
