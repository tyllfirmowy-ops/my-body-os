import { blockAverages, mean, type DatedValue } from './calc';
import { addDays, diffDays, type LocalDate } from './dates';

export const KCAL_FLOOR = 2100; // konserwatywny limit projektowy dla tego profilu, nie próg medyczny

export type AdaptStatus = 'calibration' | 'insufficient_data' | 'on_track' | 'slow_waist_down' | 'slow' | 'stagnation_check' | 'stagnation' | 'too_fast' | 'cooldown';
export interface AdaptResult {
  status: AdaptStatus;
  weeklyLossKg: number | null;      // dodatnie = spadek
  reliable: boolean;
  message: string;
  checks: string[];
  proposal?: { kind: 'kcal' | 'activity'; kcalDelta?: number; newKcal?: number; stepsDelta?: number; reason: string; alternative: string };
}

export interface AdaptInput {
  today: LocalDate;
  planStart: LocalDate;
  lastPlanChange: LocalDate;      // data ostatniej zatwierdzonej zmiany kcal
  kcalTarget: number;
  weights: DatedValue[];
  waists: DatedValue[];
  intakeDays: { date: LocalDate; kcal: number; target: number }[]; // tylko dni kompletne; target = historyczny cel TEGO dnia
  stepsAvg?: number | null;
  strongHungerOrWeakness?: boolean;
  healthFlag?: boolean;          // aktywne istotne objawy zdrowotne
}

