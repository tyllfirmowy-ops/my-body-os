"""Audyt W2: scenariusze użytkownika A–I (fikcyjne dane), każdy sprawdzony po ponownym uruchomieniu aplikacji.
Uruchom: npm run build:single && python3 e2e/run.py audit_a audit_b ...  (albo bez nazw: wszystkie)"""
import datetime, re
from common import demo, tab, dialog, close_dialog, shot
from scenarios import check, past_warmup

class Taps:
    """Licznik dotknięć: każde kliknięcie i wejście w pole liczone jako 1."""
    def __init__(self): self.n = 0
    def click(self, loc): loc.click(); self.n += 1; loc.page.wait_for_timeout(250)
    def fill(self, loc, v): loc.click(); loc.fill(v); self.n += 1; loc.page.wait_for_timeout(150)

def seed(pg, sessions):
    """sessions: [(dni_temu, id, szablon, {ćwiczenie: (kg, [powt.], {rir/pain})})]"""
    js = """async (sessions) => {
  const r = indexedDB.open('my-body-os'); await new Promise(ok => r.onsuccess = ok); const db = r.result;
  const tx = db.transaction(['sessions', 'sets'], 'readwrite');
  const d = (n) => new Date(Date.now() - n * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
  sessions.forEach(([n, id, t, ex], k) => {
    tx.objectStore('sessions').put({ id, createdAt: k, updatedAt: k, date: d(n), templateId: t, status: 'completed', order: Object.keys(ex), skipped: [], technique: {}, startedAt: k, finishedAt: k + 1 });
    Object.entries(ex).forEach(([e, [w, reps, extra]]) => reps.forEach((rp, i) => tx.objectStore('sets').put(Object.assign({ id: id + e + i, sessionId: id, exerciseId: e, slot: e, setIndex: i, weightKg: w, reps: rp, done: true, createdAt: k, updatedAt: k }, extra || {}))));
  });
  await new Promise(ok => tx.oncomplete = ok); db.close();
}"""
    pg.evaluate(js, sessions); pg.reload(); pg.wait_for_timeout(900)

def store(pg, name):
    return pg.evaluate("""async (n) => { const r = indexedDB.open('my-body-os'); await new Promise(ok => r.onsuccess = ok); const db = r.result;
      const g = db.transaction(n).objectStore(n).getAll(); await new Promise(ok => g.onsuccess = ok); db.close(); return g.result; }""", name)

def restart(ctx, pg, url, at=None):
    """Zamknięcie aplikacji i ponowne uruchomienie (nowa karta w tym samym profilu przeglądarki = te same dane IndexedDB)."""
    errs = pg.errors; pg.close()
    p = ctx.new_page(); p.errors = errs; p.on('pageerror', lambda e: errs.append(str(e)))
    if at: p.clock.install(time=at)
    p.goto(url); p.wait_for_timeout(1200)
    return p

def to_training(pg, t=None):
    (t.click if t else lambda l: (l.click(), pg.wait_for_timeout(300)))(pg.locator('nav').get_by_role('button', name='Trening', exact=True))
    if pg.get_by_text('Wznów trening').count(): pg.get_by_text('Wznów trening').first.click(); pg.wait_for_timeout(400)

def start(pg, t, warm=True):
    b = pg.get_by_role('button', name='Start')
    if b.count() == 0: b = pg.get_by_role('button', name=re.compile('Mimo to zacznij'))
    t.click(b.first); pg.wait_for_timeout(300)
    if warm: t.click(pg.get_by_role('button', name='Pomiń rozgrzewkę'))
    return pg.locator('h2').first.inner_text()

def finish(pg):
    for _ in range(12):
        z = pg.get_by_role('button', name='Zakończ trening', exact=True)
        if z.count(): z.click(); break
        pg.get_by_role('button', name=re.compile('^Dalej:')).click(); pg.wait_for_timeout(150)
    pg.wait_for_timeout(300); dialog(pg).get_by_role('button', name='Zapisz trening').click(); pg.wait_for_timeout(600)

