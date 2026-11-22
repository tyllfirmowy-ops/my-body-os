"""1.0 W1: nawigacja, ekran Dzisiaj, szybkie dodanie jedzenia z cofnięciem, priorytet alertów (fikcyjne dane, stały czas)."""
import datetime, re
from common import demo, tab, dialog
from scenarios import check

TZ = datetime.timezone(datetime.timedelta(hours=1))
T = lambda d, h, m=0: datetime.datetime.fromisoformat(d).replace(hour=h, minute=m, tzinfo=TZ)

def put(pg, table, rec):
    pg.evaluate("""async ([t, rec]) => { const r = indexedDB.open('my-body-os'); await new Promise(ok => r.onsuccess = ok); const db = r.result;
      const tx = db.transaction(t, 'readwrite'); tx.objectStore(t).put(rec); await new Promise(ok => tx.oncomplete = ok); db.close(); }""", [table, rec])
    pg.reload(); pg.wait_for_timeout(900)

def count(pg, table):
    return pg.evaluate("""async (t) => { const r = indexedDB.open('my-body-os'); await new Promise(ok => r.onsuccess = ok); const db = r.result;
      const q = db.transaction(t).objectStore(t).count(); await new Promise(ok => q.onsuccess = ok); db.close(); return q.result; }""", table)

def nav_and_profile(pg, url):
    pg.clock.install(time=T('2026-11-25', 13)); demo(pg, url)
    labels = [b.inner_text().strip() for b in pg.locator('nav button').all()]
    check(labels == ['Dzisiaj', 'Jedzenie', 'Trening', 'Postępy'], f'nawigacja: {labels}')
    body = pg.locator('main').inner_text()
    for bad in ['Plan A', 'TDEE', 'FBW', 'Brak danych:']: check(bad not in body, f'na Dzisiaj widać techniczne „{bad}”')
    tab(pg, 'Trening'); pg.get_by_role('button', name='Profil i ustawienia').click(); pg.wait_for_timeout(300)
    secs = [s.get_attribute('aria-label') for s in pg.locator('main section').all()]
    want = ['Moje dane', 'Cel i plan', 'Zdrowie', 'Aktywność i integracje', 'Ustawienia treningów', 'Ustawienia żywienia', 'Kopie bezpieczeństwa i eksport', 'Pomoc', 'Ustawienia zaawansowane']
    check(secs == want, f'sekcje profilu: {secs}')
    check(pg.locator('nav button[aria-current=page]').count() == 0, 'zakładka zaznaczona w profilu')
    pg.get_by_role('button', name='Wróć').click(); pg.wait_for_timeout(300)
    check(pg.locator('nav button[aria-current=page]').inner_text().strip() == 'Trening', 'Wróć nie wraca do poprzedniej zakładki')
    tab(pg, 'Jedzenie')
    check(pg.get_by_role('button', name='Ustawienia planu').count() == 0, 'ustawienia planu zdublowane w Jedzeniu')
    return {'nav': labels}

def quick_add_undo(pg, url):
    pg.clock.install(time=T('2026-11-25', 12, 30)); demo(pg, url)
    taps = 0
    pg.get_by_role('button', name='Dodaj jedzenie').first.click(); taps += 1; pg.wait_for_timeout(300)
    inp = pg.get_by_placeholder('Szukaj w bazie (np. kurczak, ryż)…')
    check(inp.evaluate('e => e === document.activeElement'), 'pole wyszukiwania bez fokusu')
    inp.fill('banan'); pg.wait_for_timeout(150)
    dialog(pg).locator('button.w-full.flex').first.click(); taps += 1; pg.wait_for_timeout(200)
    check(dialog(pg).get_by_role('radio', name='Posiłek 2').get_attribute('aria-checked') == 'true', 'domyślny posiłek o 12:30 to nie Posiłek 2')
    dialog(pg).locator('input[inputmode=decimal]').first.fill('120')
    dialog(pg).get_by_role('button', name='Dodaj', exact=True).click(); taps += 1; pg.wait_for_timeout(400)
    check(pg.locator('[role=dialog]').count() == 0, 'arkusz nie zamknął się po dodaniu')
    check(pg.get_by_text('Zostało w planie').count() == 1, 'bilans nie pokazuje pozostałych kcal')
    check(count(pg, 'entries') == 1, 'wpis nie zapisany')
    pg.get_by_role('button', name='Cofnij').click(); pg.wait_for_timeout(400)
    check(count(pg, 'entries') == 0, 'Cofnij nie usunął wpisu')
    check(pg.get_by_text('Nie zapisano jeszcze jedzenia.').count() == 1, 'po cofnięciu bilans nie wrócił')
    tab(pg, 'Jedzenie'); pg.get_by_role('button', name='Dodaj').first.click(); pg.wait_for_timeout(200)
    check(dialog(pg).get_by_role('radiogroup', name='Posiłek').count() == 0, 'w dzienniku posiłek wybrany wcześniej, bez dodatkowego wyboru')
    return {'taps_without_typing': taps}

def urgent_beats_suggestions(pg, url):
    pg.clock.install(time=T('2026-11-25', 14)); demo(pg, url)
    check(pg.get_by_text('Na dziś', exact=True).count() == 1, 'bez alertu brak sugestii (test nic by nie sprawdzał)')
    put(pg, 'morning', {'date': '2026-11-25', 'symptoms': ['chest_pain'], 'createdAt': 1, 'updatedAt': 1})
    check(pg.locator('[role=alert]').count() >= 1, 'brak alertu pilnego')
    check(pg.get_by_role('link', name='Zadzwoń 112').count() == 1, 'brak przycisku 112')
    check(pg.get_by_text('Na dziś', exact=True).count() == 0, 'zwykła sugestia obok alertu pilnego')
    return {'ok': True}

def knee_block_today(pg, url):
    pg.clock.install(time=T('2026-11-25', 14)); demo(pg, url)
    put(pg, 'morning', {'date': '2026-11-25', 'symptoms': ['knee_swelling'], 'createdAt': 1, 'updatedAt': 1})
    txt = pg.locator('main').inner_text()
    check('zablokowane' in txt, 'blokada kolana nie jest główną sugestią')
    check(pg.get_by_role('button', name='Nie teraz').count() == 0, 'blokadę bezpieczeństwa można odłożyć')
    check(pg.get_by_role('button', name='Rozpocznij').count() == 0, 'zwykłe „Rozpocznij” mimo blokady')
    return {'ok': True}

def return_after_break(pg, url):
    pg.clock.install(time=T('2026-11-20', 10)); demo(pg, url)
    put(pg, 'morning', {'date': '2026-11-20', 'weightKg': 95, 'symptoms': [], 'createdAt': 1, 'updatedAt': 1})
    pg.clock.set_system_time(T('2026-11-27', 10)); pg.reload(); pg.wait_for_timeout(900)
    check(pg.get_by_text('Dobrze, że jesteś').count() == 1, 'brak powitania po przerwie')
    pg.get_by_role('button', name='Wracam').click(); pg.wait_for_timeout(400)
    check(pg.get_by_text('Dobrze, że jesteś').count() == 0, 'karta powrotu nie znika po „Wracam”')
    check(pg.get_by_role('button', name='Dodaj jedzenie').count() >= 1, 'po przerwie brak dodawania jedzenia')
    check(count(pg, 'morning') == 1, 'historia zmieniona po powrocie')
    return {'ok': True}

ALL = [nav_and_profile, quick_add_undo, urgent_beats_suggestions, knee_block_today, return_after_break]
