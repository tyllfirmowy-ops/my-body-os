"""Scenariusze E2E. Każdy zwraca słownik obserwacji; asercje opisują oczekiwane zachowanie."""
import re
from common import demo, tab, dialog, close_dialog, shot

def check(cond, msg):
    if not cond: raise AssertionError(msg)

def exercise_card_and_swap(pg, url):
    demo(pg, url); tab(pg, 'Trening')
    pg.get_by_text('Martwy ciąg rumuński z hantlami').first.click(); pg.wait_for_timeout(800)
    pg.get_by_role('button', name='0,5×').click(); pg.get_by_role('button', name='Mięśnie').click()
    pg.get_by_role('group', name='Fazy ruchu').get_by_role('button').nth(2).click()
    card = dialog(pg).inner_text().lower()
    for k in ['ostatnie wyniki', 'alternatywy', 'ustawienie sprzętu', '3 najczęstsze błędy']: check(k in card, f'karta bez sekcji: {k}')
    shot(pg, 'card.png'); close_dialog(pg)
    start = pg.get_by_role('button', name='Start')
    if start.count() == 0: start = pg.get_by_role('button', name=re.compile('Mimo to zacznij'))
    start.first.click(); pg.wait_for_timeout(500)
    first = pg.locator('h2').first.inner_text()
    pg.get_by_role('button', name='Seria zrobiona').first.click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Zamień ćwiczenie').click(); pg.wait_for_timeout(300)
    dialog(pg).locator('button:not([disabled])').filter(has_text='ławce płaskiej').first.click(); pg.wait_for_timeout(400)
    after = pg.locator('h2').first.inner_text()
    check(after != first, 'zamiana nie zmieniła ćwiczenia')
    pg.get_by_role('button', name='Seria zrobiona').first.click(); pg.wait_for_timeout(300)
    pg.reload(); pg.wait_for_timeout(1000)
    if pg.get_by_text('Wznów trening').count(): pg.get_by_text('Wznów trening').first.click(); pg.wait_for_timeout(400)
    check(pg.locator('h2').first.inner_text() == after, 'zamiana nie przetrwała odświeżenia')
    check(pg.get_by_text('Wcześniej w tym miejscu').count() > 0, 'brak notki o serii z ćwiczenia z planu')
    pg.get_by_text('Wróć do:').click(); pg.wait_for_timeout(400)
    check(pg.locator('h2').first.inner_text() == first, 'powrót do ćwiczenia z planu nie działa')
    return {'first': first, 'swapped_to': after}

def backup_roundtrip(pg, url):
    demo(pg, url); tab(pg, 'Zdrowie')
    pg.get_by_role('button', name='Przygotuj kopię').click(); pg.get_by_text('Plik gotowy i sprawdzony').wait_for(timeout=10000)
    with pg.expect_download() as dl: pg.get_by_role('button', name='2. Zapisz w Plikach / iCloud').click()
    path = '/tmp/mybodyos-e2e-kopia.json'; dl.value.save_as(path)
    pg.get_by_role('button', name='3. Potwierdzam: plik jest zapisany').click(); pg.wait_for_timeout(300)
    check(pg.get_by_text('Potwierdzona kopia: brak').count() == 0, 'potwierdzenie kopii nie zapisane')
    pg.locator('input[type=file][accept*=json]').last.set_input_files(path); pg.wait_for_timeout(600)
    check(pg.get_by_text('suma kontrolna zgodna').count() > 0, 'podgląd importu bez weryfikacji sumy')
    pg.get_by_role('button', name='Zastąp dane').click()
    pg.get_by_text('Dane odtworzone').wait_for(timeout=3000)
    return {'ok': True}

