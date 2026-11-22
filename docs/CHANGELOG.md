# Changelog
## Niewydane — gałąź feat/w2-progression (W2: progres siłowy + nowa dostępność treningowa)
### Planowanie treningów (korekta założeń)
- Planer tygodniowy `planWeekly` (domain/schedule.ts): cel domyślnie 3 FBW/tydz. (pon–nd, wliczając wykonane), min. 2 dni odstępu, rotacja A/B, dni niedostępne pomijane, pominięte treningi się nie kumulują. Nie korzysta z kalendarza opieki.
- Dzień przejścia `Settings.scheduleV2From` (zapisywany przy pierwszym uruchomieniu nowej wersji): dni wcześniejsze liczone dawnym planerem, więc historyczne cele kcal dnia treningowego / bez treningu i bilanse się nie zmieniają; od tego dnia obowiązuje planer tygodniowy. Cele żywieniowe nie zależą od dni opieki.
- Trening: „Przełóż” dla dzisiejszego treningu, stuknięcie dnia w pasku 14 dni oznacza go jako niedostępny (plan sam się przesuwa), „Dostępność” (2–4 treningi/tydz., preferowane okno, domyślnie 9:00–15:00, informacyjnie), licznik „ten tydzień: x/3”. Bez oznaczeń dni opieki i blokady startu w te dni.
- Coaching: opuszczony zaplanowany trening liczy się niezależnie od opieki; porada „przełóż / 2 treningi to też dobry wynik”; bez nadrabiania.
- W2: przy ćwiczeniach obciążających kolano bez oceny specjalisty zwiększenie tylko, gdy ból był zaznaczony (brak wpisu ≠ bezpiecznie); propozycja startowa do zatwierdzenia jednym dotknięciem.
- EVIDENCE.md: ACSM 2026 (PMID 41843416), WHO 2021, Bruggisser 2023 (pora treningu), heurystyki planowania.
- Testy: tests/w2b.test.ts (12), E2E `training_availability`.

### Audyt W2 przed scaleniem
- Ból ≥ 4/10 wpisany w trakcie ćwiczenia: trwałe ostrzeżenie z „Pomiń ćwiczenie” / „Zamień ćwiczenie” na karcie ćwiczenia (wcześniej tylko znikający toast). Przetrwa restart.
- Ból i zapas w niezapisanej serii trafiają do szkicu (przetrwają restart, zmianę ćwiczenia); w zapisanej serii zapisują się od razu, bez „Popraw serię”.
- Seria 2 przejmuje ciężar z serii 1, dopóki nie była ruszana (wcześniej przy pierwszym treningu zostawało 0).
- Arkusze (`Sheet`) renderowane przez portal: „Instrukcja” otwarta w trakcie przerwy nie jest już przycięta do karty ani zasłonięta licznikiem przerwy.
- Jednostki: uzasadnienia progresji, „Ostatnio” i wyniki w karcie ćwiczenia w wybranej jednostce (lb nie pokazuje już kg).
- Skok liczony do najbliższego punktu siatki powyżej obecnego ciężaru, procent z faktycznego skoku (ciężar spoza siatki, np. po zmianie jednostki, nie daje skoku > 1 kroku ani zaniżonego procentu).
- Domyślne powtórzenia: przy progresji powtórzeniami po dużym skoku do repMax + 3; po świadomym wyborze innego ciężaru od dolnej granicy zakresu.
- Testy: tests/w2audit.test.ts (9), E2E e2e/audit.py: scenariusze A–I z ponownym uruchomieniem aplikacji.

### Przegląd przed scaleniem
- Ból ≥ 4/10 w ostatnim treningu: nowa akcja `pain`: bez automatycznej zmiany ciężaru (wcześniej −10%), ostrzeżenie i przyciski „Pomiń ćwiczenie” / „Zamień ćwiczenie” (istniejące funkcje). Blokady kolana bez zmian, nadal pierwsze.
- Skok > 10% (np. 16 → 18 kg): domyślnie ten sam ciężar i powtórzenia do repMax + 3 (maks. 20); `Suggestion.alternativeKg` + przycisk „Świadomie wybieram X”; zwiększenie domyślne dopiero po 2 treningach na górnej granicy. Procent skoku liczony ze skoku, nie z zaokrąglonej wartości (naprawia fałszywe „>10%” przy lb).
- Testy: 5 nowych jednostkowych, E2E `progression_big_jump`, `progression_pain`; 4 starsze testy dostosowane (skoki ≤ 10%, ból bez −10%).