def unit_inp(pg, u='kg'): return pg.get_by_label(u, exact=True)
def series_btn(pg): return pg.get_by_role('button', name='Seria zrobiona')
def week_card(pg):
    c = pg.locator('div.rounded-2xl').filter(has=pg.get_by_role('heading', name='Ten tydzień'))
    return c.first.evaluate("e => e.innerText") if c.count() else ''
TWO_TOP = lambda w=40: [(7, 'h1', 'B', {'machine_press': (w, [12, 12, 12])}), (3, 'h2', 'B', {'machine_press': (w, [12, 12, 12])})]

def small_targets(pg):
    """Elementy dotykowe < 44×44 pt w widoku (Apple HIG: min. ok. 44×44 pt)."""
    return pg.evaluate("""() => [...document.querySelectorAll('main button, main input, button, input')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0; })
      .map(e => { const r = e.getBoundingClientRect(); return { t: (e.getAttribute('aria-label') || e.innerText || e.placeholder || e.type).trim().replace(/\\s+/g, ' ').slice(0, 28), w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter(x => x.w < 44 || x.h < 44)
      .filter((x, i, a) => a.findIndex(y => y.t === x.t && y.w === x.w && y.h === x.h) === i)""")

# ---------- 0. tryb skupienia: start → rozgrzewka → ćwiczenia → rozciąganie → koniec ----------
def focus_flow(pg, url, ctx):
    demo(pg, url); seed(pg, TWO_TOP()); t = Taps()
    to_training(pg, t)
    check(pg.locator('main, body').first.get_by_text(re.compile('↑|propozycja zwiększenia')).count() == 0, 'na liście zostały strzałki progresji')
    start(pg, t, warm=False)
    check(not pg.locator('nav[aria-label="Nawigacja"]').is_visible(), 'w trakcie treningu widać dolną nawigację')
    check(pg.get_by_role('heading', name='Rozgrzewka').count() == 1, 'trening nie zaczyna się od rozgrzewki')
    pg.get_by_role('button', name='Zrobione: Krążenia ramion').click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Skłon z bioder bez ciężaru 10 powt.').click(); pg.wait_for_timeout(200)
    check(pg.get_by_text('Wypchnij biodra do tyłu', exact=False).count() == 1, 'brak opisu po stuknięciu nazwy')
    shot(pg, 'focus_warmup.png')
    pg = restart(ctx, pg, url); to_training(pg)
    check(pg.get_by_role('button', name='Odznacz: Krążenia ramion').count() == 1, 'odhaczenie rozgrzewki nie przetrwało restartu')
    t.click(pg.get_by_role('button', name='Gotowe: pierwsze ćwiczenie'))
    check(pg.get_by_role('button', name=re.compile('^Przyjmij|^Zostań|Inny ciężar|Świadomie')).count() == 0, 'w treningu zostały decyzje o ciężarze')
    check(unit_inp(pg).first.input_value() == '40', 'ciężar nie jest przepisany z poprzedniego treningu')
    t.click(series_btn(pg).first); t.click(series_btn(pg).first)
    check(pg.get_by_role('button', name=re.compile('^✓ .*Wyciskanie')).count() == 1, 'ćwiczenie nie odhaczyło się po ostatniej serii')
    shot(pg, 'focus_exercise.png')
    for _ in range(10):
        if pg.get_by_role('heading', name=re.compile('^Rozciąganie')).count(): break
        pg.get_by_role('button', name=re.compile('^Dalej:')).click(); pg.wait_for_timeout(150)
    check(pg.get_by_text(re.compile('nie zmniejsza zakwasów')).count() == 1, 'brak uczciwej notki o rozciąganiu')
    shot(pg, 'focus_cooldown.png')
    pg.get_by_role('button', name='Zakończ trening', exact=True).click(); pg.wait_for_timeout(300)
    dialog(pg).get_by_role('button', name='Zapisz trening').click(); pg.wait_for_timeout(600)
    pg.wait_for_timeout(800)
    check(pg.locator('nav[aria-label="Nawigacja"]').is_visible(), 'nawigacja nie wróciła po treningu')
    wk = week_card(pg); shot(pg, 'focus_after.png')
    check('Możesz spróbować' in wk and '42,5 kg' in wk, f'podpowiedź ciężaru nie trafiła do podsumowania tygodnia: {wk}')
    sess = next(x for x in store(pg, 'sessions') if x['id'] not in ('h1', 'h2'))
    check(sess['status'] == 'completed' and 'cooldown' in sess.get('prep', []) and 'wu_arms' in sess.get('prep', []), f'sesja: {sess.get("status")} {sess.get("prep")}')
    return {'weekCard': wk.replace('\n', ' | ')}