def recipe_flow(pg, url):
    demo(pg, url); tab(pg, 'Dieta')
    pg.get_by_role('button', name='Przepisy').click(); pg.get_by_role('button', name='Nowy przepis').click()
    pg.get_by_placeholder('np. Kurczak curry meal prep').fill('E2E kurczak ryż')
    for q, g in [('pierś z kurczaka surowa', '300'), ('ryż biały suchy', '150')]:
        pg.get_by_role('button', name='Dodaj składnik').click(); pg.wait_for_timeout(150)
        pg.get_by_placeholder('Szukaj w bazie (np. kurczak, ryż)…').fill(q); pg.wait_for_timeout(150)
        dialog(pg).locator('button.w-full.flex').first.click(); pg.wait_for_timeout(150)
        dialog(pg).locator('input[inputmode=decimal]').first.fill(g)
        dialog(pg).get_by_role('button', name='Dodaj', exact=True).click(); pg.wait_for_timeout(150)
    porcja = dialog(pg).get_by_text(re.compile('^Porcja:')).first.locator('..').inner_text()
    kcal = int(re.search(r'(\d+) kcal', porcja).group(1))
    check(700 <= kcal <= 1000, f'porcja kurczak 300 g + ryż 150 g poza zakresem: {kcal} kcal')
    dialog(pg).get_by_role('button', name='Dodaj 1 porc. do dziennika').click(); pg.wait_for_timeout(400)
    line = pg.get_by_text('E2E kurczak ryż (1 porc.)').first.locator('xpath=ancestor::button[1]').inner_text()
    pg.get_by_role('button', name='Przepisy').click(); dialog(pg).get_by_text('E2E kurczak ryż').first.click(); pg.wait_for_timeout(200)
    dialog(pg).locator('input[inputmode=decimal]').first.fill('900'); dialog(pg).get_by_role('button', name='Zapisz', exact=True).click(); pg.wait_for_timeout(300)
    close_dialog(pg)
    check(pg.get_by_text('E2E kurczak ryż (1 porc.)').first.locator('xpath=ancestor::button[1]').inner_text() == line, 'edycja przepisu zmieniła historię')
    pg.get_by_role('button', name='Szablony').click(); pg.get_by_role('button', name='Edytuj Dzień A').click(); pg.wait_for_timeout(200)
    dialog(pg).locator('input').first.fill('Dzień A E2E')
    check(dialog(pg).get_by_text('Dzień bez treningu').count() > 0, 'brak podglądu dnia bez treningu')
    dialog(pg).get_by_role('button', name='Zapisz', exact=True).click(); pg.wait_for_timeout(300)
    check(pg.get_by_text('Dzień A E2E').count() > 0, 'szablon nie zapisany')
    close_dialog(pg)
    pg.get_by_role('button', name='Zakupy').click(); pg.wait_for_timeout(200)
    check(dialog(pg).get_by_text('E2E kurczak ryż').count() > 0, 'lista zakupów bez przepisu')
    return {'portion_kcal': kcal}

def workout_plan_flow(pg, url):
    demo(pg, url); tab(pg, 'Trening')
    pg.get_by_role('button', name='Edytuj plan A').click(); pg.get_by_role('button', name='Nowy wariant planu A').click()
    dialog(pg).locator('input').first.fill('A E2E')
    dialog(pg).get_by_role('button', name='W dół').first.click()
    second = dialog(pg).locator('span.font-semibold').nth(0).inner_text()
    dialog(pg).get_by_role('button', name='Zapisz', exact=True).click(); pg.wait_for_timeout(300)
    check(dialog(pg).get_by_text('aktywny').count() > 0, 'wariant nie jest aktywny')
    close_dialog(pg)
    start = pg.get_by_role('button', name='Start')
    if start.count() == 0: start = pg.get_by_role('button', name=re.compile('Mimo to zacznij A'))
    start.first.click(); pg.wait_for_timeout(500)
    h = pg.locator('h2').first.inner_text()
    check(h in second, f'trening nie startuje od pierwszego ćwiczenia wariantu ({h} vs {second})')
    return {'first': h}

def coach_feedback(pg, url):
    demo(pg, url)
    check(pg.get_by_text('Coach', exact=True).count() == 1, 'brak karty coacha')
    pg.get_by_role('button', name='Nie teraz…').click(); pg.get_by_role('button', name='Nie pomaga mi').click(); pg.wait_for_timeout(300)
    check(pg.get_by_text('Coach', exact=True).count() == 0, 'odrzucona porada nadal widoczna')
    pg.reload(); pg.get_by_text('Ukryte porady (1)').click(); pg.get_by_role('button', name='Pokazuj znowu').click(); pg.wait_for_timeout(300)
    check(pg.get_by_text('Coach', exact=True).count() == 1, 'przywrócenie porady nie działa')
    return {'ok': True}

