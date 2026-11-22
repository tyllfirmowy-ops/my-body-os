# Reguły coachingu (src/domain/coaching.ts, readiness.ts, adaptation.ts)

A/B/C: C gdy energia 1, sen <4,5 h, stres 10, choroba, brak czasu, jakość snu 1 + energia ≤2, objaw alarmowy. B gdy sen 4,5–6 h, jakość ≤2, energia 2, stres 9, mało czasu. Stres 8 (bazowy u użytkownika) sam nie zmienia planu. Brak danych nie obniża poziomu.

Coaching (pokazywana 1 rekomendacja, najwyższy priorytet): powrót po ≥3 dniach bez wpisów (100) · pomijanie posiłków + głód wieczorem ≥3/7 dni (80) · wczoraj >110% kcal → zwykły plan, bez odrabiania (70) · stres ≥8 i >110% kcal ≥3/14 (65) · opuszczone treningi w dni bez córki ≥2/14, akcja wg powodu (60) · rozrzut pory snu >60 min (55) · białko <140 g przy ≥4 dniach (50). Każda ma: podstawę, liczbę dni, kompletność, ograniczenia. Analiza od daty startu planu.

Adaptacja: kalibracja 14 dni · ≥4 ważenia/tydz. · 0,4+ kg/tydz. = utrzymaj · talia −1 cm/14 dni = bez zmian · stagnacja (<0,3 kg/14 dni) → checklista (dziennik ≥10/14, realizacja ±8%) → jedna propozycja: −150 kcal ALBO +1000 kroków · 14 dni odstępu · podłoga 2100 kcal · >1 kg/tydz. przez 2 tyg. = nie zwiększaj deficytu.

Progresja: +najmniejszy krok tylko gdy wszystkie serie na górze zakresu, ten sam ciężar, technika „ok”, RIR ≥1 znany, ból ≤2, brak blokady. Ból ≥4 → −15%. Wstawanie z ławki bez obciążenia do oceny kolana.

Cele dnia (src/domain/targets.ts): cykl kcal opcjonalny; dzień treningowy +X kcal z węglowodanów, dni bez treningu −X·(treningi/tydz.)/(dni wolne/tydz.), średnia = plan.kcal, białko stałe. Insulinooporność (opcja): węgle ≤ carbMaxPct% kcal (nadwyżka → tłuszcz), cukry ≤ sugarMaxPct% (informacyjnie), błonnik ≥ fiberMin, ostrzeżenie > carbsPerMealMaxG na posiłek. Zmiana ustawień = nowa PlanVersion.
