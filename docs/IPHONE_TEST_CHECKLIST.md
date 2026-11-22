# Testy na prawdziwym iPhonie (wersja 0.7.1)

Status wszystkich punktów: **NIEWYKONANE** (wymagają fizycznego iPhone'a; nie da się ich sprawdzić w headless Chrome).
Wpisuj wynik przy punkcie: `OK`, `BŁĄD: opis` albo `POMINIĘTE: powód`. Przy błędzie zapisz model iPhone'a, wersję iOS i zrzut ekranu.

Przygotowanie
- [ ] Zanotuj: model iPhone'a, wersja iOS, wolne miejsce (Ustawienia → Ogólne → iPhone – pamięć).
- [ ] Aplikacja dodana do ekranu głównego (Safari → Udostępnij → Do ekranu początkowego) i otwierana z ikony, nie z Safari.
- [ ] Zdrowie → stopka pokazuje „My Body OS 0.7.1”. Jeśli starsza wersja: zamknij aplikację w przełączniku i otwórz ponownie (przy połączeniu z internetem).

## 1. Pamięć urządzenia (diagnostyka)
- [ ] Zdrowie → Pamięć urządzenia: wiersz `persisted()` pokazuje „tak”, „nie” albo „brak odpowiedzi”. Zapisz wynik osobno dla aplikacji z ekranu głównego i dla Safari.
- [ ] „Poproś o trwałą pamięć”: zanotuj komunikat i wynik `persisted()` po odświeżeniu.
- [ ] „Zajęte … z limitu …”: wartości się pokazują (zanotuj liczby) albo „brak danych”.
- [ ] „Test zapisu” → „Test zapisu udany (… ms)”. Zanotuj czas.
- [ ] Tryb: „aplikacja z ekranu głównego” przy otwarciu z ikony.

## 2. Kopia zapasowa (backup)
- [ ] Bez hasła: „Przygotuj kopię” → zielona ramka „Plik gotowy i sprawdzony”, liczba rekordów i rozmiar.
- [ ] „2. Zapisz w Plikach / iCloud” otwiera arkusz udostępniania iOS (nie pobieranie w Safari). Zanotuj, czy arkusz otwiera się od razu po dotknięciu.
- [ ] W arkuszu „Zapisz w Plikach” → iCloud Drive → folder (np. My Body OS) → „Zapisz”. Plik widać w aplikacji Pliki, nazwa `my-body-os-kopia-RRRR-MM-DD.json`.
- [ ] Anulowanie arkusza → komunikat „Anulowano. Plik nie został zapisany.”; przycisk „3. Potwierdzam” się nie pojawia.
- [ ] „3. Potwierdzam: plik jest zapisany” → „Potwierdzona kopia: [data]”. Baner „Zrób kopię zapasową” znika.
- [ ] Z hasłem: przygotuj kopię zaszyfrowaną, zapisz w Plikach, zapamiętaj hasło. Nazwa pliku kończy się na `-zaszyfrowana.json`.
- [ ] Alternatywa: „skopiuj tekst kopii do schowka” → wklej w Notatkach, tekst zaczyna się od `{"format":"my-body-os-backup"`.

## 3. Odtwarzanie (restore)
- [ ] Zdrowie → Import → wybierz plik z iCloud Drive → podgląd: data, liczba rekordów, „suma kontrolna zgodna”.
- [ ] „Zastąp dane” → „Dane odtworzone”. Sprawdź dziennik, wagę i treningi z ostatnich dni.
- [ ] Kopia zaszyfrowana: bez hasła → prośba o hasło; złe hasło → komunikat o błędzie, dane bez zmian; dobre hasło → podgląd i import.
- [ ] Plik uszkodzony (np. zmień jedną liczbę w kopii w Notatkach i wklej w pole importu) → komunikat o sumie kontrolnej, dane bez zmian.
- [ ] Pełne odtworzenie po usunięciu danych: Zdrowie → usuń wszystkie dane (TYLKO po zweryfikowanej kopii!) → onboarding → „Import kopii” → plik z iCloud → dane wróciły.

## 4. PWA (aplikacja z ekranu głównego)
- [ ] Start z ikony: pełny ekran bez paska Safari, ciemny pasek stanu, brak białego błysku.
- [ ] Przejścia między zakładkami bez widocznego opóźnienia; przewijanie płynne.
- [ ] Arkusze (sheets) i klawiatura: pola nie chowają się pod klawiaturą (poranny check-in, edytor przepisu, edytor planu).
- [ ] Aktualizacja: po nowym wdrożeniu zamknij aplikację w przełączniku i otwórz dwa razy, stopka pokazuje nową wersję.
- [ ] Dane po restarcie telefonu: wyłącz i włącz iPhone'a, otwórz aplikację, dane są.

## 5. Offline
- [ ] Otwórz aplikację raz z internetem. Włącz tryb samolotowy. Zamknij aplikację w przełączniku i otwórz z ikony: aplikacja się ładuje.
- [ ] Offline: poranny check-in, wpis do dziennika z bazy lokalnej, seria w treningu, przepis do dziennika. Po odświeżeniu wszystko zapisane.
- [ ] Offline: Dieta → Dodaj → Online → „Szukaj w Open Food Facts” → komunikat „Brak internetu…” (bez zawieszenia).
- [ ] Offline: „Przygotuj kopię” i zapis w Plikach (iCloud zsynchronizuje plik później).
- [ ] Po wyłączeniu trybu samolotowego dane z trybu offline są nadal widoczne.

## 6. Skaner kodów kreskowych
- [ ] Dieta → Dodaj → Skanuj → zgoda na aparat (pierwszy raz) → podgląd z tylnego aparatu.
- [ ] Zeskanuj produkt z polskim kodem EAN (np. jogurt, chleb) → karta produktu z wartościami z Open Food Facts. Porównaj kcal i makro z opakowaniem.
- [ ] Produkt spoza bazy → komunikat o dodaniu ręcznym z etykiety.
- [ ] Produkt z niepełną etykietą: ostrzeżenie „Brak danych: …” albo „Etykieta: …”.
- [ ] Odmowa dostępu do aparatu → czytelny komunikat, aplikacja działa dalej.
- [ ] Skaner bez internetu: zanotuj zachowanie (wyszukanie kodu wymaga sieci; moduł skanera może się nie załadować, jeśli nie był użyty online).
- [ ] Zanotuj czas od włączenia aparatu do rozpoznania kodu.

## 7. Skrót Apple Zdrowie
- [ ] Skrót zbudowany według instrukcji w aplikacji (Zdrowie → „Apple Zdrowie i zegarek” → „Synchronizacja z Apple Zdrowie”); uruchomiony ręcznie pyta o dostęp do Zdrowia (pierwszy raz).
- [ ] Po uruchomieniu w schowku jest tekst `MBOS1;steps=…;sleep=…;date=…` (sprawdź, wklejając w Notatkach).
- [ ] Dzisiaj → „Wklej dane ze Zdrowia” → podgląd kroków, snu, aktywnych kcal, tętna, wagi → zapis. Wartości zgadzają się z aplikacją Zdrowie (dane z Apple Watch też).
- [ ] Polski przecinek dziesiętny (np. `sleep=7,2`) jest poprawnie odczytany.
- [ ] Brak danych w schowku → komunikat „W schowku nie ma danych ze Skrótu”.
- [ ] Automatyzacja o 21:00 (jeśli ustawiona): uruchamia się, wysyła powiadomienie / kopiuje dane.

## 8. Nowe w 0.6.1
- [ ] Poranny check-in bez potwierdzonej kopii: ramka „Kopia zapasowa: brak potwierdzonej kopii”. „Za tydzień” → ramka znika i nie wraca po ponownym otwarciu check-inu.
- [ ] „Zapisz i zrób kopię” → check-in zapisany, aplikacja przechodzi do karty kopii zapasowej.
- [ ] Po potwierdzeniu kopii ramka w check-inie nie pokazuje się przez 7 dni (sprawdzić po tygodniu lub zmieniając datę w telefonie).
- [ ] Dziennik → stuknij wpis przepisu → zmiana porcji przyciskami −/+ → kcal i makro przeliczone → „Zapisz porcje” → nazwa wpisu z nową liczbą porcji; inne wpisy i dni bez zmian.

## 8a. Nowe w 0.7.0: „Co mam teraz zjeść?”
- [ ] Dieta → „Co mam teraz zjeść?”: pozostały bilans zgadza się z licznikiem dnia (cel − zjedzone).
- [ ] 2–3 propozycje z kcal, B/T/W i uzasadnieniem; przy pustym dzienniku ostrzeżenie „Brak wpisów…”.
- [ ] „Dodaj do: Posiłek N” → wpis(y) w dobrym posiłku, licznik dnia rośnie o kcal propozycji (±2).
- [ ] Po zjedzeniu prawie całego celu: komunikat „cel praktycznie osiągnięty”, bez propozycji; po przekroczeniu: bez odrabiania.
- [ ] Propozycje mają sens w praktyce (porcja, skład); zanotuj te, które nie pasują.
- [ ] Produkt oznaczony jako źle tolerowany nie pojawia się w propozycjach.

## 8b. Nowe w 0.7.1
- [ ] Dieta → Przepisy → „Gotowe przepisy”: filtr pory dnia, kroki, wartości porcji; „Dodaj 1 porc. do dziennika”.
- [ ] „Zapisz u siebie” → przepis w „Moje”, można go zmienić.
- [ ] Przy włączonym „Unikam nabiału” przepis ze skyrem pokazuje zamiennik.
- [ ] „Co mam teraz zjeść?” rano proponuje śniadania, w południe obiady; „Nie proponuj” usuwa propozycję, „Przywróć ukryte” przywraca.
- [ ] Nowe konto „Wpisz ręcznie”: krok „Zdrowie” z 3 pytaniami Tak/Nie i polem na inne choroby.
- [ ] Oceń przepisy w praktyce: czy są proste, czy porcje są realne, czego brakuje.

## 8c. W2: progres siłowy (po scaleniu)
- [ ] Trening → plan A/B: przy ćwiczeniach z historią znacznik ↑ / ↓ / +1 powt. / = i ciężar.
- [ ] W sesji przy propozycji zwiększenia: „Przyjmij X” / „Zostań przy Y” / „Inny ciężar”; bez decyzji serie mają dotychczasowy ciężar.
- [ ] „Zapas: 0 1 2 3 4+” przy serii: jedno dotknięcie, można pominąć.
- [ ] Trening → „Jednostki i skoki obciążenia”: lb pokazuje ciężary w lb, skok hantli zmienia propozycję.
- [ ] Po zamianie ćwiczenia sugestia dotyczy zamiennika (własna historia).

## 8d. Dostępność treningowa (po scaleniu)
- [ ] Trening: nagłówek „cel 3/tydz. (2 też jest OK)”, licznik „ten tydzień: x/3”, brak oznaczeń dni opieki.
- [ ] „Przełóż” przesuwa dzisiejszy trening; stuknięcie dnia w pasku oznacza go jako niedostępny („–”).
- [ ] „Dostępność”: zmiana 3 → 2 treningi zmienia plan; okno godzin tylko informacyjnie.
- [ ] Dieta: cel kcal w dniu treningowym zgadza się z planem treningów, także w dni opieki.

## 9. Krótka kontrola z wcześniejszych wersji
- [ ] Karta ćwiczenia: animacja płynna, pauza, suwak, 0,5×, fazy. Telefon nie grzeje się wyraźnie po 2 minutach odtwarzania.
- [ ] Zamiana ćwiczenia w trakcie treningu i powrót do ćwiczenia z planu.
- [ ] Edytor planu treningowego i edytor szablonu dnia na małym ekranie: wszystkie przyciski osiągalne, brak poziomego przewijania.