def food_search(pg, url, ctx):
    demo(pg, url); tab(pg, 'Dieta')
    pg.get_by_role('button', name='Dodaj').first.click()
    inp = pg.get_by_placeholder('Szukaj w bazie (np. kurczak, ryż)…')
    top = {}
    for q in ['kurczak', 'ryż']:
        inp.fill(q); pg.wait_for_timeout(50); top[q] = dialog(pg).locator('button.w-full.flex').first.inner_text().split('\n')[0]
    check(top['ryż'].startswith('Ryż'), f'„ryż” → {top["ryż"]}')
    check('szac' not in top['kurczak'], f'„kurczak” → danie szacunkowe {top["kurczak"]}')
    dialog(pg).get_by_role('button', name='Online', exact=True).click()
    ctx.set_offline(True)
    pg.get_by_placeholder('Nazwa lub marka produktu…').fill('ke')
    check(pg.get_by_role('button', name='Wpisz min. 3 litery').is_disabled(), 'online od 1–2 liter')
    pg.get_by_placeholder('Nazwa lub marka produktu…').fill('kefir'); pg.get_by_role('button', name='Szukaj w Open Food Facts').click(); pg.wait_for_timeout(300)
    check(pg.get_by_text('Brak internetu').count() > 0, 'brak komunikatu offline')
    ctx.set_offline(False)
    return top

def storage_diagnostics(pg, url):
    demo(pg, url); tab(pg, 'Zdrowie')
    check(pg.get_by_text('Pamięć urządzenia').count() > 0, 'brak karty diagnostyki')
    pg.get_by_role('button', name='Test zapisu').click(); pg.get_by_text(re.compile('Test zapisu udany')).wait_for(timeout=3000)
    return {'persisted_line': pg.get_by_text('persisted():').inner_text()}

CLEAR_DISMISS = "async () => { const r = indexedDB.open('my-body-os'); await new Promise(ok => r.onsuccess = ok); const db = r.result; const tx = db.transaction('settings', 'readwrite'); const st = tx.objectStore('settings'); const g = st.get('settings'); await new Promise(ok => g.onsuccess = ok); const s = g.result; delete s.backupReminderDismissed; st.put(s); await new Promise(ok => tx.oncomplete = ok); db.close(); }"

def morning_backup_reminder(pg, url):
    demo(pg, url)
    pg.get_by_text('Poranny check-in').first.click(); pg.wait_for_timeout(300)
    check(dialog(pg).get_by_text('brak potwierdzonej kopii').count() > 0, 'brak przypomnienia o kopii bez potwierdzonej kopii')
    dialog(pg).get_by_role('button', name='Za tydzień').click(); pg.wait_for_timeout(300)
    check(dialog(pg).get_by_text('brak potwierdzonej kopii').count() == 0, 'przypomnienie nie znika po „Za tydzień”')
    close_dialog(pg); pg.reload(); pg.wait_for_timeout(800)
    pg.get_by_text('Poranny check-in').first.click(); pg.wait_for_timeout(300)
    check(dialog(pg).get_by_text('brak potwierdzonej kopii').count() == 0, 'przypomnienie wraca po odświeżeniu')
    close_dialog(pg)
    pg.evaluate(CLEAR_DISMISS); pg.reload(); pg.wait_for_timeout(800)
    pg.get_by_text('Poranny check-in').first.click(); pg.wait_for_timeout(300)
    dialog(pg).get_by_role('button', name='Zapisz i zrób kopię').click(); pg.wait_for_timeout(700)
    check(pg.get_by_role('button', name='Przygotuj kopię').is_visible(), 'nie przeniesiono do karty kopii')
    return {'ok': True}

def recipe_portions_in_diary(pg, url):
    demo(pg, url); tab(pg, 'Dieta')
    pg.get_by_role('button', name='Przepisy').click(); pg.get_by_role('button', name='Nowy przepis').click()
    pg.get_by_placeholder('np. Kurczak curry meal prep').fill('E2E porcje')
    pg.get_by_role('button', name='Dodaj składnik').click(); pg.wait_for_timeout(150)
    pg.get_by_placeholder('Szukaj w bazie (np. kurczak, ryż)…').fill('ryż biały suchy'); pg.wait_for_timeout(150)
    dialog(pg).locator('button.w-full.flex').first.click(); pg.wait_for_timeout(150)
    dialog(pg).locator('input[inputmode=decimal]').first.fill('100'); dialog(pg).get_by_role('button', name='Dodaj', exact=True).click(); pg.wait_for_timeout(150)
    dialog(pg).get_by_role('button', name='Dodaj 1 porc. do dziennika').click(); pg.wait_for_timeout(400)
    pg.get_by_text('E2E porcje (1 porc.)').first.click(); pg.wait_for_timeout(300)
    kcal = lambda: int(dialog(pg).get_by_text(re.compile(r'^\d+ kcal ·')).inner_text().split(' ')[0])
    k0 = kcal()
    for _ in range(4): dialog(pg).get_by_role('button', name='Więcej porcji').click()
    k1 = kcal()
    check(abs(k1 - 2 * k0) <= 1, f'2 porcje ≠ 2× kcal ({k0} → {k1})')
    dialog(pg).get_by_role('button', name='Zapisz porcje').click(); pg.wait_for_timeout(400)
    check(pg.get_by_text('E2E porcje (2 porc.)').count() > 0, 'wpis nie zmienił porcji')
    pg.reload(); pg.wait_for_timeout(800); tab(pg, 'Dieta')
    check(pg.get_by_text('E2E porcje (2 porc.)').count() > 0, 'zmiana porcji nie przetrwała odświeżenia')
    return {'kcal_1_porc': k0, 'kcal_2_porc': k1}

