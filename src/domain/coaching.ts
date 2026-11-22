import { mean, stdDev } from './calc';
import { addDays, bedtimeMinutesShifted, diffDays, type LocalDate } from './dates';
import type { EveningCheckIn, MissReason, MorningCheckIn } from './types';

/** Zagregowany obraz jednego dnia: wejście do coachingu, raportów i wzorców. */
export interface DaySnapshot {
  date: LocalDate;
  morning?: MorningCheckIn;
  evening?: EveningCheckIn;
  kcal?: number; protein?: number; fiber?: number; meals?: number; // undefined = brak wpisów (nie zero!)
  waterMl?: number;
  workoutPlanned: boolean;
  workoutDone: boolean;
  withDaughter: boolean;
}

export interface Recommendation {
  id: string; priority: number; title: string; action: string;
  basis: string; days: number; completeness: string; limits: string;
}

const pct = (n: number, d: number) => `${n}/${d} dni`;

/** Silnik coachingu behawioralnego: reguły → krótkie konkretne działania. Zwraca posortowane wg priorytetu. */
export function coach(days: DaySnapshot[], today: LocalDate, kcalTarget: number): Recommendation[] {
  const recs: Recommendation[] = [];
  const past = days.filter((d) => d.date < today).sort((a, b) => a.date.localeCompare(b.date));
  const last14 = past.filter((d) => d.date >= addDays(today, -14));
  const last7 = past.filter((d) => d.date >= addDays(today, -7));
  const hasAny = (d: DaySnapshot) => !!(d.morning || d.evening || d.kcal !== undefined);

  // 1. Powrót po przerwie
  const lastActive = [...past].reverse().find(hasAny);
  const gap = lastActive ? diffDays(lastActive.date, today) : null;
  if (gap !== null && gap >= 3) {
    recs.push({ id: 'return', priority: 100, title: 'Wracasz do planu', action: 'Dzisiejsze minimum: check-in, 2 posiłki z planu i 15 min spaceru. Bez nadrabiania zaległości.',
      basis: `Brak wpisów od ${gap - 1} dni`, days: gap - 1, completeness: 'brak danych z przerwy', limits: 'Brak wpisów nie oznacza złamania diety. Nie wyciągam wniosków z dni bez danych.' });
  }

  // 2. Wczoraj powyżej kalorii → powrót od następnego posiłku
  const y = past.find((d) => d.date === addDays(today, -1));
  if (y?.kcal !== undefined && y.kcal > kcalTarget * 1.1) {
    recs.push({ id: 'over_yesterday', priority: 70, title: 'Zwykły plan od pierwszego posiłku', action: 'Zjedz normalne śniadanie i trzymaj dzisiejszy cel. Bez odrabiania kalorii i bez karnego cardio.',
      basis: `Wczoraj ${Math.round(y.kcal)} kcal (cel ${kcalTarget})`, days: 1, completeness: 'dziennik z wczoraj', limits: 'Jeden dzień nie zmienia trendu.' });
  }

  // 3. Pomijanie posiłków + głód wieczorem
  const hungry = last7.filter((d) => (d.evening?.hunger ?? 0) >= 4 && d.meals !== undefined && d.meals <= 2);
  const withHungerData = last7.filter((d) => d.evening?.hunger !== undefined && d.meals !== undefined).length;
  if (hungry.length >= 3) {
    recs.push({ id: 'early_meal', priority: 80, title: 'Pełny posiłek przed 13:00', action: 'Spakuj do auta posiłek 2 z meal prepu. Wczesne białko zmniejsza ryzyko wieczornego głodu.',
      basis: 'Dni z ≤2 posiłkami i głodem wieczorem ≥4/5', days: hungry.length, completeness: pct(withHungerData, 7), limits: 'Obserwacja zależności, nie dowód przyczynowy.' });
  }

  // 4. Stres i przekroczenia
  const stressOver = last14.filter((d) => (d.evening?.stress ?? d.morning?.stress ?? 0) >= 8 && d.kcal !== undefined && d.kcal > kcalTarget * 1.1);
  if (stressOver.length >= 3) {
    recs.push({ id: 'stress_sweets', priority: 65, title: 'Zaplanuj słodycze w limicie', action: 'Na dni wysokiego stresu przygotuj z góry 150–200 kcal słodyczy wliczonych w plan (np. 30 g gorzkiej czekolady).',
      basis: 'Przekroczenia >10% w dni ze stresem ≥8', days: stressOver.length, completeness: pct(last14.filter((d) => d.kcal !== undefined).length, 14), limits: 'To korelacja, nie dowód, że stres jest przyczyną.' });
  }

  // 5. Opuszczone treningi (bez winy za opiekę i odpoczynek)
  const missed = last14.filter((d) => d.workoutPlanned && !d.workoutDone && !d.withDaughter);
  if (missed.length >= 2) {
    const reasons = missed.map((d) => d.evening?.workoutMissReason).filter(Boolean) as MissReason[];
    const top = mode(reasons);
    const action = top === 'time' ? 'Wybierz wersję 30 min: tylko 3 pierwsze ćwiczenia, po 2 serie.'
      : top === 'fatigue' ? 'Trening w dzień z lepszym snem; w gorsze dni plan B (skrócony).'
      : top === 'pain' ? 'Zgłoś ból w check-inie. Ćwiczenia nóg zostaną ograniczone; umów ocenę kolana.'
      : top === 'motivation' ? 'Ustal stałą godzinę i spakuj torbę dzień wcześniej. Cel: tylko wejść na siłownię i zrobić 1. ćwiczenie.'
      : 'Najbliższy wolny dzień bez córki jest już w kalendarzu treningów.';
    recs.push({ id: 'missed_workouts', priority: 60, title: 'Treningi: jedna zmiana', action,
      basis: `Opuszczone treningi w dni bez córki${top ? `, najczęstszy powód: ${MISS_LABEL[top]}` : ''}`, days: missed.length, completeness: `${reasons.length}/${missed.length} z podanym powodem`, limits: 'Dni opieki i zaplanowany odpoczynek nie są liczone jako opuszczone.' });
  }

  // 6. Białko
  const prot = last7.filter((d) => d.protein !== undefined);
  const avgP = mean(prot.map((d) => d.protein)).value;
  if (prot.length >= 4 && avgP !== null && avgP < 140) {
    recs.push({ id: 'protein', priority: 50, title: 'Więcej białka w 1. posiłku', action: 'Dodaj 2 jajka albo 150 g tofu do śniadania. Białko pomaga zachować mięśnie na redukcji.',
      basis: `Średnio ${Math.round(avgP)} g białka`, days: prot.length, completeness: pct(prot.length, 7), limits: 'Tylko dni z kompletnym dziennikiem.' });
  }

  // 7. Regularność snu
  const beds = last14.map((d) => d.morning?.bedTime).filter(Boolean).map((t) => bedtimeMinutesShifted(t!));
  const sd = stdDev(beds);
  if (beds.length >= 5 && sd !== null && sd > 60) {
    const avgBed = Math.round(beds.reduce((a, b) => a + b, 0) / beds.length);
    const target = avgBed - 30;
    recs.push({ id: 'sleep_regular', priority: 55, title: 'Stała pora snu', action: `Kładź się o ${hhmm(target)} (30 min wcześniej niż Twoja średnia) przez 7 dni. Ekran odkładasz 30 min przed.`,
      basis: `Rozrzut godziny zaśnięcia ±${Math.round(sd)} min`, days: beds.length, completeness: pct(beds.length, 14), limits: 'Dziennik snu nie diagnozuje zaburzeń snu.' });
  }

  // 8. Brak danych do decyzji
  if (!recs.length && last7.filter(hasAny).length < 3) {
    recs.push({ id: 'data', priority: 10, title: 'Najpierw dane', action: 'Rób poranny check-in z ważeniem przez kolejne 7 dni. To 30 sekund.',
      basis: 'Mało wpisów w ostatnim tygodniu', days: last7.filter(hasAny).length, completeness: pct(last7.filter(hasAny).length, 7), limits: 'Za mało obserwacji na wnioski.' });
  }
  return recs.sort((a, b) => b.priority - a.priority);
}

