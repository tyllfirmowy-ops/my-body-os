# Roadmap (stan na 0.6.0, 2026-11-22)

Zrobione
- MVP: profil prywatny, baza lokalna, dashboard, pomiary, grafik 2-2-3, check-iny, dziennik, trening z autosave, A/B/C, blokady zdrowotne, raporty tydzień/miesiąc, kopia z szyfrowaniem.
- 0.2–0.3: kalkulator BMR/TDEE, Skrót iOS do Apple Zdrowie (wklejanie), wieczorne potwierdzenie, ~280 produktów, Open Food Facts + skaner kodów, cele dnia treningowego / bez treningu, warunki zdrowotne jako zmienne.
- 0.4 (ETAP 1): audyt logiki żywienia, kompletność makro (brak ≠ 0), TDEE z danych, ręczna edycja planu z walidacją.
- 0.5 (ETAP 2): animacje 2D ze stałymi długościami kości, karta ćwiczenia, zamiana ćwiczenia w trakcie treningu.
- 0.6 (ETAP 3): kopia v2 z weryfikacją i potwierdzeniem zapisu, przepisy i edycja szablonów A/B/C, edytor planów treningowych z wariantami, powody odrzucenia porad, ranking/cache/walidacja OFF, pomiary wydajności, E2E w repo.

Przebudowa 1.0 „Everyday experience” (specyfikacja z 2026-11-22, każdy etap na osobnej gałęzi, scalanie po akceptacji)
- W1 fundament UX: gotowe na gałęzi `feat/1.0-w1-ux` (0.9.0).
- W2 dieta bez tarcia: parser wpisów („banan 120g”, „2 jajka”), odmiany i literówki, ostatnie / częste / ulubione / moje posiłki, edycja gramatury przy wpisie, kopiowanie posiłku i dnia z podglądem i cofnięciem, „Więcej możliwości” zamiast 5 skrótów, przepisy w wynikach wyszukiwania.
- W3 onboarding: ekran powitalny, 5 kroków bez pojęć technicznych, przywracanie kopii jako link, cele tylko te, które silnik liczy, bez zmian dla istniejących profili, opcja „nie ćwiczę siłowo”.
- W4 codzienny wspieracz: biblioteka komunikatów powiązanych ze zdarzeniami, uproszczone A/B/C, raport tygodnia w 3 punktach.
- W5 postępy i aktywność: prosty pierwszy widok, szczegóły rozwijane, status synchronizacji kroków, rozdzielenie danych szacowanych i zmierzonych, jedno źródło liczby treningów, opcjonalne dni opieki w planerze.
- W6: dostępność, iPhone, offline, aktualizacja PWA, kopie, migracje, test z osobą spoza projektu.

Otwarte (bez backendu)
- Test na fizycznym iPhonie: zapis kopii przez „Zapisz w Plikach”, `storage.persist()`, płynność animacji, skaner, Skrót iOS.
- Galeria zdjęć sylwetki (lokalnie, z suwakiem porównania) i osobne raporty 14/28 dni.
- Animacje dla ćwiczeń alternatywnych; widok z przodu dla błędów płaszczyzny czołowej (kolana do środka, łokcie).
- EVIDENCE.md: pełne odnośniki do źródeł.

Wymaga decyzji / ETAP 4 (poza zakresem 0.6)
- Powiadomienia push (iOS PWA wymaga serwera VAPID), synchronizacja między urządzeniami, natywny wrapper z HealthKit.