/** Silnik adaptacji redukcji. Deterministyczny, niezależny od UI. Nigdy nie zmienia planu sam: tylko propozycja. */
export function evaluateAdaptation(i: AdaptInput): AdaptResult {
  const end = addDays(i.today, -1); // analizujemy zakończone dni
  const [w0, w1, w2] = blockAverages(i.weights, end, 3);
  const reliable0 = w0.n >= 4, reliable1 = w1.n >= 4, reliable2 = w2.n >= 4;
  const weekly = w0.value !== null && w1.value !== null ? w1.value - w0.value : null;
  const checks: string[] = [];

  if (i.healthFlag) return { status: 'insufficient_data', weeklyLossKg: weekly, reliable: false, message: 'Aktywne objawy zdrowotne: nie zwiększamy deficytu. Najpierw zdrowie.', checks };
  if (diffDays(i.planStart, i.today) < 14) {
    return { status: 'calibration', weeklyLossKg: weekly, reliable: reliable0 && reliable1, message: `Kalibracja (dzień ${diffDays(i.planStart, i.today) + 1}/14). Bez zmian kalorii na podstawie wahań wagi.`, checks };
  }
  if (!reliable0 || !reliable1) {
    return { status: 'insufficient_data', weeklyLossKg: weekly, reliable: false, message: `Za mało ważeń (ostatnie 7 dni: ${w0.n}, poprzednie: ${w1.n}; potrzeba ≥4/tydz.). Brak korekty.`, checks };
  }
  const loss = weekly!;
  const waistChange = waistDelta(i.waists, end);

  if (loss > 1.0 && w2.value !== null && reliable2 && w2.value - w1.value! > 1.0) {
    return { status: 'too_fast', weeklyLossKg: loss, reliable: true, checks,
      message: `Spadek >1 kg/tydz. przez 2 tygodnie${i.strongHungerOrWeakness ? ' przy silnym głodzie/osłabieniu' : ''}. Nie zwiększaj deficytu; rozważ powrót o 100–150 kcal w górę. Przy niepokojących objawach skonsultuj się z lekarzem.` };
  }
  if (loss >= 0.4) {
    return { status: 'on_track', weeklyLossKg: loss, reliable: true, checks, message: `Tempo ${loss.toFixed(2)} kg/tydz. jest w zakresie. Utrzymujemy plan, bez zwiększania deficytu.` };
  }
  if (waistChange !== null && waistChange <= -1) {
    return { status: 'slow_waist_down', weeklyLossKg: loss, reliable: true, checks, message: `Waga spada wolniej (${loss.toFixed(2)} kg/tydz.), ale talia mniejsza o ${Math.abs(waistChange).toFixed(1)} cm. Bez zmian, obserwujemy.` };
  }
  // stagnacja: brak istotnego spadku przez ≥14 dni
  const twoWeekLoss = w2.value !== null && reliable2 ? w2.value - w0.value! : null;
  if (twoWeekLoss === null || twoWeekLoss >= 0.3) {
    return { status: 'slow', weeklyLossKg: loss, reliable: true, checks, message: `Tempo ${loss.toFixed(2)} kg/tydz. jest wolniejsze od celu, ale za wcześnie na korektę. Obserwujemy kolejny tydzień.` };
  }
  // checklist przed korektą
  const from14 = addDays(end, -13);
  const logged = i.intakeDays.filter((d) => d.date >= from14 && d.date <= end);
  const avgIntake = mean(logged.map((d) => d.kcal)).value;
  const avgTarget = mean(logged.map((d) => d.target)).value;
  const loggingOk = logged.length >= 10;
  const adherenceOk = avgIntake !== null && avgTarget !== null && Math.abs(avgIntake - avgTarget) <= avgTarget * 0.08;
  checks.push(`Kompletne dni dziennika: ${logged.length}/14 ${loggingOk ? '✓' : '✗ (potrzeba ≥10)'}`);
  checks.push(`Realizacja celu: ${avgIntake ? Math.round(avgIntake) : '—'} kcal vs cel tych dni ${avgTarget ? Math.round(avgTarget) : '—'} ${adherenceOk ? '✓' : '✗'}`);
  checks.push(`Talia (14 dni): ${waistChange === null ? 'brak danych' : waistChange.toFixed(1) + ' cm'}`);
  checks.push('Sprawdź też: kroki, sen, stres, start treningów (woda w mięśniach), zaparcia, nawodnienie.');
  if (!loggingOk || !adherenceOk) {
    return { status: 'stagnation_check', weeklyLossKg: loss, reliable: true, checks, message: 'Możliwa stagnacja, ale dane o jedzeniu nie potwierdzają realizacji planu. Najpierw dokładne ważenie i zapisywanie przez 7 dni.' };
  }
  if (diffDays(i.lastPlanChange, i.today) < 14) {
    return { status: 'cooldown', weeklyLossKg: loss, reliable: true, checks, message: 'Ostatnia korekta była mniej niż 14 dni temu. Obserwujemy jej efekt.' };
  }
  const newKcal = Math.max(KCAL_FLOOR, i.kcalTarget - 150);
  const canCut = newKcal < i.kcalTarget;
  return {
    status: 'stagnation', weeklyLossKg: loss, reliable: true, checks,
    message: 'Potwierdzona stagnacja przy dobrej realizacji planu. Proponuję jedną korektę.',
    proposal: canCut
      ? { kind: 'kcal', kcalDelta: newKcal - i.kcalTarget, newKcal, reason: `Brak spadku przez 14+ dni przy ${logged.length}/14 dniach dziennika.`, alternative: 'Zamiast tego: +1000 kroków dziennie (jeśli kolano pozwala).' }
      : { kind: 'activity', stepsDelta: 1000, reason: `Kalorie są już na limicie ${KCAL_FLOOR} kcal (poniżej tylko po konsultacji ze specjalistą).`, alternative: 'Konsultacja z dietetykiem klinicznym.' },
  };
}

export function waistDelta(waists: DatedValue[], end: LocalDate): number | null {
  const recent = waists.filter((w) => w.date <= end && w.date > addDays(end, -7)).sort((a, b) => b.date.localeCompare(a.date))[0];
  const older = waists.filter((w) => w.date <= addDays(end, -12) && w.date > addDays(end, -21)).sort((a, b) => b.date.localeCompare(a.date))[0];
  return recent && older ? recent.value - older.value : null;
}

/** Plan kroków: 6500 → 8000, progres zatrzymany przy problemie z kolanem. */
export function stepTarget(weekIndex: number, kneeIssue: boolean, prevTarget?: number): number {
  const ladder = [6500, 7000, 7500, 8000];
  const t = ladder[Math.min(Math.max(weekIndex, 0), ladder.length - 1)];
  return kneeIssue && prevTarget ? Math.min(prevTarget, t) : t;
}