### Progres siłowy
- `suggestProgression` (domain/progression.ts) zastępuje logikę `suggestNext` (zostaje jako nakładka zgodności): podwójna progresja z historią 3 ostatnich treningów danego ćwiczenia. Kolejność: blokada bezpieczeństwa → kolano bez oceny (bez obciążenia) → brak historii → ból ≥ 4 (−10%) → przerwa (14/28/56 dni) → ból 3 / słabsza technika (bez zwiększania) → spadek wydolności (2× poniżej zakresu: −10%; −20% powtórzeń: bez zwiększania) → górny zakres (zwiększenie tylko po 2 treningach albo z RIR ≥ 2 w każdej serii; RIR 0 blokuje; plan B lub ból kolana ≥ 3 w check-inie blokują) → inaczej „dołóż powtórzenie” / „zrób wszystkie serie”.
- Zmiana zachowania: ocena techniki nie jest już wymagana do zwiększenia (blokuje tylko „słabsza”), RIR opcjonalny; zamiast tego wymagane 2 kolejne treningi na górze zakresu. Testy w tests/domain.test.ts zaktualizowane świadomie.
- Skoki obciążenia i jednostki: najmniejszy skok z ustawień (hantle/maszyna/wyciąg/sztanga) albo z karty ćwiczenia; kg lub lb (serie zawsze zapisywane w kg); ostrzeżenie przy skoku > 10%; obniżki w dół do siatki skoku. Trening → „Jednostki i skoki obciążenia”.
- Decyzja użytkownika: przy propozycji zmiany ciężaru „Przyjmij X” / „Zostań przy Y” / „Inny ciężar”; bez decyzji serie podpowiadają dotychczasowy ciężar. Decyzja z uzasadnieniem zapisana w `WorkoutSession.progress[exerciseId]`; serie historyczne bez zmian; „zmień” cofa decyzję.
- Szybki RIR: przyciski „Zapas: 0 1 2 3 4+” przy każdej serii (opcjonalnie, jedno dotknięcie); ból pod „ból?”.
- Podgląd przed treningiem: przy ćwiczeniach w planie A/B znacznik ↑ / ↓ / +1 powt. / = z ciężarem.
- Historia per ćwiczenie (`historyFor`): zamienniki w tym samym miejscu planu mają osobną progresję.
- docs/EVIDENCE.md: ACSM 2026, ACSM 2009 (2–10%), dokładność RIR (Halperin 2022, Steele 2017), detrening (Encarnação 2022), reguły projektowe W2.
- Testy: tests/w2.test.ts (20), E2E `progression_flow`, `progression_reject`. Bez migracji (nowe pola opcjonalne, nieindeksowane).

## 0.7.1 — 2026-11-22 (gotowe przepisy, ankieta zdrowotna, weryfikacja źródeł)
- 25 gotowych, prostych przepisów domowych (`data/recipeLibrary.ts`): 6 śniadań, 11 obiadów (meal prep 2–4 porcje), 5 kolacji, 3 przekąski. Własne opracowanie typowych dań z redukcji, składniki wyłącznie z bazy (bez szacunków), kroki przygotowania, czas. Porcja posiłku 310–660 kcal, białko 21–48 g.
- Przepisy → zakładka „Gotowe przepisy” z filtrem pory dnia; podgląd, dodanie porcji do dziennika, „Zapisz u siebie” (kopia z `libraryId`, nie dubluje się w propozycjach).
- Dopasowanie do profilu (`adaptForProfile`): przy diecie bez nabiału i produktach źle tolerowanych automatyczny zamiennik tej samej roli; bez zamiennika przepis pomijany.
- „Co mam teraz zjeść?” korzysta z gotowych przepisów, preferuje porę dnia (śniadanie/obiad/kolacja/przekąska z godziny), własne przepisy mają pierwszeństwo, przycisk „Nie proponuj” (z przywracaniem), kroki „Jak zrobić”. Uczenie: częściej wybierane awansują, odrzucone znikają.
- Ankieta zdrowotna przy zakładaniu konta (ręcznie): insulinooporność/cukrzyca, nabiał, kolano, inne choroby. Zapis do istniejących ustawień (reguły planu, `health`), bez nowych pól.
- docs/EVIDENCE.md przepisany: reguły ze zweryfikowanymi źródłami (ISSN 2017, Schoenfeld i Aragon 2018, metaanalizy błonnika, Leidy 2013, badania pory posiłków), lista do weryfikacji, reguły projektowe i lista mitów, których aplikacja nie stosuje. Złagodzony tekst coacha o białku i wieczornym głodzie (przesadzony względem dowodów).
- Zasady W2–W5 w docs/ADAPTIVE_COACH_AUDIT.md: prosto, aplikacja prowadzi, tylko wiedza poparta badaniami, uczenie z zachowania.
- „Nowy przepis” zawsze widoczny nad zakładkami.
- Testy: tests/library.test.ts (12), E2E `library_recipes`, `onboarding_health_survey`. Bez migracji danych.