def no_auto_increase(pg, url, ctx):
    # 20 kg × 12 dwa razy: w treningu ten sam ciężar; skok 12,5% nie pojawia się nawet w podsumowaniu
    demo(pg, url); seed(pg, TWO_TOP(20)); t = Taps()
    to_training(pg, t); start(pg, t)
    check(unit_inp(pg).first.input_value() == '20', 'ciężar zmienił się sam')
    pg.locator('button', has_text='Wyjdź').first.click(); pg.wait_for_timeout(400)
    wk = week_card(pg)
    check('Wyciskanie na maszynie: 22,5' not in wk, f'skok > 10% podpowiedziany: {wk}')
    return {'weekCard': wk.replace('\n', ' | ')}

# ---------- A ----------
def audit_a_first_workout(pg, url, ctx):
    demo(pg, url); t = Taps()
    to_training(pg, t); first = start(pg, t)
    check(first == 'Wyciskanie na maszynie', f'pierwsze ćwiczenie: {first}')
    check(pg.get_by_text(re.compile('Pierwszy raz: zacznij lżej')).count() == 1, 'brak wskazówki na pierwszy raz')
    check(unit_inp(pg).first.input_value() == '0', 'bez historii ciężar powinien czekać na wpis')
    t.fill(unit_inp(pg).first, '30'); t.click(series_btn(pg).first)
    taps_first = t.n
    check(unit_inp(pg).nth(1).input_value() == '30', 'seria 2 nie przejęła ciężaru z serii 1')
    t.click(series_btn(pg).first)
    finish(pg)
    pg = restart(ctx, pg, url); to_training(pg)
    sess = [x for x in store(pg, 'sessions') if x['status'] == 'completed']
    sets = [x for x in store(pg, 'sets') if x['exerciseId'] == 'machine_press']
    check(len(sess) == 1 and len(sets) == 2 and all(x['weightKg'] == 30 for x in sets), f'po restarcie: {len(sess)} sesji, {[(x["weightKg"], x["reps"]) for x in sets]}')
    return {'tapsToFirstSet (z pominięciem rozgrzewki)': taps_first}

# ---------- B ----------
def audit_b_weekly(pg, url, ctx):
    demo(pg, url); seed(pg, [(8, 'h1', 'B', {'machine_press': (40, [10, 10])})]); t = Taps()
    to_training(pg, t); start(pg, t)
    t.click(series_btn(pg).first); taps = t.n
    pg.get_by_label('powt.', exact=True).nth(1).fill('12'); pg.wait_for_timeout(200)
    t.click(series_btn(pg).first)
    targets = small_targets(pg); shot(pg, 'audit_b_session.png')
    finish(pg)
    pg = restart(ctx, pg, url); to_training(pg)
    wk = week_card(pg)
    check('Lepiej niż tydzień temu' in wk and '40×10 → 40×12' in wk, f'podsumowanie tygodnia: {wk}')
    return {'tapsToFirstSet': taps, 'weekCard': wk.replace('\n', ' | '), 'smallTargets': targets}

# ---------- C ----------
def audit_c_no_rir(pg, url, ctx):
    demo(pg, url); seed(pg, [(3, 'h1', 'B', {'machine_press': (40, [12, 12])})]); t = Taps()
    to_training(pg, t)
    check('Możesz spróbować' not in week_card(pg), 'jeden trening bez RIR dał podpowiedź zwiększenia')
    start(pg, t)
    t.click(series_btn(pg).first); taps = t.n; t.click(series_btn(pg).first)
    finish(pg)
    pg = restart(ctx, pg, url); to_training(pg)
    mine = [x for x in store(pg, 'sets') if x['sessionId'] != 'h1' and x['exerciseId'] == 'machine_press']
    check(len(mine) == 2 and all(x.get('rir') is None for x in mine), f'RIR dopisany sam: {mine}')
    check(all(x['reps'] == 12 and x['weightKg'] == 40 for x in mine), f'domyślne: {[(x["weightKg"], x["reps"]) for x in mine]}')
    return {'tapsToFirstSet': taps, 'weekAfter2xTopNoRir': week_card(pg).replace('\n', ' | ')}

