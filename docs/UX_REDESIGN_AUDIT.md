# Audyt UX przed przebudową 1.0 (stan 0.8.0, 2026-11-22)

Podstawa: kod z gałęzi main (commit 7e56878), nie dokumentacja. Oceniane z perspektywy osoby, która pierwszy raz otwiera aplikację. Liczba kroków liczona od otwarcia aplikacji (ekran Dzisiaj), dotknięcia bez wpisywania tekstu.

## Najpoważniejsze źródła komplikacji

1. **Dzisiaj pokazuje wszystko naraz.** Na pierwszym ekranie jest 12–14 bloków: plakietka „Plan A/B/C”, karta check-inu, „Najważniejsze dziś” z 4 wierszami technicznymi (typ dnia z gramami węglowodanów, szablon jedzenia, kroki, trening), 4 kafelki (waga, woda, sen, kolano), karta coacha, ukryte porady, „Wklej dane ze Zdrowia”, wieczorny check-in. Nie ma przycisku dodania jedzenia. Żeby zapisać posiłek, trzeba wiedzieć, że kalorie są przyciskiem prowadzącym do Diety.
2. **Dodanie jedzenia wymaga wyboru posiłku przed wyborem produktu.** Dieta → „Dodaj” w jednej z 5 kart posiłków → wyszukiwarka. Pięć równorzędnych skrótów (Szablony, Przepisy, Z wczoraj, Zakupy, Awaryjnie) i duży „Co mam teraz zjeść?” stoją nad dziennikiem.
3. **Ustawienia w kilku miejscach.** Ustawienia planu żywienia otwierane są z Diety (ikona) i z Profilu. Jednostki obciążenia i dostępność treningów są tylko na ekranie Trening, profil i zdrowie w zakładce „Zdrowie”, kopia zapasowa też w „Zdrowie”.
4. **Zakładka „Zdrowie” to mieszanka profilu, planu kalorii, wersji planu, kalendarza opieki, wyników badań, dziennika trawiennego, diagnostyki pamięci i kopii.** 15 kart bez grup.
5. **Treści osobiste autora widoczne dla każdego.** „Sen: kierunek” (stałe godziny 07:30/23:30), lista tematów do lekarza, teksty „spacer z córką” w Dzisiaj. Drugi użytkownik (np. brat) je widzi.
6. **Onboarding zaczyna się od importu pliku i „Profil demo”.** Nowa osoba nie ma pliku profilu; ścieżka „Wpisz ręcznie” jest drugorzędna.

## Ekrany

### Dzisiaj (`src/screens/Today.tsx`, 201 linii)
1. Cel obecny: dzienny przegląd planu A/B/C, check-iny, coach.
2. Zadanie użytkownika: zobaczyć, ile kalorii zostało, zapisać jedzenie, wiedzieć, czy jest trening.
3. Zbędne od razu: plakietka „Plan A”, „Brak danych: …”, wiersz typu dnia z gramami W, nazwa szablonu dnia, kafelki woda/sen/kolano, „Podstawa: … · dane: …” przy coachu, „Wklej dane ze Zdrowia” jako pełny przycisk.
4. Powtórzenia: kroki w dwóch miejscach (wiersz „Ruch”, wieczorny check-in); trening w „Najważniejsze dziś” i w wierszu „Trening”; coach obok „Najważniejsze dziś” (dwa źródła rad).
5. Kroki: dodanie jedzenia 3 dotknięcia + wpisanie (kalorie → Dieta → Dodaj przy posiłku → szukaj → produkt → Dodaj = 5). Start treningu 2 (wiersz Trening → Start).
6. Uproszczenie: jedna sugestia z deterministycznego silnika, duży „+ Dodaj jedzenie” prosto do wyszukiwarki, białko widoczne, reszta makro rozwijana, woda/sen/kolano w „Szczegóły dnia”.
7. Ryzyka: alerty bezpieczeństwa (urgent, stop_legs, caution_legs) muszą zostać widoczne nad wszystkim; feedback coacha (`pickRecommendation`) i karta raportu tygodnia mają testy E2E; import ze Skrótu (`pendingSync`) otwiera wieczorny check-in.
8. Docelowo: powitanie + data → alerty zdrowotne → kalorie (pozostało) → „+ Dodaj jedzenie” → ruch (kroki, trening/odpoczynek) → jedna sugestia → średnia waga tygodnia → zwinięte szczegóły.

