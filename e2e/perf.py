"""Pomiary: start, przejścia zakładek, wyszukiwanie, animacja. Uruchom: npm run build && python3 e2e/perf.py [spowolnienie CPU, domyślnie 4]"""
import json, sys, statistics as st
from playwright.sync_api import sync_playwright
import os, sys as _s; _s.path.insert(0, os.path.dirname(__file__))
from common import serve, chrome_path
RATE=int(sys.argv[1]) if len(sys.argv)>1 else 4
TAP='''async ([sel, txt]) => { const b=[...document.querySelectorAll(sel)].find(x=>x.innerText.trim().startsWith(txt)); const t=performance.now(); b.click(); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); return performance.now()-t; }'''
with serve('dist') as URL, sync_playwright() as p:
    b=p.chromium.launch(executable_path=chrome_path(),args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,timezone_id='Europe/Warsaw',locale='pl-PL')
    pg=ctx.new_page(); cdp=ctx.new_cdp_session(pg)
    cdp.send('Emulation.setCPUThrottlingRate',{'rate':RATE}); cdp.send('Performance.enable')
    out={'cpu_throttle':RATE}
    pg.goto(URL); pg.get_by_role('button',name='Profil demo').wait_for()
    out['first_ui_ms']=pg.evaluate("performance.now()")
    nav=pg.evaluate("JSON.stringify(performance.getEntriesByType('navigation')[0])"); nav=json.loads(nav)
    out['dcl_ms']=round(nav['domContentLoadedEventEnd'])
    m={x['name']:x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
    out['script_s']=round(m['ScriptDuration'],3)
    pg.get_by_role('button',name='Profil demo').click(); pg.wait_for_timeout(300)
    pg.get_by_role('button',name='Nie',exact=True).click(); pg.get_by_role('button',name='Zgadza się').click(); pg.get_by_role('button',name='Pomiń na teraz').click(); pg.wait_for_timeout(800)
    # ponowne uruchomienie (z cache przeglądarki i danymi)
    pg.reload(); pg.get_by_text('Dzisiaj').first.wait_for(); out['warm_reload_ui_ms']=round(pg.evaluate("performance.now()"))
    pg.wait_for_timeout(500)
    tabs=['Jedzenie','Trening','Postęp','Dzisiaj']
    times={t:[] for t in tabs}
    for _ in range(3):
        for t in tabs: times[t].append(pg.evaluate(TAP,['nav button',t])); pg.wait_for_timeout(150)
    out['tab_switch_ms']={t:round(st.median(v)) for t,v in times.items()}
    pg.evaluate(TAP,['nav button','Jedzenie']); pg.wait_for_timeout(300)
    pg.get_by_role('button',name='Dodaj').first.click(); pg.wait_for_timeout(300)
    SEARCH='''async (q) => { const i=document.querySelector('input[placeholder^="Szukaj w bazie"]'); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; const t=performance.now(); set.call(i,q); i.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); return performance.now()-t; }'''
    s=[]
    for q in ['k','ku','kur','kurc','kurcz','kurczak','r','ry','ryż','j','jo','jogurt']*2: s.append(pg.evaluate(SEARCH,q))
    out['search_keystroke_ms']={'median':round(st.median(s)),'max':round(max(s))}
    pg.keyboard.press('Escape'); pg.locator('[aria-label=Zamknij]').first.click(); pg.wait_for_timeout(200)
    pg.evaluate(TAP,['nav button','Dzisiaj']); pg.wait_for_timeout(300)
    out['today_add_food_open_ms']=round(pg.evaluate(TAP,['main button','Dodaj jedzenie'])); pg.wait_for_timeout(200)
    pg.locator('[aria-label=Zamknij]').first.click(); pg.wait_for_timeout(200)
    pg.evaluate(TAP,['nav button','Trening']); pg.wait_for_timeout(300)
    pg.get_by_role('button',name='Plany treningowe i ćwiczenia').click(); pg.wait_for_timeout(200)
    pg.locator('text=Martwy ciąg rumuński z hantlami').first.click()
    pg.wait_for_timeout(500)
    fps=pg.evaluate('''async () => { const d=[]; let last=performance.now(); const end=last+4000; await new Promise(r=>{ const f=(t)=>{ d.push(t-last); last=t; t<end?requestAnimationFrame(f):r(); }; requestAnimationFrame(f); }); d.shift(); const s=[...d].sort((a,b)=>a-b); return {frames:d.length, fps:Math.round(1000*d.length/d.reduce((a,b)=>a+b,0)), p95_ms:+s[Math.floor(s.length*0.95)].toFixed(1), over_33ms:d.filter(x=>x>33).length}; }''')
    out['rig_animation']=fps
    out['has_svg']=pg.locator('[role=dialog] svg').count()
    print(json.dumps(out,ensure_ascii=False)); b.close()