# ---------- D ----------
def audit_d_pain(pg, url, ctx):
    demo(pg, url); seed(pg, [(3, 'h1', 'B', {'machine_press': (40, [10, 10])})]); t = Taps()
    to_training(pg, t); start(pg, t)
    t.click(pg.get_by_role('button', name='Ból? / zapas').first)
    t.click(pg.get_by_role('group', name='Ból podczas serii').first.get_by_role('button', name='5', exact=True))
    t.click(series_btn(pg).first)
    alert = pg.get_by_role('alert')
    check(alert.count() == 1 and 'Ból 5/10' in alert.inner_text(), 'brak trwałego ostrzeżenia po bólu 5/10')
    pg.wait_for_timeout(2600)
    check(pg.get_by_role('alert').count() == 1, 'ostrzeżenie znika razem z toastem')
    shot(pg, 'audit_d_pain.png')
    t.click(pg.get_by_role('button', name='Ból? / zapas').first)
    t.click(pg.get_by_role('group', name='Ból podczas serii').nth(1).get_by_role('button', name='2', exact=True))
    pg = restart(ctx, pg, url); to_training(pg)
    check(pg.get_by_role('alert').count() == 1, 'ostrzeżenie nie przetrwało restartu')
    check(pg.get_by_role('button', name='Ból 2/10').count() == 1, 'niezapisany ból z serii 2 zginął po restarcie')
    pg.get_by_role('group', name='Ból podczas serii').first.get_by_role('button', name='6', exact=True).click(); pg.wait_for_timeout(300)
    pg = restart(ctx, pg, url); to_training(pg)
    s1 = [x for x in store(pg, 'sets') if x['sessionId'] != 'h1']
    check(len(s1) == 1 and s1[0]['pain'] == 6, f'ból zapisanej serii: {s1}')
    pg.get_by_role('alert').get_by_role('button', name='Zamień ćwiczenie').click(); pg.wait_for_timeout(300)
    check(dialog(pg).get_by_text(re.compile('Ta sama grupa mięśni')).count() > 0, 'zamiana nie otwiera listy'); close_dialog(pg)
    pg.get_by_role('alert').get_by_role('button', name='Pomiń ćwiczenie').click(); pg.wait_for_timeout(400)
    check(pg.locator('h2').first.inner_text() != 'Wyciskanie na maszynie', 'pominięcie nie przeszło dalej')
    pg = restart(ctx, pg, url)
    kept = [x for x in store(pg, 'sets') if x['sessionId'] != 'h1']
    sess = next(x for x in store(pg, 'sessions') if x['id'] != 'h1')
    check(len(kept) == 1 and 'machine_press' in sess['skipped'], 'pominięcie usunęło serię albo nie zapisało się')
    return {'alertAfterRestart': True, 'savedPain': kept[0]['pain']}

# ---------- E ----------
def audit_e_manual(pg, url, ctx):
    demo(pg, url); seed(pg, TWO_TOP()); t = Taps()
    to_training(pg, t); start(pg, t)
    t.click(pg.get_by_role('button', name='Więcej').first)  # seria 1: 40 → 42,5
    t.click(series_btn(pg).first)
    check(unit_inp(pg).nth(1).input_value() == '42.5', f'seria 2 nie przejęła zmienionego ciężaru: {unit_inp(pg).nth(1).input_value()}')
    t.click(series_btn(pg).first)
    finish(pg)
    pg = restart(ctx, pg, url); to_training(pg)
    sess = next(x for x in store(pg, 'sessions') if x['id'] not in ('h1', 'h2'))
    sets = sorted(x['weightKg'] for x in store(pg, 'sets') if x['sessionId'] == sess['id'])
    old = [x['weightKg'] for x in store(pg, 'sets') if x['sessionId'] in ('h1', 'h2')]
    check(sets == [42.5, 42.5] and old == [40] * 6, f'serie: {sets}, historia: {old}')
    return {'sets': sets, 'taps': t.n}

