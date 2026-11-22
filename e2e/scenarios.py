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

ALL = [exercise_card_and_swap, backup_roundtrip, recipe_flow, workout_plan_flow, coach_feedback, food_search, storage_diagnostics, morning_backup_reminder, recipe_portions_in_diary, meal_suggestions]