export const MISS_LABEL: Record<MissReason, string> = { time: 'brak czasu', custody: 'opieka nad córką', pain: 'ból', fatigue: 'zmęczenie', motivation: 'motywacja', other: 'inny' };

function mode<T>(arr: T[]): T | undefined {
  const m = new Map<T, number>();
  arr.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
function hhmm(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Wzorce: korelacja dwóch serii z wymaganą liczbą obserwacji. */
export function findPattern(days: DaySnapshot[], x: (d: DaySnapshot) => number | undefined, y: (d: DaySnapshot) => number | undefined, minN = 10) {
  const pairs = days.map((d) => [x(d), y(d)] as const).filter((p): p is readonly [number, number] => p[0] !== undefined && p[1] !== undefined);
  if (pairs.length < minN) return { n: pairs.length, r: null as number | null, enough: false };
  const mx = pairs.reduce((a, p) => a + p[0], 0) / pairs.length;
  const my = pairs.reduce((a, p) => a + p[1], 0) / pairs.length;
  let num = 0, dx = 0, dy = 0;
  for (const [a, b] of pairs) { num += (a - mx) * (b - my); dx += (a - mx) ** 2; dy += (b - my) ** 2; }
  const r = dx && dy ? num / Math.sqrt(dx * dy) : null;
  return { n: pairs.length, r, enough: true };
}