# ---------- F ----------
def audit_f_lb(pg, url, ctx):
    demo(pg, url); seed(pg, TWO_TOP())
    to_training(pg)
    pg.get_by_role('button', name=re.compile('Jednostki i skoki')).click(); pg.wait_for_timeout(200)
    dialog(pg).get_by_role('button', name='lb', exact=True).click(); dialog(pg).get_by_role('button', name='Zapisz').click(); pg.wait_for_timeout(400)
    wk = week_card(pg)
    pg = restart(ctx, pg, url); to_training(pg); start(pg, Taps())
    card = pg.locator('body').inner_text()
    kg = [ln for ln in card.split('\n') if re.search(r'\bkg\b', ln)]
    check(not kg, f'w sesji zostało „kg”: {kg}')
    check(unit_inp(pg, 'lb').first.input_value() == '88', f'ciężar serii w lb: {unit_inp(pg, "lb").first.input_value()}')
    series_btn(pg).first.click(); pg.wait_for_timeout(300)
    pg.locator('[aria-label=Instrukcja]').first.click(); pg.wait_for_timeout(300)
    hist = dialog(pg).inner_text()
    check('kg' not in hist.split('Ostatnie wyniki')[-1].split('Przy pierwszym')[0], 'historia w karcie ćwiczenia w kg')
    close_dialog(pg); shot(pg, 'audit_f_lb.png')
    s = [x['weightKg'] for x in store(pg, 'sets') if x['sessionId'] not in ('h1', 'h2')]
    check(s == [40], f'zapis bez ruszania ciężaru nie może dryfować przez przeliczenie lb: {s}')
    return {'weekCardLb': wk.replace('\n', ' | '), 'storedKg': s[0]}
# ---------- G ----------
def audit_g_reschedule(pg, url, ctx):
    demo(pg, url); seed(pg, [(4, 'h1', 'B', {'machine_press': (40, [10, 10])})]); t = Taps()
    to_training(pg, t)
    check(pg.get_by_role('button', name='Przełóż').count() == 1, 'brak „Przełóż” w dniu treningu')
    t.click(pg.get_by_role('button', name='Przełóż')); taps = t.n
    check(pg.get_by_text('Dziś oznaczone jako niedostępne.').count() == 1, 'przełożenie nie zadziałało')
    nxt = pg.get_by_text(re.compile('^Następny:')).inner_text()
    # cofnięcie przypadkowego oznaczenia: stuknięcie dnia w pasku
    pg.get_by_role('button', name=re.compile(r'niedostępny$')).first.click(); pg.wait_for_timeout(300)
    check(pg.get_by_role('button', name='Przełóż').count() == 1, 'nie da się cofnąć oznaczenia')
    pg.get_by_role('button', name='Przełóż').click(); pg.wait_for_timeout(300)
    nxt = pg.get_by_text(re.compile('^Następny:')).inner_text()
    plan = re.search(r'Następny: (.+), trening ([AB])', nxt)
    check(plan is not None, f'brak następnego terminu: {nxt}')
    tpl = plan.group(2)
    # data z paska 14 dni (pierwszy dzień z treningiem)
    strip = pg.evaluate("""() => [...document.querySelectorAll('button[aria-label]')].filter(b => /trening [AB]$|wolne$|niedostępny$|zrobiony$/.test(b.getAttribute('aria-label'))).map(b => b.getAttribute('aria-label'))""")
    idx = next(i for i, l in enumerate(strip) if re.search('trening [AB]$', l))
    when = (datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=1))) + datetime.timedelta(days=idx)).replace(hour=10, minute=0, second=0, microsecond=0)
    pg = restart(ctx, pg, url, at=when); to_training(pg)
    check(pg.get_by_role('button', name='Start').count() == 1, f'w dniu przełożonym brak treningu (dzień +{idx})')
    t2 = Taps(); start(pg, t2, warm=False)
    check(pg.get_by_text(f'Trening {tpl}').count() >= 1, 'inny szablon niż zaplanowany')
    past_warmup(pg); unit_inp(pg).first.fill('40'); series_btn(pg).first.click(); pg.wait_for_timeout(300)
    finish(pg)
    pg = restart(ctx, pg, url, at=when); to_training(pg)
    done_s = [s for s in store(pg, 'sessions') if s['id'] != 'h1' and s['status'] == 'completed']
    check(len(done_s) == 1 and done_s[0]['date'] == when.strftime('%Y-%m-%d') and done_s[0]['templateId'] == tpl, f'sesja: {[(s["date"], s["templateId"]) for s in done_s]}')
    after = pg.evaluate("""() => [...document.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label')).find(l => /trening [AB]$/.test(l))""")
    check(after.endswith(f'trening {"B" if tpl == "A" else "A"}'), f'rotacja A/B po przełożeniu: {after}')
    return {'tapsToReschedule': taps, 'movedBy': idx, 'template': tpl, 'nextAfter': after}

