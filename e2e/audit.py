"""Audyt W2: scenariusze użytkownika A–I (fikcyjne dane), każdy sprawdzony po ponownym uruchomieniu aplikacji.
Uruchom: npm run build:single && python3 e2e/run.py audit_a audit_b ...  (albo bez nazw: wszystkie)"""
import datetime, re
from common import demo, tab, dialog, close_dialog, shot
from scenarios import check

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

def start(pg, t):
    b = pg.get_by_role('button', name='Start')
    if b.count() == 0: b = pg.get_by_role('button', name=re.compile('Mimo to zacznij'))
    t.click(b.first); pg.wait_for_timeout(300)
    return pg.locator('h2').first.inner_text()

def finish(pg):
    for _ in range(12):
        z = pg.get_by_role('button', name='Zakończ trening')
        if z.count(): z.click(); break
        pg.get_by_role('button', name=re.compile('Następne ćwiczenie')).click(); pg.wait_for_timeout(150)
    pg.wait_for_timeout(300); dialog(pg).get_by_role('button', name='Zapisz trening').click(); pg.wait_for_timeout(600)

def unit_inp(pg, u='kg'): return pg.get_by_label(u, exact=True)
def series_btn(pg): return pg.get_by_role('button', name='Seria zrobiona')
def row_text(pg, name): return pg.locator('button.w-full').filter(has_text=name).first.inner_text()
TWO_TOP = lambda w=40: [(7, 'h1', 'B', {'machine_press': (w, [12, 12, 12])}), (3, 'h2', 'B', {'machine_press': (w, [12, 12, 12])})]

def small_targets(pg):
    """Elementy dotykowe < 44×44 pt w widoku (Apple HIG: min. ok. 44×44 pt)."""
    return pg.evaluate("""() => [...document.querySelectorAll('main button, main input, button, input')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0; })
      .map(e => { const r = e.getBoundingClientRect(); return { t: (e.getAttribute('aria-label') || e.innerText || e.placeholder || e.type).trim().replace(/\\s+/g, ' ').slice(0, 28), w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter(x => x.w < 44 || x.h < 44)
      .filter((x, i, a) => a.findIndex(y => y.t === x.t && y.w === x.w && y.h === x.h) === i)""")

# ---------- A ----------
def audit_a_first_workout(pg, url, ctx):
    demo(pg, url); t = Taps()
    to_training(pg, t); first = start(pg, t)
    check(first == 'Wyciskanie na maszynie', f'pierwsze ćwiczenie: {first}')
    check(pg.get_by_text('Dobierz ciężar').count() and pg.get_by_text(re.compile('^Start: pierwsza seria lekko')).count(), 'brak propozycji startowej')
    check(unit_inp(pg).first.input_value() == '0', 'bez historii ciężar powinien czekać na wpis')
    t.fill(unit_inp(pg).first, '30'); t.click(series_btn(pg).first)
    taps_first = t.n
    check(unit_inp(pg).first.input_value() == '30', 'zapisana seria straciła ciężar')
    check(series_btn(pg).count() and unit_inp(pg).nth(1).input_value() == '30', 'seria 2 nie przejęła ciężaru z serii 1')
    t.click(series_btn(pg).first)
    shot(pg, 'audit_a_sets.png')
    finish(pg)
    pg = restart(ctx, pg, url); to_training(pg)
    sess = [s for s in store(pg, 'sessions') if s['status'] == 'completed']
    sets = [s for s in store(pg, 'sets') if s['exerciseId'] == 'machine_press']
    check(len(sess) == 1 and len(sets) == 2 and all(s['weightKg'] == 30 for s in sets), f'po restarcie: {len(sess)} sesji, {[(s["weightKg"], s["reps"]) for s in sets]}')
    nxt = row_text(pg, 'Wyciskanie na maszynie')
    check('30 kg' in nxt, f'kolejna sugestia nie bazuje na zapisanym ciężarze: {nxt}')
    return {'tapsToFirstSet': taps_first, 'nextHint': nxt.split('\n')[-1]}

