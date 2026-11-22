# Changelog
## 0.6.0 — 2026-11-22 (ETAP 3, w toku)
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