def meal_suggestions(pg, url):
    demo(pg, url); tab(pg, 'Dieta')
    eaten0 = int(re.search(r'^(\d+)', pg.locator('.num.text-4xl').first.inner_text()).group(1))
    pg.get_by_role('button', name='Co mam teraz zjeść?').click(); pg.wait_for_timeout(300)
    d = dialog(pg)
    check(d.get_by_text(re.compile('^Zostało:')).count() > 0, 'brak pozostałego bilansu')
    adds = d.get_by_role('button', name=re.compile('^Dodaj do:'))
    n = adds.count()
    check(2 <= n <= 3, f'liczba propozycji {n}, oczekiwano 2–3')
    first = d.locator('div.rounded-xl.border').first
    kcal = int(re.search(r'(\d+) kcal · B', first.inner_text()).group(1))
    title = first.locator('div.font-semibold').first.inner_text()
    shot(pg, 'meal-suggest.png')
    adds.first.click(); pg.wait_for_timeout(500)
    eaten1 = int(re.search(r'^(\d+)', pg.locator('.num.text-4xl').first.inner_text()).group(1))
    check(abs(eaten1 - eaten0 - kcal) <= 2, f'dziennik +{eaten1 - eaten0} kcal, propozycja {kcal} kcal')
    pg.reload(); pg.wait_for_timeout(800); tab(pg, 'Dieta')
    check(int(re.search(r'^(\d+)', pg.locator('.num.text-4xl').first.inner_text()).group(1)) == eaten1, 'wpis nie przetrwał odświeżenia')
    pg.get_by_role('button', name='Co mam teraz zjeść?').click(); pg.wait_for_timeout(300)
    check(dialog(pg).get_by_text(re.compile('^Zostało:')).count() > 0, 'arkusz nie otwiera się po dodaniu')
    return {'suggestions': n, 'first': title, 'kcal': kcal, 'eaten_before': eaten0, 'eaten_after': eaten1}

def library_recipes(pg, url):
    demo(pg, url); tab(pg, 'Dieta')
    eaten0 = int(re.search(r'^(\d+)', pg.locator('.num.text-4xl').first.inner_text()).group(1))
    pg.get_by_role('button', name='Przepisy').click(); pg.wait_for_timeout(200)
    check(dialog(pg).get_by_text('Gotowe przepisy').count() > 0, 'brak zakładki gotowych przepisów')
    dialog(pg).get_by_role('button', name='Obiad').click()
    dialog(pg).get_by_text('Kurczak z ryżem i brokułem').click(); pg.wait_for_timeout(300)
    check(dialog(pg).get_by_text('Ugotuj ryż.').count() > 0, 'brak kroków przygotowania')
    dialog(pg).get_by_role('button', name='Dodaj 1 porc. do dziennika').click(); pg.wait_for_timeout(400)
    eaten1 = int(re.search(r'^(\d+)', pg.locator('.num.text-4xl').first.inner_text()).group(1))
    check(395 <= eaten1 - eaten0 <= 415, f'porcja kurczaka z ryżem +{eaten1 - eaten0} kcal (oczekiwano ~405)')
    pg.get_by_role('button', name='Przepisy').click(); pg.wait_for_timeout(200)
    dialog(pg).get_by_role('button', name='Gotowe przepisy').click(); dialog(pg).get_by_text('Owsianka z jabłkiem').click(); pg.wait_for_timeout(200)
    dialog(pg).get_by_role('button', name='Zapisz u siebie').click(); pg.wait_for_timeout(300)
    check(dialog(pg).get_by_text('Owsianka z jabłkiem i masłem orzechowym').count() > 0, 'kopia nie trafiła do „Moje”')
    close_dialog(pg)
    pg.get_by_role('button', name='Co mam teraz zjeść?').click(); pg.wait_for_timeout(300)
    d = dialog(pg)
    first = d.locator('div.rounded-xl.border').first.locator('div.font-semibold').first.inner_text()
    d.get_by_role('button', name='Nie proponuj').first.click(); pg.wait_for_timeout(300)
    check(dialog(pg).locator('div.rounded-xl.border').first.locator('div.font-semibold').first.inner_text() != first, '„Nie proponuj” nie usunęło propozycji')
    check(dialog(pg).get_by_text(re.compile('Przywróć ukryte propozycje')).count() > 0, 'brak przywracania ukrytych')
    shot(pg, 'library-suggest.png')
    return {'portion_kcal': eaten1 - eaten0, 'hidden': first}