# ---------- B ----------
def audit_b_accept(pg, url, ctx):
    demo(pg, url); seed(pg, TWO_TOP()); t = Taps()
    to_training(pg, t)
    check('↑ 42,5 kg' in row_text(pg, 'Wyciskanie na maszynie'), 'brak podglądu na liście')
    start(pg, t)
    reason = pg.get_by_text(re.compile('na górze zakresu')).first.inner_text()
    t.click(pg.get_by_role('button', name='Przyjmij 42,5 kg')); t.click(series_btn(pg).first)
    taps = t.n
    t.click(series_btn(pg).first)
    targets = small_targets(pg); shot(pg, 'audit_b_session.png')
    finish(pg)
    pg = restart(ctx, pg, url); to_training(pg)
    sess = next(s for s in store(pg, 'sessions') if s['id'] not in ('h1', 'h2'))
    dec = sess.get('progress', {}).get('machine_press', {})
    sets = sorted((s['weightKg'], s['reps']) for s in store(pg, 'sets') if s['sessionId'] == sess['id'] and s['exerciseId'] == 'machine_press')
    check(dec.get('decision') == 'accepted' and dec.get('chosenKg') == 42.5, f'decyzja: {dec}')
    check(sets == [(42.5, 10), (42.5, 10)], f'serie: {sets}')
    old = [s['weightKg'] for s in store(pg, 'sets') if s['sessionId'] in ('h1', 'h2')]
    check(old == [40] * 6, 'historia zmieniona')
    return {'reason': reason, 'tapsToFirstSet': taps, 'next': row_text(pg, 'Wyciskanie na maszynie').split('\n')[-1], 'smallTargets': targets}

# ---------- C ----------
def audit_c_no_rir(pg, url, ctx):
    demo(pg, url); seed(pg, [(3, 'h1', 'B', {'machine_press': (40, [12, 12])})]); t = Taps()
    to_training(pg, t); start(pg, t)
    check(pg.get_by_text(re.compile('Pierwszy raz górny zakres')).count() > 0, 'bez RIR jeden trening nie powinien dawać zwiększenia')
    check(pg.get_by_role('button', name=re.compile('^Przyjmij')).count() == 0, 'propozycja zmiany ciężaru bez podstaw')
    t.click(series_btn(pg).first); taps = t.n; t.click(series_btn(pg).first)
    finish(pg)
    pg = restart(ctx, pg, url); to_training(pg)
    mine = [s for s in store(pg, 'sets') if s['sessionId'] != 'h1' and s['exerciseId'] == 'machine_press']
    check(len(mine) == 2 and all('rir' not in s or s['rir'] is None for s in mine), f'RIR dopisany sam: {mine}')
    check(all(s['reps'] == 12 and s['weightKg'] == 40 for s in mine), f'domyślne powtórzenia: {[(s["weightKg"], s["reps"]) for s in mine]}')
    nxt = row_text(pg, 'Wyciskanie na maszynie').split('\n')[-1]
    return {'tapsToFirstSet': taps, 'nextAfter2xTopNoRir': nxt}

# ---------- D ----------
def audit_d_pain(pg, url, ctx):
    demo(pg, url); seed(pg, [(3, 'h1', 'B', {'machine_press': (40, [10, 10])})]); t = Taps()
    to_training(pg, t); start(pg, t)
    t.click(pg.get_by_role('button', name='ból?').first)
    t.click(pg.get_by_role('group', name='Ból podczas serii').first.get_by_role('button', name='5', exact=True))
    t.click(series_btn(pg).first)
    alert = pg.get_by_role('alert')
    check(alert.count() == 1 and 'Ból 5/10' in alert.inner_text(), 'brak trwałego ostrzeżenia po bólu 5/10 w trakcie ćwiczenia')
    pg.wait_for_timeout(2600)
    check(pg.get_by_role('alert').count() == 1, 'ostrzeżenie znika razem z toastem')
    shot(pg, 'audit_d_pain.png')
    # ból wpisany w serii 2 przed zapisem: szkic przetrwa restart
    t.click(pg.get_by_role('button', name='ból?').first)
    t.click(pg.get_by_role('group', name='Ból podczas serii').nth(1).get_by_role('button', name='2', exact=True))
    pg = restart(ctx, pg, url); to_training(pg)
    check(pg.get_by_role('alert').count() == 1, 'ostrzeżenie nie przetrwało restartu')
    check(pg.get_by_role('button', name='ból 2').count() == 1, 'niezapisany ból z serii 2 zginął po restarcie')
    # zmiana bólu w zapisanej serii zapisuje się od razu (bez „Popraw serię”)
    pg.get_by_role('group', name='Ból podczas serii').first.get_by_role('button', name='6', exact=True).click(); pg.wait_for_timeout(300)
    pg = restart(ctx, pg, url); to_training(pg)
    s1 = [s for s in store(pg, 'sets') if s['sessionId'] != 'h1']
    check(len(s1) == 1 and s1[0]['pain'] == 6 and s1[0]['weightKg'] == 40, f'ból zapisanej serii: {s1}')
    pg.get_by_role('button', name='Zamień ćwiczenie').nth(1).click(); pg.wait_for_timeout(300)
    check(dialog(pg).get_by_text(re.compile('Ta sama grupa mięśni')).count() > 0, 'zamiana nie otwiera listy'); close_dialog(pg)
    pg.get_by_role('button', name='Pomiń ćwiczenie').click(); pg.wait_for_timeout(400)
    check(pg.locator('h2').first.inner_text() != 'Wyciskanie na maszynie', 'pominięcie nie przeszło dalej')
    pg = restart(ctx, pg, url)
    kept = [s for s in store(pg, 'sets') if s['sessionId'] != 'h1']
    sess = next(s for s in store(pg, 'sessions') if s['id'] != 'h1')
    check(len(kept) == 1 and 'machine_press' in sess['skipped'], 'pominięcie usunęło serię albo nie zapisało się')
    return {'alertAfterRestart': True, 'savedPain': kept[0]['pain']}

