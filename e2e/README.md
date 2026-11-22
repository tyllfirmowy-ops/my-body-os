# Testy E2E i pomiary

Wymagania: Python 3 z pakietem `playwright` (`pip install playwright`) i Chrome/Chromium (zmienna `CHROME` albo `python -m playwright install chromium`). Bez zależności npm.

- `npm run e2e` buduje wersję jednoplikową i uruchamia scenariusze z `scenarios.py` (profil demo, fikcyjne dane, widok iPhone'a 390×844). Wynik: JSON + `N/M PASS`, kod wyjścia 1 przy błędzie. Pojedynczy scenariusz: `python3 e2e/run.py recipe_flow`.
- `npm run perf` mierzy build produkcyjny: pierwszy ekran, ponowne uruchomienie, przejścia zakładek, czas reakcji wyszukiwarki na znak, płynność animacji (rAF). Argument = spowolnienie CPU (domyślnie 4×).

Scenariusze: karta ćwiczenia i zamiana w trakcie treningu, kopia zapasowa (przygotuj → pobierz → potwierdź → import), przepis → dziennik → edycja bez zmiany historii → szablon → lista zakupów, wariant planu treningowego, feedback coacha, wyszukiwanie lokalne i tryb offline OFF.
Zrzuty ekranu: `/tmp/mybodyos-e2e` (zmienna `E2E_SHOTS`).