def onboarding_health_survey(pg, url):
    pg.goto(url); pg.get_by_role('button', name='Wpisz ręcznie').click(); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='Dalej').click(); pg.wait_for_timeout(300)
    check(pg.get_by_text('Zdrowie (dopasuje cele, przepisy i trening)').count() > 0, 'brak kroku ankiety zdrowotnej')
    cards = pg.locator('div.rounded-xl.bg-card2')
    for i in range(3): cards.nth(i).get_by_role('button', name='Tak').click()
    check(pg.get_by_text('zamienniki bez mleka').count() > 0, 'brak wyjaśnienia po wyborze')
    pg.get_by_role('button', name='Dalej').click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Nie').click(); pg.get_by_role('button', name='Zgadza się').click(); pg.get_by_role('button', name='Pomiń na teraz').click(); pg.wait_for_timeout(600)
    tab(pg, 'Zdrowie')
    toggles = pg.locator('[role=switch]')
    states = {pg.locator('[role=switch]').nth(i).inner_text()[:40]: pg.locator('[role=switch]').nth(i).get_attribute('aria-checked') for i in range(toggles.count())}
    dairy = [v for k, v in states.items() if 'nabiał' in k.lower()]
    knee = [v for k, v in states.items() if 'kolano' in k.lower()]
    check(dairy and dairy[0] == 'true', f'nabiał nie zapisany: {states}')
    check(knee and knee[0] == 'false', f'kolano nie oznaczone jako nieocenione: {states}')
    tab(pg, 'Dieta'); pg.get_by_role('button', name='Przepisy').click(); pg.wait_for_timeout(200)
    check(dialog(pg).get_by_text(re.compile('Dopasowany: Skyr')).count() > 0, 'przepis ze skyrem nie dostał zamiennika')
    return {'toggles': states}

def seed_progress(pg, machine_w=40, incline_w=20, pain=None):
    js = """async ([mw, iw, pain]) => {
  const r = indexedDB.open('my-body-os'); await new Promise(ok => r.onsuccess = ok); const db = r.result;
  const tx = db.transaction(['sessions', 'sets'], 'readwrite');
  const d = (n) => { const x = new Date(Date.now() - n * 864e5); return x.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' }); };
  [[7, 'p1'], [3, 'p2']].forEach(([n, id], k) => {
    tx.objectStore('sessions').put({ id, createdAt: k, updatedAt: k, date: d(n), templateId: 'A', status: 'completed', order: ['machine_press'], skipped: [], technique: {}, startedAt: k, finishedAt: k + 1 });
    [['machine_press', mw], ['incline_db_press', iw]].forEach(([ex, w]) => [0, 1, 2].forEach(i => tx.objectStore('sets').put(Object.assign({ id: id + ex + i, sessionId: id, exerciseId: ex, slot: ex, setIndex: i, weightKg: w, reps: 12, done: true, createdAt: k, updatedAt: k }, (pain !== null && id === 'p2') ? { pain } : {}))));
  });
  await new Promise(ok => tx.oncomplete = ok); db.close();
}"""
    pg.evaluate(js, [machine_w, incline_w, pain]); pg.reload(); pg.wait_for_timeout(900)

