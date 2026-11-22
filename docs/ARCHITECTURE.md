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