# ---------- E ----------
def audit_e_manual(pg, url, ctx):
    demo(pg, url); seed(pg, TWO_TOP()); t = Taps()
    to_training(pg, t); start(pg, t)
    t.click(pg.get_by_role('button', name='Inny ciężar'))
    t.click(pg.get_by_role('button', name='Więcej').first)  # 42,5 → 45
    t.click(pg.get_by_role('button', name='Zapisz', exact=True))
    check(unit_inp(pg).first.input_value() == '45', 'seria nie przejęła ręcznego ciężaru')
    t.click(series_btn(pg).first)
    plus = pg.get_by_role('button', name='Więcej')
    t.click(plus.nth(plus.count() - 2))  # seria 2: ciężar 45 → 47,5
    t.click(series_btn(pg).first)
    finish(pg)
    pg = restart(ctx, pg, url); to_training(pg)
    sess = next(s for s in store(pg, 'sessions') if s['id'] not in ('h1', 'h2'))
    dec = sess['progress']['machine_press']
    sets = sorted(s['weightKg'] for s in store(pg, 'sets') if s['sessionId'] == sess['id'])
    check(dec['decision'] == 'modified' and dec['chosenKg'] == 45 and dec['suggestedKg'] == 42.5, f'decyzja: {dec}')
    check(sets == [45, 47.5], f'serie: {sets}')
    return {'decision': f"{dec['decision']} {dec['suggestedKg']}→{dec['chosenKg']}", 'sets': sets, 'next': row_text(pg, 'Wyciskanie na maszynie').split('\n')[-1]}