## 0.7.0 — 2026-11-22 (Adaptive Coach, Wdrożenie 1)
- „Co mam teraz zjeść?” (Dieta): pozostały bilans dnia (`remainingFor`: cel dnia treningowego / bez treningu − zjedzone, budżet następnego posiłku, makro niepewne przy pokryciu < 80%, stany „przekroczony” i „prawie osiągnięty” bez propozycji i bez odrabiania), 2–3 propozycje (`suggestMeals`) z przepisów (krok 0,25 porcji), posiłków z szablonów (gramatury 50–160%) i przy budżecie ≤ 450 kcal z ulubionych/częstych produktów. Ranking: dopasowanie kcal, białko względem pozostałego, kara za przekroczenie tłuszczu/węgli i limitu węgli na posiłek, błonnik, znane produkty, unikanie powtórek z dnia, niższa pozycja przy niepełnych danych. Pomijane produkty źle tolerowane i nabiał przy diecie bez nabiału. Uzasadnienia i ostrzeżenia przy każdej propozycji.
- Dodanie jednym dotknięciem przez istniejące `recipeEntry`/`productEntry` (snapshot, porcje, nieznane makro); numer następnego wolnego posiłku.
- docs/ADAPTIVE_COACH_AUDIT.md: audyt 5 wdrożeń.
- Testy: tests/w1.test.ts (13), E2E `meal_suggestions`. Bez migracji danych.

## 0.6.1 — 2026-11-22 (bez serwera)
Numer 0.6.1 zamiast proponowanego 0.5.1: 0.6.0 jest już wydane, 0.5.1 cofnęłoby numerację.
- Diagnostyka pamięci (Zdrowie → Pamięć urządzenia): wynik `persisted()`, przycisk `persist()`, zajętość i limit z `estimate()`, tryb (ekran główny / przeglądarka), test zapisu w transakcji, rejestr błędów zapisu bazy (tylko nazwa błędu i czas, maks. 20, w localStorage) z oceną i zaleceniami (`domain/storageDiag.ts`). Błędy zapisu łapane globalnie (`unhandledrejection`), przy braku miejsca komunikat. Rozbudowuje istniejący wiersz pamięci z 0.6.0 (przeniesiony z karty kopii).
- Poranny check-in: jedno przypomnienie o kopii na każdy 7-dniowy cykl liczony od potwierdzenia zapisu (`backupReminderDays`, domyślnie 7); „Za tydzień” odkłada do następnego cyklu; „Zapisz i zrób kopię” zapisuje check-in i przechodzi do karty kopii. Bez potwierdzonej kopii: od razu i co 7 dni po odłożeniu. Samo wygenerowanie pliku nie liczy się jako kopia. Baner w Profilu bez zmian.
- Dziennik: zmiana porcji wpisu przepisu (0,25–20) z przeliczeniem kcal, B/T/W, błonnika, gramów i części z nieznanym makro z własnego snapshotu wpisu (nie z obecnej wersji przepisu). Pozostałe wpisy, przepis i historia bez zmian. `FoodEntry.portions` (nowe wpisy); starsze wpisy: porcje odczytywane z nazwy „(x porc.)”.
- docs/IPHONE_TEST_CHECKLIST.md: checklista testów na iPhonie (pamięć, backup, restore, PWA, offline, skaner, Skrót Apple Zdrowie, nowości 0.6.1).
- Testy: 14 nowych (tests/v061.test.ts), E2E +3 scenariusze (9 łącznie).