### Dieta (`Diet.tsx`, 261) i wyszukiwarka (`FoodPicker.tsx`, 173)
1. Cel: dziennik dnia, bilans, makro, szablony, przepisy.
2. Zadanie: dodać to, co zjadł, poprawić gramaturę.
3. Zbędne od razu: 4 paski makro z błonnikiem, notatki reguł, „Co mam teraz zjeść?” jako główny przycisk, 5 skrótów, 5 kart posiłków (także pustych).
4. Powtórzenia: ustawienia planu (ikona w nagłówku i Profil); „z wczoraj” globalnie i w każdej karcie.
5. Kroki: produkt 4 dotknięcia + wpis; skopiowanie wczorajszego posiłku 1 (bez podglądu, bez cofania).
6. Uproszczenie (W2): jedno „+ Dodaj jedzenie”, posiłek wybierany na końcu z domyślnym wg pory dnia, parser „banan 120g”, ostatnie/częste, cofnięcie dodania, funkcje dodatkowe w „Więcej możliwości”.
7. Ryzyka: identyfikatory posiłków 1–5 w `FoodEntry.meal` (historia); szybki wpis zapisuje 0 w snapshot z listą `unknown` (nie zmieniać semantyki); wpisy przepisów przeliczane z własnego snapshotu.
8. Docelowo: bilans + białko → posiłki (puste zwinięte) → jedno dodanie → „Więcej możliwości”.

### Trening (`Training.tsx`, 509)
1. Cel: plan tygodnia, start treningu, edycja planów, biblioteka.
2. Zadanie: rozpocząć dzisiejszy trening.
3. Zbędne od razu: pełne listy planu A i B, biblioteka 40+ ćwiczeń jako chipy, link do jednostek.
4. Powtórzenia: licznik tygodnia w karcie „Ten tydzień” i w nagłówku 14 dni.
5. Kroki: start 1 (z zakładki), z Dzisiaj 2. Tryb skupienia: seria = 1 dotknięcie (dobrze).
6. Uproszczenie: plany i biblioteka w zwiniętej sekcji, jednostki i dostępność w Profilu → Ustawienia treningów.
7. Ryzyka: tryb skupienia, blokady kolana i `progressFor` bez zmian; E2E klikają „Edytuj plan A”, nazwy ćwiczeń z listy, „Dostępność:”, „Jednostki i skoki”.
8. Docelowo: Dziś (Start) → Ten tydzień → 14 dni → „Plany i ćwiczenia” (zwinięte).

### Postępy (`Progress.tsx`, 217)
1. Cel: wykresy wagi, talii, kalorii, białka, kroków, snu, stresu; silnik redukcji; raporty; eksport dla AI.
2. Zadanie: czy waga spada.
3. Zbędne od razu: 6 wykresów, „Silnik redukcji”, siła 1RM, zależności 35 dni.
4. Powtórzenia: średnia 7 dni też w Dzisiaj (to dobrze, ale w innej formie).
5. Kroki: trend widoczny od razu (0).
6. Uproszczenie (W5): pierwszy widok = trend + zmiana + do celu + jeden wykres + zdanie interpretacji; reszta w „Szczegóły”.
7. Ryzyka: zatwierdzanie propozycji kalorii (`approve`) tworzy nową PlanVersion; nie ruszać w W1.
8. Docelowo: W5.

### Profil / „Zdrowie” (`Profile.tsx`, 367)
1. Cel: wszystko poza dniem bieżącym.
2. Zadanie: zmienić dane, zrobić kopię.
3. Zbędne od razu: 15 kart bez grup; „Sen: kierunek” i tematy do lekarza są osobiste.
4. Powtórzenia: ustawienia planu (też w Diecie), BMR/TDEE w karcie profilu i w kalkulatorze.
5. Kroki: kopia zapasowa = przewinięcie na sam dół + 3 przyciski.
6. Uproszczenie: wejście ikoną w górnym rogu, sekcje: Moje dane, Cel i plan, Zdrowie, Aktywność i integracje, Ustawienia treningów, Ustawienia żywienia, Kopie bezpieczeństwa, Eksport danych, Pomoc, Zaawansowane.
7. Ryzyka: E2E szukają „Przygotuj kopię”, „Test zapisu”, `id="backup"` (przewijanie z check-inu przez `sessionStorage.scrollTo`). Karta opieki zakłada `d.custody`.
8. Docelowo: lista sekcji z nagłówkami, karty bez zmian w środku.

