# Stan projektu (2026-11-22)

Wersja 0.6.1 (diagnostyka pamięci, przypomnienie o kopii w check-inie, porcje przepisu w dzienniku). ETAP 3 zakończony (3A–3F). Hosting: https://statuesque-sorbet-8dafde.netlify.app (Netlify, auto-deploy z GitHub main). Zainstalowana na iPhonie jako aplikacja z ekranu głównego.

Weryfikacja: 209 testów Vitest, typecheck czysty, build OK, E2E `npm run e2e` 9/9 PASS (karta i zamiana ćwiczenia, kopia zapasowa, przepisy i szablony, warianty planu, feedback coacha, wyszukiwanie i offline, diagnostyka pamięci, przypomnienie o kopii, porcje w dzienniku). Pomiary `npm run perf` (Chrome, widok iPhone): start 0,2 s (CPU 1×) / 0,6–0,8 s (4×), zakładki 26–75 ms, wyszukiwarka ~30 ms na znak, animacja 60 fps.
Baza: Dexie v4. Kopie starsze (v1, schemat 1–3) wczytują się; tabele nieobecne w kopii nie są czyszczone.

Ograniczenia: animacje 2D z boku (3 wzorce referencyjne sprawdzone z opisami techniki, 10 schematycznych, alternatywy bez animacji); PWA nie robi kopii w tle i nie wie, czy plik trafił do iCloud (stąd ręczne potwierdzenie); wyniki OFF to dane społeczności (walidacja wychwytuje tylko niespójności).
Do sprawdzenia na iPhonie: docs/IPHONE_TEST_CHECKLIST.md (wszystkie punkty NIEWYKONANE).
Wersja 0.7.1: Adaptive Coach W1 „Co mam teraz zjeść?” + 25 gotowych przepisów + ankieta zdrowotna przy zakładaniu konta; EVIDENCE.md ze zweryfikowanymi źródłami. W2–W5 do zrobienia po testach na iPhonie (audyt: docs/ADAPTIVE_COACH_AUDIT.md).

Gałąź `feat/w2-progression` (niescalona): W2 progres siłowy + planer tygodniowy; audyt przed scaleniem zrobiony 2026-11-22 (poprawki: ból w trakcie ćwiczenia, szkice bólu/zapasu, seria 2 przejmuje ciężar, arkusze przez portal, jednostki lb w uzasadnieniach, siatka skoków). Potem decyzja: prosty trening w trybie skupienia (rozgrzewka → ćwiczenia → rozciąganie, bez decyzji o ciężarze), progresja tylko w karcie „Ten tydzień”. E2E: 14 scenariuszy + 11 w e2e/audit.py. Nie potwierdzone na fizycznym iPhonie: docs/IPHONE_TEST_CHECKLIST.md, sekcja 8e.
Następne: decyzja o ETAPIE 4 (patrz ROADMAP.md).