def start_today(pg):
    start = pg.get_by_role('button', name='Start')
    if start.count() == 0: start = pg.get_by_role('button', name=re.compile('Mimo to zacznij'))
    start.first.click(); pg.wait_for_timeout(500)
    return pg.locator('h2').first.inner_text()

def progression_big_jump(pg, url):
    # 20 kg maszyna (+2,5 = 12,5%) i 16 kg hantle (+2 = 12,5%): domyślnie bez zwiększenia
    demo(pg, url); seed_progress(pg, 20, 16); tab(pg, 'Trening')
    first = start_today(pg)
    old = '20' if first == 'Wyciskanie na maszynie' else '16'
    check(pg.get_by_role('button', name=re.compile('^Przyjmij')).count() == 0, 'skok > 10% zaproponowany jako domyślny')
    check(pg.get_by_text(re.compile('więcej niż zwykłe 2–10%')).count() > 0, 'brak wyjaśnienia dużego skoku')
    check(pg.get_by_label('kg').first.input_value() == old, 'ciężar zmienił się bez wyboru')
    alt = pg.get_by_role('button', name=re.compile('^Świadomie wybieram'))
    check(alt.count() == 1, 'brak świadomego wyboru większego ciężaru')
    alt.click(); pg.wait_for_timeout(400)
    check(pg.get_by_text(re.compile('Decyzja: mój ciężar')).count() > 0, 'świadomy wybór nie zapisany')
    check(pg.get_by_label('kg').first.input_value() != old, 'po świadomym wyborze ciężar w serii bez zmian')
    return {'exercise': first, 'from': old, 'chosen': pg.get_by_label('kg').first.input_value()}

def progression_pain(pg, url):
    demo(pg, url); seed_progress(pg, 40, 20, pain=5); tab(pg, 'Trening')
    first = start_today(pg)
    old = '40' if first == 'Wyciskanie na maszynie' else '20'
    check(pg.get_by_text(re.compile('Bez automatycznej zmiany ciężaru')).count() > 0, 'brak ostrzeżenia o bólu')
    check(pg.get_by_role('button', name=re.compile('^Przyjmij')).count() == 0, 'przy bólu proponowana zmiana ciężaru')
    check(pg.get_by_label('kg').first.input_value() == old, 'ciężar zmienił się automatycznie przy bólu')
    pg.get_by_role('button', name='Zamień ćwiczenie').nth(1).click(); pg.wait_for_timeout(300)
    check(dialog(pg).get_by_text('Zamień ćwiczenie').count() > 0, 'zamiana z ostrzeżenia nie otwiera listy')
    close_dialog(pg)
    pg.get_by_role('button', name='Pomiń ćwiczenie').click(); pg.wait_for_timeout(400)
    check(pg.locator('h2').first.inner_text() != first, 'pominięcie nie przeszło dalej')
    return {'exercise': first}

def progression_flow(pg, url):
    demo(pg, url); seed_progress(pg)
    tab(pg, 'Trening')
    row = pg.locator('button.w-full').filter(has_text='Wyciskanie na maszynie').first
    check('↑ 42,5 kg' in row.inner_text(), f'brak podglądu zwiększenia przed treningiem: {row.inner_text()}')
    start = pg.get_by_role('button', name='Start')
    if start.count() == 0: start = pg.get_by_role('button', name=re.compile('Mimo to zacznij'))
    start.first.click(); pg.wait_for_timeout(500)
    first = pg.locator('h2').first.inner_text()
    exp = {'Wyciskanie na maszynie': ('40', '42,5', '42.5'), 'Wyciskanie hantli na ławce skośnej': ('20', '22', '22')}
    check(first in exp, f'nieoczekiwane pierwsze ćwiczenie: {first}')
    w_old, w_new_pl, w_new = exp[first]
    check(pg.get_by_text(re.compile('Dwa treningi na górze zakresu')).count() > 0, 'brak uzasadnienia')
    # bez decyzji: seria podpowiada dotychczasowy ciężar
    w0 = pg.get_by_label('kg').first.input_value()
    check(w0 == w_old, f'bez zgody ciężar zmienił się sam: {w0}')
    shot(pg, 'progression.png')
    pg.get_by_role('button', name=f'Przyjmij {w_new_pl} kg').click(); pg.wait_for_timeout(400)
    check(pg.get_by_label('kg').first.input_value() == w_new, 'po akceptacji seria nie ma nowego ciężaru')
    pg.get_by_role('group', name=re.compile('Zapas powtórzeń')).first.get_by_role('button', name='2').click()
    pg.get_by_role('button', name='Seria zrobiona').first.click(); pg.wait_for_timeout(400)
    pg.reload(); pg.wait_for_timeout(1000)
    if pg.get_by_text('Wznów trening').count(): pg.get_by_text('Wznów trening').first.click(); pg.wait_for_timeout(400)
    check(pg.get_by_text(re.compile('Decyzja: przyjęta')).count() > 0, 'decyzja nie przetrwała odświeżenia')
    check(pg.get_by_text(re.compile('RIR|zapisana')).count() > 0, 'seria nie zapisana')
    old = pg.evaluate("""async () => { const r = indexedDB.open('my-body-os'); await new Promise(ok => r.onsuccess = ok); const db = r.result; const g = db.transaction('sets').objectStore('sets').getAll(); await new Promise(ok => g.onsuccess = ok); db.close(); return g.result.filter(s => s.sessionId === 'p1' || s.sessionId === 'p2').map(s => s.weightKg + 'x' + s.reps).join(','); }""")
    check(sorted(old.split(',')) == sorted(['40x12'] * 6 + ['20x12'] * 6), f'historyczne serie zmienione: {old}')
    return {'exercise': first, 'before': w0, 'accepted': w_new}

