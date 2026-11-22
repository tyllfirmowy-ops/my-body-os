# Stan projektu (2026-11-22)

Wersja 0.6.0: ETAP 3 zakończony (3A–3F). Hosting: https://statuesque-sorbet-8dafde.netlify.app (Netlify, auto-deploy z GitHub main). Zainstalowana na iPhonie jako aplikacja z ekranu głównego.

Weryfikacja: 195 testów Vitest, typecheck czysty, build OK, E2E `npm run e2e` 6/6 PASS (karta i zamiana ćwiczenia, kopia zapasowa, przepisy i szablony, warianty planu, feedback coacha, wyszukiwanie i offline). Pomiary `npm run perf` (Chrome, widok iPhone): start 0,2 s (CPU 1×) / 0,6–0,8 s (4×), zakładki 26–75 ms, wyszukiwarka ~30 ms na znak, animacja 60 fps.
Baza: Dexie v4. Kopie starsze (v1, schemat 1–3) wczytują się; tabele nieobecne w kopii nie są czyszczone.

Ograniczenia: animacje 2D z boku (3 wzorce referencyjne sprawdzone z opisami techniki, 10 schematycznych, alternatywy bez animacji); PWA nie robi kopii w tle i nie wie, czy plik trafił do iCloud (stąd ręczne potwierdzenie); wyniki OFF to dane społeczności (walidacja wychwytuje tylko niespójności).
Do sprawdzenia na iPhonie: arkusz „Zapisz w Plikach”, wynik `persist()`, animacja i suwak, edytory na małym ekranie, skaner, Skrót iOS.
Następne: decyzja o ETAPIE 4 (patrz ROADMAP.md).
