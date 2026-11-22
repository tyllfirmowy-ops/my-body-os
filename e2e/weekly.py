"""Raport tygodnia i drugi użytkownik (np. brat) na czystym telefonie. Fikcyjne dane."""
import datetime, re
from common import demo, tab, dialog
from scenarios import check
from audit import restart, store

TZ = datetime.timezone(datetime.timedelta(hours=1))
T = lambda d, h, m=0: datetime.datetime(*map(int, d.split('-')), h, m, tzinfo=TZ)

def set_health(pg, **kw):
    pg.evaluate("""async (kw) => { const r = indexedDB.open('my-body-os'); await new Promise(ok => r.onsuccess = ok); const db = r.result;
      const tx = db.transaction('health', 'readwrite'); const st = tx.objectStore('health'); const g = st.get('me'); await new Promise(ok => g.onsuccess = ok);
      st.put(Object.assign(g.result, kw)); await new Promise(ok => tx.oncomplete = ok); db.close(); }""", kw); pg.reload(); pg.wait_for_timeout(900)

def weekly_report(pg, url, ctx):
    pg.clock.install(time=T('2026-11-22', 20, 30))
    demo(pg, url); set_health(pg, kneeCleared=False, kneeNote='kolano (test)')
    card = pg.get_by_text('Raport tygodnia', exact=True)
    check(card.count() == 1, 'w niedzielę po 20:00 brak karty raportu na ekranie Dzisiaj')
    pg.get_by_role('button', name='Wypełnij').click(); pg.wait_for_timeout(300)
    d = dialog(pg)
    check(d.get_by_text('To aplikacja już wie').count() == 1, 'brak danych zebranych automatycznie')
    check(d.get_by_role('button', name='Zapisz raport').count() == 0, 'zapis możliwy bez odpowiedzi')
    d.get_by_role('button', name='słabo').click()
    d.get_by_role('button', name='Ciężko').click(); d.get_by_role('button', name='Tak', exact=True).click()
    check(d.get_by_text('Kolano w tym tygodniu').count() == 1, 'brak pytania o kolano u osoby z problemem kolana')
    d.get_by_role('button', name='Wyraźnie').click()
    d.get_by_role('button', name='Prostsze posiłki').click()
    d.locator('textarea').fill('dużo pracy')
    d.get_by_role('button', name='Zapisz raport').click(); pg.wait_for_timeout(400)
    txt = d.inner_text()
    for k in ['nie zaproponuje obniżki kalorii', 'Lżejszy tydzień', 'Kolano wyraźnie bolało']: check(k in txt, f'brak skutku: {k}')
    d.get_by_role('button', name=re.compile('^Ustaw 2 treningi')).click(); pg.wait_for_timeout(300)
    check(d.get_by_role('button', name=re.compile('Przypomnienie w kalendarzu')).count() == 1, 'brak przypomnienia w kalendarzu')
    d.get_by_role('button', name='Gotowe').click(); pg.wait_for_timeout(300)
    check(pg.get_by_text('Raport tygodnia', exact=True).count() == 0, 'karta nie znika po wypełnieniu')
    pg = restart(ctx, pg, url, at=T('2026-11-23', 13))
    check(pg.get_by_text('Raport tygodnia', exact=True).count() == 0, 'wypełniony raport wraca po restarcie')
    rec = store(pg, 'weeklyCheckins')
    check(len(rec) == 1 and rec[0]['id'] == '2026-11-16' and rec[0]['knee'] == 'clear' and rec[0]['note'] == 'dużo pracy', f'zapis: {rec}')
    tab(pg, 'Trening')
    check(pg.get_by_text(re.compile('cel 2/tydz')).count() == 1, 'lżejszy tydzień nie zmienił celu')
    tab(pg, 'Postępy')
    check(pg.get_by_text(re.compile('Lżejszy tydzień')).count() >= 1, 'Postępy nie pokazują skutków raportu')
    return {'saved': rec[0]['id']}

def weekly_snooze(pg, url, ctx):
    pg.clock.install(time=T('2026-11-22', 20, 30))
    demo(pg, url)
    pg.get_by_role('button', name='Jutro').click(); pg.wait_for_timeout(300)
    check(pg.get_by_text('Raport tygodnia', exact=True).count() == 0, 'odłożenie nie chowa karty')
    pg = restart(ctx, pg, url, at=T('2026-11-23', 11))
    check(pg.get_by_text('Raport tygodnia', exact=True).count() == 0, 'w poniedziałek przed 12:00 karta nie powinna się pokazać')
    pg = restart(ctx, pg, url, at=T('2026-11-23', 12, 15))
    check(pg.get_by_text('Raport tygodnia', exact=True).count() == 1, 'w poniedziałek po 12:00 brak przypomnienia')
    pg.get_by_role('button', name='Jutro').click(); pg.wait_for_timeout(300)
    pg = restart(ctx, pg, url, at=T('2026-11-24', 12, 5))
    check(pg.get_by_text('Raport tygodnia', exact=True).count() == 1, 'brak przypomnienia następnego dnia')
    return {'ok': True}

def second_user_clean(pg, url, ctx):
    """Brat otwiera ten sam adres na swoim telefonie: czysta aplikacja, bez kalendarza opieki i bez pytania o kolano."""
    pg.clock.install(time=T('2026-11-22', 20, 30))
    pg.goto(url); pg.get_by_role('button', name='Wpisz ręcznie').click(); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='Dalej').click(); pg.wait_for_timeout(300)
    cards = pg.locator('div.rounded-xl.bg-card2')
    for i in range(3):
        b = cards.nth(i).get_by_role('button', name='Nie')
        if b.count(): b.click()
    pg.get_by_role('button', name='Dalej').click(); pg.wait_for_timeout(300)
    check(pg.get_by_role('button', name='Nie dotyczy mnie').count() == 1, 'kalendarz opieki jest obowiązkowy')
    pg.get_by_role('button', name='Nie dotyczy mnie').click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='Pomiń na teraz').click(); pg.wait_for_timeout(700)
    check(pg.locator('nav[aria-label="Nawigacja"]').is_visible(), 'nowy użytkownik nie wszedł do aplikacji')
    pg = restart(ctx, pg, url, at=T('2026-11-22', 20, 40))
    body = pg.locator('body').inner_text()
    check('dzieck' not in body.lower() and 'córk' not in body.lower(), 'nowy użytkownik widzi elementy opieki nad dzieckiem')
    check(store(pg, 'sessions') == [] and store(pg, 'weeklyCheckins') == [], 'nowy użytkownik ma cudze dane')
    plan = store(pg, 'plans')[0]
    # domyślny formularz: 180 cm, 100 kg, 30 lat, mężczyzna → białko 1,8 g/kg × 81 kg (BMI 25) = 145 g; kalorie z jego TDEE, nie stałe 2100
    check(plan['proteinG'] == 145 and 1800 <= plan['kcal'] <= 2600 and plan['kcal'] != 2100, f'plan nowego użytkownika: {plan["kcal"]} kcal, B {plan["proteinG"]}')
    pg.get_by_role('button', name='Wypełnij').click(); pg.wait_for_timeout(300)
    check(dialog(pg).get_by_text('Kolano w tym tygodniu').count() == 0, 'pytanie o kolano u osoby bez problemu z kolanem')
    return {'custody': 'pominięty', 'kneeQuestion': False, 'plan': f"{plan['kcal']} kcal, B {plan['proteinG']} g, T {plan['fatG']} g, W {plan['carbsG']} g"}

ALL = [weekly_report, weekly_snooze, second_user_clean]
