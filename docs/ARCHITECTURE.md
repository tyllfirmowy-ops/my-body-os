# Architektura

- `src/domain/` czyste funkcje: `dates` (Europe/Warsaw, DST, sen przez północ), `calc`, `nutrition`, `schedule` (2-2-3, planowanie bez kumulacji), `safety`, `readiness` (A/B/C), `progression` (podwójna), `adaptation` (silnik redukcji), `coaching` (reguły + wzorce), `report` (tydzień, kontekst AI).
- `src/db/` Dexie (schemat v1), `backup.ts` (eksport/import z walidacją Zod, szyfrowanie AES-GCM/PBKDF2), `repo.ts` (ładowanie + `derive()` = cały stan pochodny dnia).
- `src/screens/` UI; `liveQuery` odświeża widoki po każdym zapisie. Autosave przy każdej akcji; sesja treningu żyje w DB (status `in_progress`), szkice serii i timer w localStorage.
- Decyzje: brak biblioteki wykresów (własne SVG, mniej zależności); brak routera (5 zakładek); Playwright użyty spoza projektu (headless Chrome) zamiast zależności dev.
- Ograniczenia iOS: push w PWA tylko po instalacji na ekranie głównym i z serwerem (VAPID): poza MVP. HealthKit niedostępny z web; w przyszłości natywny wrapper lub import pliku.

v0.5 (ETAP 2):
- `domain/rig.ts` czysty silnik szkieletu 2D: `fk(key)` buduje pozę od biodra i kąta tułowia; kończyny przez `ik2` (2 kości, znak zgięcia) albo kąty bezwzględne; `lerpKey` interpoluje pozycje liniowo, kąty najkrótszą drogą; `sampleAt` zwraca pozę, fazę i oddech dla czasu. Długości kości stałe (`BONES`), więc segmenty nie rozciągają się między klatkami.
- `data/rigs.ts` dane ćwiczeń (klatki, oś czasu, rekwizyty, mięśnie, błędy, kąty, flaga `reference`). `ui/RigView.tsx` tylko rysuje i steruje odtwarzaniem; nie liczy biomechaniki.
- `domain/workout.ts` zamiana ćwiczeń: `swapOptions` (grupa, sprzęt, duplikaty, blokady kolana: urgent, stop_legs, caution_legs, brak oceny kolana), `swapExercise` (niemutujące, cofnięcie usuwa wpis), `setsForSlot`, `lastSetsFor` (progresja po faktycznym ćwiczeniu).

v0.6 Kopie zapasowe (`db/backup.ts`):
- Eksport → weryfikacja → zapis przez Web Share (iOS: „Zapisz w Plikach”, iCloud Drive) lub pobranie → ręczne potwierdzenie. PWA nie może sama zapisywać plików w tle ani sprawdzić, czy plik trafił do iCloud, dlatego nie ma automatycznych kopii i aplikacja nie twierdzi, że kopia jest zapisana, dopóki użytkownik tego nie potwierdzi.
- Arkusz udostępniania jest wywoływany osobnym dotknięciem po przygotowaniu pliku, bo Safari wymaga gestu użytkownika, a szyfrowanie (PBKDF2 250k) trwa dłużej niż okno gestu.
- IndexedDB na iOS: dane są w kontenerze przeglądarki lub aplikacji z ekranu głównego (osobne magazyny). Safari może usuwać dane stron nieużywanych przez 7 dni (dotyczy stron w przeglądarce, aplikacji z ekranu głównego zwykle nie). Przy braku miejsca system może wyczyścić dane nieoznaczone jako trwałe, a zapis zgłasza QuotaExceededError. Dlatego: prośba o `persist()`, pokazanie zajętości i przypomnienie o potwierdzonej kopii. Wynik `persist()` na iPhonie wymaga sprawdzenia na urządzeniu.

v0.6 Przepisy i szablony: `domain/recipes.ts` (czyste funkcje, testy w tests/stage3b.test.ts); UI w `screens/Recipes.tsx` (RecipesSheet, RecipeEditor, TemplateEditor). Szablony efektywne = domyślne z `data/foods.ts` nadpisane rekordami z `mealTemplates`. Dopasowanie do celu dnia nadal przez `fitDayToTargets` (bez zmian logiki ETAPU 1).

v0.6 Plany treningowe: `domain/workoutEdit.ts` + `screens/WorkoutEditor.tsx`. Harmonogram nadal planuje tylko sloty A/B (`domain/schedule.ts` bez zmian), treść slotu pochodzi z aktywnego wariantu. Sesja trzyma snapshot planu.
