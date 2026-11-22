# Reguły coachingu (src/domain/coaching.ts, readiness.ts, adaptation.ts)

A/B/C: C gdy energia 1, sen <4,5 h, stres 10, choroba, brak czasu, jakość snu 1 + energia ≤2, objaw alarmowy. B gdy sen 4,5–6 h, jakość ≤2, energia 2, stres 9, mało czasu. Stres 8 (bazowy u użytkownika) sam nie zmienia planu. Brak danych nie obniża poziomu.

Coaching (pokazywana 1 rekomendacja, najwyższy priorytet): powrót po ≥3 dniach bez wpisów (100) · pomijanie posiłków + głód wieczorem ≥3/7 dni (80) · wczoraj >110% kcal → zwykły plan, bez odrabiania (70) · stres ≥8 i >110% kcal ≥3/14 (65) · opuszczone treningi w dni bez córki ≥2/14, akcja wg powodu (60) · rozrzut pory snu >60 min (55) · białko <140 g przy ≥4 dniach (50). Każda ma: podstawę, liczbę dni, kompletność, ograniczenia. Analiza od daty startu planu.

Adaptacja: kalibracja 14 dni · ≥4 ważenia/tydz. · 0,4+ kg/tydz. = utrzymaj · talia −1 cm/14 dni = bez zmian · stagnacja (<0,3 kg/14 dni) → checklista (dziennik ≥10/14, realizacja ±8%) → jedna propozycja: −150 kcal ALBO +1000 kroków · 14 dni odstępu · podłoga indywidualne minimum (kcalFloor) kcal · >1 kg/tydz. przez 2 tyg. = nie zwiększaj deficytu.

Progresja: +najmniejszy krok tylko gdy wszystkie serie na górze zakresu, ten sam ciężar, technika „ok”, RIR ≥1 znany, ból ≤2, brak blokady. Ból ≥4 → −15%. Wstawanie z ławki bez obciążenia do oceny kolana.

Cele dnia (src/domain/targets.ts): cykl kcal opcjonalny; dzień treningowy +X kcal z węglowodanów, dni bez treningu restDelta = −X·N/(14−N) (N = treningi na 14 dni z planu), budżet 14 dni = 14 × plan.kcal, białko i tłuszcz stałe. Dzień zaplanowany jako treningowy zachowuje cel treningowy także po odwołaniu treningu. Historia: planOn(date) = wersja planu z tego dnia.
Insulinooporność (opcja): domyślnie wyłącznie ostrzeżenia (próg udziału węgli, cukry ≤ sugarMaxPct% informacyjnie, błonnik ≥ fiberMin, > carbsPerMealMaxG na posiłek). Przeniesienie nadwyżki do tłuszczu tylko przy shiftExcessToFat = true (ustalenie ze specjalistą); brak przewagi w spadku masy.
Kompletność dnia (src/domain/intake.ts): confirmed (użytkownik potwierdził, ≥50% celu), probable (≥ posiłki−1 i ≥70% celu), incomplete, none. Makro w analizach tylko przy pokryciu ≥80% kcal.
TDEE z danych (energy.ts observedTdee): średnie spożycie z dni confirmed/probable − nachylenie regresji wagi × 7700; wiarygodność high (≥21 dni, ≥10 potwierdzonych, ≥16 ważeń, okno 28) / medium (≥14, ≥5, ≥10) / low (pokazujemy, nie używamy) / insufficient. Zakres ±150/250/400 kcal.
Ręczna zmiana planu (planEdit.ts): błędy blokują (zakres 1200–5000, makro ≠ kcal > 3%, poniżej indywidualnego minimum (kcalFloor) bez potwierdzenia specjalisty, brak powodu), ostrzeżenia wymagają zatwierdzenia (białko < 1,2 lub > 2,6 g/kg celu, tłuszcz < 20% kcal / 0,5 g/kg, deficyt > 25% lub < 5%, < 14 dni od poprzedniej zmiany).


## Feedback (0.6)
Po odrzuceniu porady użytkownik wybiera powód. Czas ukrycia: nie teraz → do końca dnia; brak czasu → 3 dni; nie pomaga mi → 14 dni; nie pasuje do sytuacji → 30 dni; problem zdrowotny → 14 dni (z prośbą o zapisanie objawów w check-inie); inny → 7 dni. Trzy odrzucenia tej samej porady w 30 dni (bez „nie teraz”) → 30 dni. Porady zdrowotne chowają się najwyżej do końca dnia. Alerty bezpieczeństwa (safety) nigdy nie są ukrywane przez feedback. Użytkownik może przywrócić ukrytą poradę.
