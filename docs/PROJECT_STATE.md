# Stan projektu (2026-11-22)

Wersja produkcyjna: 0.8.0 (main, https://statuesque-sorbet-8dafde.netlify.app, Netlify auto-deploy z main). Zainstalowana na iPhonie jako aplikacja z ekranu głównego.

W toku: przebudowa 1.0 „Everyday experience” etapami W1–W6 (plan: docs/ROADMAP.md, audyt: docs/UX_REDESIGN_AUDIT.md).
- W1 (fundament UX) gotowe na gałęzi `feat/1.0-w1-ux` jako 0.9.0, **nie scalone**: 4 zakładki + profil w górnym rogu, nowy ekran Dzisiaj z NextBestAction, szybkie dodanie jedzenia z Cofnij, profil w sekcjach, poprawka `kcalFloor` i domyślnej oceny kolana.
- Następne: W2 (dieta bez tarcia: parser „banan 120g”, ostatnie/częste, „Więcej możliwości”).

Weryfikacja 0.9.0 (gałąź): 316 testów Vitest, typecheck czysty, build OK, E2E `npm run e2e` 33/33 PASS (scenarios.py, audit.py, weekly.py, ux1.py). `npm run perf` (Chrome, widok iPhone, CPU 4×): pierwszy ekran 0,8–0,9 s (main na tej samej maszynie 0,6–0,8 s, w granicach rozrzutu), zakładki 22–54 ms, otwarcie „Dodaj jedzenie” 37 ms, wyszukiwarka ~29 ms na znak, animacja 60 fps.
Baza: Dexie v5, bez zmian w W1. Kopie starsze wczytują się; tabele nieobecne w kopii nie są czyszczone.

Ograniczenia: animacje 2D z boku; PWA nie robi kopii w tle i nie wie, czy plik trafił do iCloud; wyniki OFF to dane społeczności; dwa źródła liczby treningów (`plan.workoutsPer14d` dla cyklu kalorii i `settings.trainingsPerWeek` dla planera) do ujednolicenia w W5.
Do sprawdzenia na iPhonie: docs/IPHONE_TEST_CHECKLIST.md (sekcje 8e i 10 niewykonane).