def progression_reject(pg, url):
    demo(pg, url); seed_progress(pg)
    tab(pg, 'Trening')
    start = pg.get_by_role('button', name='Start')
    if start.count() == 0: start = pg.get_by_role('button', name=re.compile('Mimo to zacznij'))
    start.first.click(); pg.wait_for_timeout(500)
    pg.get_by_role('button', name=re.compile('^Zostań przy (40|20) kg')).click(); pg.wait_for_timeout(300)
    check(pg.get_by_text(re.compile('Decyzja: zostaję przy ciężarze')).count() > 0, 'odrzucenie nie zapisane')
    pg.get_by_role('button', name='zmień').click(); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='Inny ciężar').click()
    pg.get_by_role('button', name='Zapisz').first.click(); pg.wait_for_timeout(300)
    check(pg.get_by_text(re.compile('Decyzja: mój ciężar')).count() > 0, 'ręczna zmiana nie zapisana')
    return {'ok': True}

def training_availability(pg, url):
    demo(pg, url); tab(pg, 'Trening')
    body = pg.locator('body').inner_text()
    check('♥' not in body and 'córk' not in body.lower(), 'ekran treningu nadal zależy od opieki nad dzieckiem')
    check(pg.get_by_text(re.compile('cel 3/tydz')).count() > 0, 'brak domyślnego celu 3/tydz.')
    if pg.get_by_role('button', name='Przełóż').count():
        pg.get_by_role('button', name='Przełóż').click(); pg.wait_for_timeout(400)
        check(pg.get_by_text('Dziś oznaczone jako niedostępne.').count() > 0, 'przełożenie nie zadziałało')
        check(pg.get_by_text(re.compile('^Następny:')).count() > 0, 'brak kolejnego terminu po przełożeniu')
    strip = pg.locator('button[aria-label*="trening"]').first
    lbl = strip.get_attribute('aria-label')
    strip.click(); pg.wait_for_timeout(300)
    check(pg.locator(f'button[aria-label="{lbl.split(":")[0]}: niedostępny"]').count() == 1, f'dzień nie oznaczony jako niedostępny: {lbl}')
    pg.get_by_role('button', name=re.compile('^Dostępność:')).click(); pg.wait_for_timeout(200)
    dialog(pg).get_by_role('button', name='Mniej').click()
    dialog(pg).get_by_role('button', name='Zapisz').click(); pg.wait_for_timeout(300)
    check(pg.get_by_text(re.compile('cel 2/tydz')).count() > 0, 'zmiana celu tygodniowego nie zapisana')
    pg.reload(); pg.wait_for_timeout(900); tab(pg, 'Trening')
    check(pg.get_by_text(re.compile('cel 2/tydz')).count() > 0, 'cel nie przetrwał odświeżenia')
    return {'toggled': lbl}

ALL = [exercise_card_and_swap, backup_roundtrip, recipe_flow, workout_plan_flow, coach_feedback, food_search, storage_diagnostics, morning_backup_reminder, recipe_portions_in_diary, meal_suggestions, library_recipes, onboarding_health_survey, progression_flow, progression_reject, training_availability, progression_big_jump, progression_pain]