## 0.6.0 — 2026-11-22 (ETAP 3)
### 3F Wydajność i porządki
- Pomiary (Chrome, widok iPhone, build produkcyjny): bundel JS 711 kB (221 kB gzip): react-dom 29,5%, Dexie 14%, Zod 13%, kod aplikacji ~43%. Start 0,2 s (CPU 1×) / 0,6–0,8 s (CPU 4×); przejścia zakładek 26–75 ms; reakcja wyszukiwarki ~30 ms; animacja 60 fps bez klatek > 33 ms.
- Decyzja: bez lazy loadingu. Rzadziej używane ekrany to ~12% kodu, szacowany zysk < 60 ms przy CPU 4×, a dochodzi dociąganie fragmentów i ryzyko w trybie offline.
- E2E w repozytorium: `e2e/` (Python + Playwright, bez zależności npm), `npm run e2e` (6 scenariuszy z asercjami) i `npm run perf`.
- Zaktualizowane ROADMAP.md, ARCHITECTURE.md, PROJECT_STATE.md.

### 3E Open Food Facts i wyszukiwanie
- `domain/foodSearch.ts`: ranking lokalny (dopasowanie słów bez polskich znaków, początek nazwy, ulubione, częstość i świeżość użycia; dania szacunkowe i produkty z niepełnym makro niżej). Naprawia „kurczak” → kotlet panierowany i „ryż” → białko roślinne.
- Deduplikacja wyników online: pomija produkty już zapisane (kod lub id) i powtórzenia (kod, potem nazwa).
- `domain/offCache.ts`: cache w localStorage (wyszukiwania 3 dni, kody 30 dni, brak produktu 1 dzień), maks. 60 wpisów, odporny na uszkodzone wpisy.
- `data/offClient.ts`: typy błędów (offline bez wysyłania zapytania, limit 429 z blokadą 60 s, timeout, błąd serwera, sieć) z komunikatami po polsku; wyszukiwanie online tylko przyciskiem i od 3 liter (nie przy każdej literze).
- `offToProduct`: brak kcal = odrzucony; brak białka/tłuszczu/węgli/błonnika = `unknown` (nie 0); walidacja etykiety (`validateNutrients`): wartości niemożliwe odrzucone, podejrzane (kcal ≠ makro, cukry > węgle, nasycone > tłuszcz, brak składu) jako `labelWarnings` w karcie produktu. Ta sama walidacja w ręcznym dodawaniu produktu.

### 3D Feedback coacha
- `RecommendationFeedback.reason` (nie teraz, brak czasu, nie pomaga mi, nie pasuje do mojej sytuacji, problem zdrowotny, inny powód + notatka) i akcja `reset` (przywrócenie porady). Stare odrzucenia bez powodu = „nie teraz”.
- `domain/feedback.ts`: czas ukrycia zależny od powodu (0/3/14/30/14/7 dni), 3 odrzucenia tej samej porady w 30 dni (poza „nie teraz”) → 30 dni; porady zdrowotne (`Recommendation.health`, np. opuszczone treningi z powodu bólu) ukrywane najwyżej do końca dnia. Ostrzeżenia bezpieczeństwa nie przechodzą przez ten mechanizm.
- Ekran „Dzisiaj”: wybór powodu po „Nie teraz…”, lista „Ukryte porady” z datą i „Pokazuj znowu”.

### 3C Edytor treningów
- Dexie v4: tabela `workoutTemplates` (plan A/B nadpisuje domyślny, inne id = własny wariant slotu); `Settings.activeWorkouts` wybiera aktywny wariant.
- Edytor planu (Trening → „edytuj”): zmiana ćwiczenia (filtr grup mięśni), dodawanie, usuwanie, serie, zakres powtórzeń, przerwy, kolejność, zapis jako wariant, przywrócenie domyślnego.
- Przy starcie treningu plan zapisuje się w sesji (`WorkoutSession.plan`, `planName`): edycja szablonu nie zmienia trwających ani zakończonych treningów; sesje sprzed 0.6 używają planu domyślnego.
- `domain/workoutEdit.ts` (effectivePlan, variantsFor, sessionPlan, validatePlan): zakresy serii 1–6, powtórzeń 1–30, przerw 30–300 s, bez duplikatów; bez oceny kolana nie można dodać nowego ćwiczenia mocno obciążającego kolano.
- Reguła blokady kolana w trakcie treningu przeniesiona z UI do `domain/workout.ts` (`kneeBlocked`) i przetestowana; działa po ćwiczeniu, więc obejmuje własne plany.
- Ekran „Dzisiaj” podpowiada jadłospis z edytowanych szablonów (3B).