# ---------- F ----------
def audit_f_lb(pg, url, ctx):
    demo(pg, url); seed(pg, TWO_TOP())
    to_training(pg)
    pg.get_by_role('button', name=re.compile('Jednostki i skoki')).click(); pg.wait_for_timeout(200)
    dialog(pg).get_by_role('button', name='lb', exact=True).click(); dialog(pg).get_by_role('button', name='Zapisz').click(); pg.wait_for_timeout(400)
    rowt = row_text(pg, 'Wyciskanie na maszynie')
    check('lb' in rowt and 'kg' not in rowt, f'lista: {rowt}')
    pg = restart(ctx, pg, url); to_training(pg); start(pg, Taps())
    card = pg.locator('main').inner_text() if pg.locator('main').count() else pg.locator('body').inner_text()
    kg = [ln for ln in card.split('\n') if re.search(r'\bkg\b', ln)]
    check(not kg, f'w sesji zostało „kg”: {kg}')
    check(unit_inp(pg, 'lb').first.input_value() == '88', f'ciężar serii w lb: {unit_inp(pg, "lb").first.input_value()}')
    pg.get_by_role('button', name=re.compile('^Przyjmij 90 lb')).click(); pg.wait_for_timeout(300)
    series_btn(pg).first.click(); pg.wait_for_timeout(300)
    pg.locator('[aria-label=Instrukcja]').first.click(); pg.wait_for_timeout(300)
    hist = dialog(pg).inner_text()
    check('kg' not in hist.split('Ostatnie wyniki')[-1].split('Przy pierwszym')[0], 'historia w karcie ćwiczenia w kg')
    close_dialog(pg); shot(pg, 'audit_f_lb.png')
    s = [x['weightKg'] for x in store(pg, 'sets') if x['sessionId'] not in ('h1', 'h2')]
    check(len(s) == 1 and abs(s[0] - 90 * 0.45359237) < 0.01, f'zapis w kg: {s}')
    reason = [ln for ln in card.split('\n') if 'zakresu' in ln]
    return {'listHint': rowt.split('\n')[-1], 'reason': reason[:1], 'storedKg': round(s[0], 2)}

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
    t2 = Taps(); start(pg, t2)
    check(pg.get_by_text(f'Trening {tpl}').count() >= 1, 'inny szablon niż zaplanowany')
    unit_inp(pg).first.fill('40'); series_btn(pg).first.click(); pg.wait_for_timeout(300)
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
    to_training(pg, t)
    check('↓ 35 kg' in row_text(pg, 'Wyciskanie na maszynie'), f'lista po przerwie: {row_text(pg, "Wyciskanie na maszynie")}')
    start(pg, t)
    reason = pg.get_by_text(re.compile('dni przerwy')).first.inner_text()
    w_default = unit_inp(pg).first.input_value()
    t.click(pg.get_by_role('button', name='Przyjmij 35 kg')); t.click(series_btn(pg).first)
    finish(pg)
    pg = restart(ctx, pg, url); to_training(pg)
    sets = [s['weightKg'] for s in store(pg, 'sets') if s['sessionId'] not in ('h1', 'h2')]
    check(sets == [35], f'serie po powrocie: {sets}')
    return {'reason': reason, 'defaultBeforeDecision': w_default, 'next': row_text(pg, 'Wyciskanie na maszynie').split('\n')[-1]}

# ---------- I ----------
def audit_i_swap(pg, url, ctx):
    demo(pg, url); seed(pg, TWO_TOP()); t = Taps()
    to_training(pg, t); start(pg, t)
    t.click(pg.locator('header + div + * button[aria-label="Zamień ćwiczenie"], button[aria-label="Zamień ćwiczenie"]').first)
    t.click(dialog(pg).get_by_role('button', name=re.compile('^Wyciskanie hantli na ławce płaskiej')))
    check(pg.locator('h2').first.inner_text() == 'Wyciskanie hantli na ławce płaskiej', 'zamiana nie zadziałała')
    check(pg.get_by_text('zamiast: Wyciskanie na maszynie').count() == 1, 'brak informacji o zamianie')
    check(pg.get_by_text('Dobierz ciężar').count() == 1, 'zamiennik przejął progresję oryginału')
    t.fill(unit_inp(pg).first, '14'); t.click(series_btn(pg).first)
    finish(pg)
    pg = restart(ctx, pg, url); to_training(pg)
    mine = [s for s in store(pg, 'sets') if s['sessionId'] not in ('h1', 'h2')]
    check(len(mine) == 1 and mine[0]['exerciseId'] == 'flat_db_press' and mine[0]['slot'] == 'machine_press', f'serie zamiennika: {mine}')
    orig = row_text(pg, 'Wyciskanie na maszynie')
    check('↑ 42,5 kg' in orig, f'historia oryginału zmieniona przez zamiennik: {orig}')
    # kolejny trening (następny dzień): ten sam zamiennik pamięta własną historię
    tomorrow = (datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=1))) + datetime.timedelta(days=1)).replace(hour=10, minute=0)
    pg = restart(ctx, pg, url, at=tomorrow); to_training(pg); start(pg, Taps())
    pg.locator('button[aria-label="Zamień ćwiczenie"]').first.click(); pg.wait_for_timeout(300)
    dialog(pg).get_by_role('button', name=re.compile('^Wyciskanie hantli na ławce płaskiej')).click(); pg.wait_for_timeout(400)
    card = pg.locator('h2').first.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]').inner_text()
    check('14×10' in card and 'Dobierz ciężar' not in card, f'zamiennik bez własnej historii: {card[:200]}')
    return {'substituteSet': '14×10 flat_db_press (slot machine_press)', 'originalHint': orig.split('\n')[-1]}

ALL = [audit_a_first_workout, audit_b_accept, audit_c_no_rir, audit_d_pain, audit_e_manual, audit_f_lb, audit_g_reschedule, audit_h_break, audit_i_swap]