### Onboarding (`Onboarding.tsx`, 170)
1. Cel: import profilu / kopii, ręczny profil, ankieta zdrowotna, opieka, pomiary.
2. Zadanie nowej osoby: wpisać dane i dostać plan.
3. Zbędne od razu: import JSON i „Profil demo” na pierwszym ekranie, pomiary 6 obwodów.
4. Ryzyko bezpieczeństwa (naprawione w W1): `saveManual` zapisywało `kneeCleared: true` przed ankietą zdrowotną. Zamknięcie aplikacji na kroku ankiety → po ponownym otwarciu krok „opieka”, a kolano zostawało „ocenione przez specjalistę”. Teraz domyślnie `false`, ankieta ustawia wartość.
5. Docelowo: W3 (ekran powitalny, 5 kroków, przywracanie kopii jako link).

### Raport tygodnia, check-iny, Energia
- Raport tygodnia: 4 pytania i skutki w `domain/weeklyCheckin.ts` są dobre; prezentacja wyniku do uproszczenia w W4/W5 (3 pytania: co się udało, co utrudniało, co robimy).
- Check-iny: poranny (waga, sen, energia, objawy) zasila gotowość A/B/C i blokady. Nie może być wymagany przed dziennikiem (nie jest), ale na Dzisiaj zajmuje dużą kartę. W1: kompaktowy wiersz.
- Energia: kalkulator z wyborem tempa jest w Profilu; zostaje w „Cel i plan”.

## Elementy do ponownego użycia
`Card`, `Btn`, `Sheet` (portal), `Bar`, `Stat`, `Toggle`, `Stepper`, `toast`; `pickRecommendation`/`suppression` (pamięć odrzuconych porad); `rankLocal`/`usageFrom`/`dedupeOnline` (wyszukiwarka); `reportDue`; `PLAN_COPY`; `FoodPicker` (zakładki lokalne/online/skan/szybko). Paleta (grafit, turkus, jasny motyw) już odpowiada kierunkowi wizualnemu, więc W1 nie zmienia kolorów.

## Znana niespójność do W5
- Liczba treningów jest w dwóch miejscach: `plan.workoutsPer14d` (rozkład kalorii dnia treningowego / bez treningu, zmiana tworzy PlanVersion) i `settings.trainingsPerWeek` (planer tygodniowy). W1 ich nie łączy, bo zmiana dotyka historii celów kalorii. Plan: jedno ustawienie w Profilu → Ustawienia treningów, plan kalorii czyta je przy nowej wersji planu.

## Matematyka kalorii (sekcja XI)
- `kcalFloor` zaokrąglał BMR **w dół** do 50 kcal: przy BMR 1849 minimum wynosiło 1800, czyli 49 kcal poniżej deklarowanej reguły „nie mniej niż przemiana spoczynkowa”. W1: zaokrąglenie w górę (`Math.ceil`). Istniejące plany się nie zmieniają (zapisane PlanVersion); nowy wynik kalkulatora może być wyższy o ≤ 49 kcal. Opis w EVIDENCE.md doprecyzowany: to konserwatywny limit projektowy, nie próg medyczny.

## Plan migracji i zabezpieczenia danych
- W1 nie zmienia schematu Dexie (v5). Zmiany dotyczą tylko UI i czystych funkcji; nowe ustawienia nie są potrzebne (odłożenie sugestii zapisuje się w istniejącej tabeli `feedback` z identyfikatorem `nba_<rodzaj>`).
- W2 (posiłek na końcu, własne nazwy posiłków) zachowa `FoodEntry.meal` 1–5; nazwy będą w ustawieniach, nie w wpisach.
- Każdy etap: test kopii zapasowej E2E (eksport → import) i scenariusze na profilu demo; testy migracji przy każdej nowej `version(n)`.