### 3B Przepisy i szablony dni
- Dexie v3: nowe tabele `recipes` i `mealTemplates` (istniejące dane bez zmian, kopie sprzed v3 nie kasują przepisów przy imporcie).
- `domain/recipes.ts`: suma przepisu (kcal, B/T/W, błonnik) z modelem kompletności (nieznane makro składnika ≠ 0), porcja, skalowanie porcji, kopia, porcje pod cel posiłku (dzień treningowy / bez treningu), ostrzeżenia i zamienniki dla produktów źle tolerowanych i mlecznych, lista zakupów z szablonów i przepisów, walidacja szablonu.
- Wpis z przepisu: jeden wpis ze snapshotem wartości (`productId: recipe:<id>`), część kcal z nieznanym makro w `FoodEntry.unknownKcal`; `sumDay` liczy pokrycie także z tej części. Edycja przepisu nie zmienia historii.
- Ekran Diety: „Przepisy” (lista, edytor, kopiowanie, ulubione, usuwanie, dodanie porcji do dziennika), „Szablony” z edycją A/B/C bez zmiany kodu (zmieniony szablon nadpisuje domyślny, „Przywróć domyślny”), własne warianty, podgląd dopasowania na dzień treningowy i bez treningu, wstawianie składników przepisu do szablonu. Lista zakupów z dowolnych szablonów i przepisów.
- `FoodProduct.unknown` (opcjonalne): makro nieznane w źródle, przenoszone do wpisów.

### 3A Bezpieczeństwo danych
- Format kopii v2: liczby rekordów na tabelę, suma SHA-256 tabel, wersja schematu Dexie i aplikacji. Kopie v1 nadal się wczytują (bez sumy kontrolnej; sprawdzany format i rekordy).
- `inspectBackup`: podgląd przed importem (data, liczba rekordów, integralność, brakujące tabele). Odrzuca plik ucięty, zmieniony, z nieznaną tabelą lub z nowszego schematu.
- Import w jednej transakcji: błąd = rollback, obecne dane bez zmian. Brak miejsca (QuotaExceededError) ma osobny komunikat. Tabele nieobecne w kopii nie są już czyszczone (wcześniej import kopii częściowej kasował resztę).
- Eksport w transakcji tylko do odczytu (spójny stan), po wygenerowaniu automatyczna weryfikacja pliku (odczyt, odszyfrowanie hasłem, suma, porównanie liczby rekordów z bazą).
- Zapis w dwóch krokach: „Przygotuj kopię” → „Zapisz w Plikach / iCloud” (arkusz udostępniania iOS, w innych przeglądarkach pobranie) → „Potwierdzam: plik jest zapisany”. Przypomnienie o kopii liczy się od potwierdzenia, nie od wygenerowania.
- Status pamięci: `navigator.storage.estimate()` i `persist()` (prośba o trwałe przechowywanie przy pierwszej kopii).
- Testy: pełny cykl wszystkich 17 tabel (zwykła i zaszyfrowana), rozjazd z bazą, plik zmieniony/ucięty, rollback w środku importu, tabele nieobecne, baza Dexie v1 → upgrade → kopia → import.

## 0.5.0 — 2026-11-22 (ETAP 2: instruktaż treningowy i zamiana ćwiczeń)
- Nowy silnik animacji `domain/rig.ts`: szkielet 2D ze stałymi długościami segmentów, kinematyka prosta od biodra i odwrotna (2 kości) dla kończyn, klatki kluczowe z fazami (start / ekscentryczna / dół / koncentryczna / góra), oddech i opis w każdej fazie, płynne przejścia.
- `data/rigs.ts`: wzorce 13 ćwiczeń FBW A/B. Trzy referencyjne (RDL z hantlami, siad na wysoką ławkę, wyciskanie hantli na skosie) sprawdzone z opisami techniki z materiałów szkoleniowych (NASM, NSCA/Human Kinetics, EliteFTS, uczelniane programy S&C). Pozostałe schematyczne.
- `ui/RigView.tsx`: odtwarzanie/pauza, suwak, 0,5×/1×, przełączanie faz, podświetlenie mięśni, tor ruchu, błąd techniki pokazany na czerwono, kąt kolana (siad) i ławki tylko tam, gdzie to uzasadnione, z „~”.
- Karta ćwiczenia: animacja, ustawienie sprzętu, pozycja wyjściowa, wykonanie krok po kroku, oddech, 3 najczęstsze błędy, ostrzeżenia zdrowotne z dzisiejszą blokadą kolana, alternatywy, ostatnie wyniki.
- Zamiana ćwiczenia w trakcie treningu (`domain/workout.ts`): ta sama grupa mięśni, filtr sprzętu, blokady kolana z `safety`, serie i przerwy z planu zostają, nowe serie zapisane pod faktycznym ćwiczeniem, osobna historia progresji, powrót do ćwiczenia z planu, zamiana przetrwa odświeżenie. 12 nowych ćwiczeń alternatywnych (bez animacji, link do wideo).
- `box_step_up` zachowuje id, nazwa wyświetlana: „Siad na wysoką ławkę i wstawanie”.
- Usunięte stare animacje (`ExerciseAnim.tsx`, `poses.ts`).