# ---------- H ----------
def audit_h_break(pg, url, ctx):
    demo(pg, url); seed(pg, [(35, 'h1', 'B', {'machine_press': (40, [12, 12])}), (31, 'h2', 'B', {'machine_press': (40, [12, 12])})]); t = Taps()
    to_training(pg, t); start(pg, t)
    reason = pg.get_by_text(re.compile('dni przerwy')).first.inner_text()
    w_default = unit_inp(pg).first.input_value()
    check(w_default == '35', f'po 4 tygodniach przerwy podpowiedź powinna być lżejsza: {w_default}')
    t.click(series_btn(pg).first)
    finish(pg)
    pg = restart(ctx, pg, url); to_training(pg)
    sets = [x['weightKg'] for x in store(pg, 'sets') if x['sessionId'] not in ('h1', 'h2')]
    check(sets == [35], f'serie po powrocie: {sets}')
    return {'reason': reason, 'defaultWeight': w_default}

# ---------- I ----------
def audit_i_swap(pg, url, ctx):
    demo(pg, url); seed(pg, TWO_TOP()); t = Taps()
    to_training(pg, t); start(pg, t)
    t.click(pg.locator('button[aria-label="Zamień ćwiczenie"]').first)
    t.click(dialog(pg).get_by_role('button', name=re.compile('^Wyciskanie hantli na ławce płaskiej')))
    check(pg.locator('h2').first.inner_text() == 'Wyciskanie hantli na ławce płaskiej', 'zamiana nie zadziałała')
    check(pg.get_by_text('zamiast: Wyciskanie na maszynie').count() == 1, 'brak informacji o zamianie')
    check(pg.get_by_text(re.compile('Pierwszy raz: zacznij lżej')).count() == 1, 'zamiennik przejął historię oryginału')
    t.fill(unit_inp(pg).first, '14'); t.click(series_btn(pg).first)
    finish(pg)
    pg = restart(ctx, pg, url); to_training(pg)
    mine = [x for x in store(pg, 'sets') if x['sessionId'] not in ('h1', 'h2')]
    check(len(mine) == 1 and mine[0]['exerciseId'] == 'flat_db_press' and mine[0]['slot'] == 'machine_press', f'serie zamiennika: {mine}')
    tomorrow = (datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=1))) + datetime.timedelta(days=1)).replace(hour=10, minute=0)
    pg = restart(ctx, pg, url, at=tomorrow); to_training(pg); start(pg, Taps())
    check(pg.locator('h2').first.inner_text() == 'Wyciskanie hantli na ławce skośnej', 'po A powinien być B')
    pg.locator('button[aria-label="Zamień ćwiczenie"]').first.click(); pg.wait_for_timeout(300)
    dialog(pg).get_by_role('button', name=re.compile('^Wyciskanie hantli na ławce płaskiej')).click(); pg.wait_for_timeout(400)
    check(pg.get_by_text(re.compile('Ostatnio .*14×10')).count() == 1 and unit_inp(pg).first.input_value() == '14', 'zamiennik bez własnej historii')
    return {'substituteSet': '14×10 flat_db_press (slot machine_press)'}

ALL = [focus_flow, no_auto_increase, audit_a_first_workout, audit_b_weekly, audit_c_no_rir, audit_d_pain, audit_e_manual, audit_f_lb, audit_g_reschedule, audit_h_break, audit_i_swap]