## 0.4.0 — 2026-11-22 (ETAP 1: logika żywienia i redukcji)
- observedTdee: tylko dni kompletne (potwierdzone „wpisałem wszystko” lub prawdopodobne), trend wagi z regresji, wiarygodność high/medium/low/insufficient z zakresem błędu; do planu tylko ≥ medium.
- Coaching, adaptacja i raporty porównują spożycie z historycznym celem dnia (planOn + dayTargets), nie ze średnim planem.
- Szybki wpis: nieznane makro oznaczone (`FoodEntry.unknown`), pokrycie makro dnia, makro w analizach tylko przy pokryciu ≥80%. Migracja Dexie v2 + ta sama migracja przy imporcie starych kopii.
- Insulinooporność: domyślnie tylko ostrzeżenia; przeniesienie nadwyżki węgli do tłuszczu wyłącznie jako świadome ustawienie indywidualne (`shiftExcessToFat`) z opisem ograniczeń.
- Ręczny edytor kcal/makro: walidacja (validatePlanEdit), podgląd TDEE i deficytu, powód zmiany, potwierdzenie specjalisty < 2100 kcal, nowa wersja planu po zatwierdzeniu.
- Cykl kalorii: budżet 14-dniowy z liczbą treningów z planu (4/14: 2650 / 2370), dzień zaplanowany jako treningowy zachowuje cel treningowy także po odwołaniu treningu; węgle z planu ± różnica cyklu (szanuje ręczną edycję).
- Jadłospis: fitDayToTargets (kcal + B/T/W, tolerancje, porcje 5 g, korekta o energię z błonnika, zamiana produktów źle tolerowanych).

## 0.3.0 — 2026-11-22
- Baza produktów: 31 → ponad 250 (mięso, ryby, nabiał z oznaczeniem mleka, roślinne białko, kasze suche/ugotowane, pieczywo, warzywa, owoce, orzechy, sosy, słodycze, napoje, dania i fast food jako szacunki). Brakujące produkty dokładane przy starcie bez nadpisywania edycji.
- Open Food Facts: wyszukiwarka online (PL, potem świat) i skaner kodów kreskowych aparatem (BarcodeDetector lub ponyfill zxing-wasm), wykrywanie mleka ze składu/alergenów, zapis do własnej bazy (offline).
- Szybki wpis kcal (szacunek), ostatnio używane na górze, cukry / tłuszcze nasycone / sól z etykiet.
- Cele dnia (domain/targets.ts): cykl kalorii trening/odpoczynek przy stałej średniej tygodniowej i stałym białku; reguły insulinooporności (max % węgli, cukry, błonnik, węgle na posiłek); bez nabiału. Wszystko jako ustawienia w nowej wersji planu.
- Animacje SVG 13 ćwiczeń: pozycja wyjściowa, wydech przy wysiłku, wdech przy powrocie, pauza na pozycji startowej, link do wideo.

## 0.2.0 — 2026-11-22
- Kalkulator zapotrzebowania (wywiad o ruchu → TDEE → plan, TDEE z danych po 3–4 tyg.).
- Synchronizacja z Apple Zdrowie przez Skrót iOS (schowek lub #sync), tętno spoczynkowe i aktywne kcal tylko informacyjnie.
- Wieczorne potwierdzenia (dieta, słodycze), raporty 7/14/28 dni z realizacją planu.
- Hosting: Netlify połączony z GitHub (tyllfirmowy-ops/my-body-os), auto-deploy z main.

## 0.1.0 — 2026-11-22
- Pierwsza wersja MVP (etap 1 + część etapów 2–3).
- Poprawka: coaching nie analizuje dni sprzed startu planu (fałszywe „opuszczone treningi” w 1. dniu).
